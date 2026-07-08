"""
NLE Engine — Project JSON → MLT XML translator.

Converts the Prism NLE project JSON format into MLT XML that melt can render.
The project JSON is the source of truth; MLT XML is a derived representation.
"""

import json
import logging
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class Clip:
    """A clip instance on the timeline."""

    def __init__(self, data: dict[str, Any]) -> None:
        # --- Normalize frontend → engine keys -----------------------------------
        # Accept both the frontend format (inPoint/outPoint/startFrame/transition)
        # and the engine-native format (in/out/trackStart/transitionOut).
        if "inPoint" in data and "in" not in data:
            data["in"] = data["inPoint"]
        if "outPoint" in data and "out" not in data:
            data["out"] = data["outPoint"]
        if "startFrame" in data and "trackStart" not in data:
            data["trackStart"] = data["startFrame"]
        if "transition" in data and "transitionOut" not in data:
            data["transitionOut"] = data["transition"]

        # Normalize effects: frontend sends a dict {name: value}, engine expects
        # a list of {"type": ..., "value": ...} dicts.
        raw_effects = data.get("effects", [])
        if isinstance(raw_effects, dict):
            data["effects"] = [
                {"type": k, "value": v}
                for k, v in raw_effects.items()
                if v not in (0, False, 0.0)
            ]

        self.id: str = data["id"]
        self.source_id: int = data["sourceId"]
        self.source_path: str = data.get("sourcePath", "")
        self.in_point: float = data.get("in", 0.0)
        self.out_point: float = data.get("out", 0.0)
        self.track_start: float = data.get("trackStart", 0.0)
        self.speed: float = data.get("speed", 1.0)
        self.volume: float = data.get("volume", 1.0)
        self.muted: bool = data.get("muted", False)
        self.fade_in: float = data.get("fadeIn", 0.0)
        self.fade_out: float = data.get("fadeOut", 0.0)
        self.effects: list[dict] = data.get("effects", [])
        self.transition_out: dict | None = data.get("transitionOut")
        self.text: dict | None = data.get("text")
        self.keyframes: dict = data.get("keyframes", {})

    @property
    def duration(self) -> float:
        """Duration of the visible portion of this clip on the timeline."""
        return self.out_point - self.in_point

    @property
    def speed_adjusted_duration(self) -> float:
        """Duration after speed adjustment."""
        return self.duration / self.speed if self.speed > 0 else self.duration


class Track:
    """A track on the timeline."""

    def __init__(self, data: dict[str, Any]) -> None:
        self.id: str = data["id"]
        self.type: str = data.get("type", "video")  # video | audio | text
        self.name: str = data.get("name", f"Track {self.id}")
        self.muted: bool = data.get("muted", False)
        self.locked: bool = data.get("locked", False)
        self.clips: list[Clip] = [Clip(c) for c in data.get("clips", [])]


class Timeline:
    """The full timeline state."""

    def __init__(self, data: dict[str, Any]) -> None:
        self.tracks: list[Track] = [Track(t) for t in data.get("tracks", [])]
        self.fps: int = data.get("fps", 30)
        self.width: int = data.get("resolution", {}).get("w", 1920)
        self.height: int = data.get("resolution", {}).get("h", 1080)

    @property
    def duration(self) -> float:
        """Total timeline duration in seconds."""
        max_end = 0.0
        for track in self.tracks:
            for clip in track.clips:
                clip_end = clip.track_start + clip.speed_adjusted_duration
                max_end = max(max_end, clip_end)
        return max_end


# ---------------------------------------------------------------------------
# Effects → MLT filter mapping
# ---------------------------------------------------------------------------

def _effects_to_mlt_filters(effects: list[dict]) -> list[tuple[str, dict[str, str]]]:
    """Convert a list of effect dicts to MLT (filter_name, properties) pairs."""
    filters: list[tuple[str, dict[str, str]]] = []

    for effect in effects:
        effect_type = effect.get("type", "")

        if effect_type == "brightness":
            val = effect.get("value", 0) / 100.0 * 0.3
            filters.append(("brightness", {"level": str(val)}))

        elif effect_type == "contrast":
            val = effect.get("value", 0)
            gamma = 1.25 - val * 0.0075
            filters.append(("gamma", {"factor": str(gamma)}))

        elif effect_type == "saturation":
            val = 1.0 + effect.get("value", 0) / 100.0 * 0.6
            filters.append(("frei0r.sopsat", {"saturation": str(val)}))

        elif effect_type == "temperature":
            temp = effect.get("value", 0)
            r = temp / 200.0
            b = -temp / 200.0
            filters.append(("color_balance", {
                "red": str(r), "blue": str(b),
            }))

        elif effect_type == "vignette":
            val = effect.get("value", 0) / 100.0 * 0.5
            filters.append(("vignette", {"radius": str(1.0 - val)}))

        elif effect_type == "sharpness":
            amount = effect.get("value", 0) / 100.0 * 3.0
            filters.append(("unsharp", {
                "amount": str(amount),
            }))

        elif effect_type == "noiseReduction":
            # Denoise via avfilter nlmeans
            strength = effect.get("value", 0) / 100.0 * 5.0
            filters.append(("avfilter_nlmeans", {"s": str(strength)}))

        elif effect_type == "highlights":
            # lift_gamma_gain: gain channel (RGB) controls highlights.
            # Positive value brightens highlights, negative darkens.
            val = effect.get("value", 0) / 100.0 * 0.3
            filters.append(("lift_gamma_gain", {
                "gain": f"{1.0 + val},1.0,1.0",
            }))

        elif effect_type == "shadows":
            # lift_gamma_gain: lift channel controls shadows.
            # Positive value lifts shadows, negative deepens them.
            val = effect.get("value", 0) / 100.0 * 0.2
            filters.append(("lift_gamma_gain", {
                "lift": f"{1.0 + val},1.0,1.0",
            }))

        elif effect_type == "greyscale":
            filters.append(("greyscale", {}))

    return filters


def _volume_filters(clip: Clip) -> list[tuple[str, dict[str, str]]]:
    """Generate MLT filters for clip volume/fade."""
    filters: list[tuple[str, dict[str, str]]] = []

    if clip.muted:
        filters.append(("volume", {"level": "0"}))
    elif clip.volume != 1.0:
        filters.append(("volume", {"level": str(clip.volume)}))

    if clip.fade_in > 0:
        fade_frames = int(clip.fade_in * 30)  # assuming 30fps
        filters.append(("fade", {
            "type": "in",
            "start": "0",
            "duration": str(fade_frames),
        }))

    if clip.fade_out > 0:
        fade_frames = int(clip.fade_out * 30)
        duration_frames = int(clip.duration * 30)
        start = max(0, duration_frames - fade_frames)
        filters.append(("fade", {
            "type": "out",
            "start": str(start),
            "duration": str(fade_frames),
        }))

    return filters


# ---------------------------------------------------------------------------
# Keyframes → MLT animation
# ---------------------------------------------------------------------------

def _hex_to_ffmpeg_color(hex_color: str) -> str:
    """Convert a hex color string (#RRGGBB or #RRGGBBAA) to ffmpeg color format."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return f"0x{r:02x}{g:02x}{b:02x}"
    elif len(hex_color) == 8:
        r, g, b, a = (int(hex_color[i:i+2], 16) for i in range(0, 8, 2))
        return f"0x{r:02x}{g:02x}{b:02x}@{a/255:.2f}"
    return "white"


def _keyframes_to_mlt_animation(keyframes: dict, fps: int) -> dict[str, str]:
    """Convert keyframe dict to MLT animated property strings.

    Input: {prop_name: [{t: float (seconds), v: float, interpolation: str}, ...]}
    Output: {mlt_property_name: "frame0=val0 frame1=val1 ..."}
    """
    animated: dict[str, str] = {}

    for prop_name, kf_list in keyframes.items():
        if not kf_list:
            continue
        # Sort by time
        sorted_kf = sorted(kf_list, key=lambda k: k.get("t", 0))
        # Build frame=value pairs
        parts: list[str] = []
        for kf in sorted_kf:
            frame = int(kf.get("t", 0) * fps)
            val = kf.get("v", 0)
            parts.append(f"{frame}={val}")
        if parts:
            # First keyframe must start at frame 0 for MLT
            if not parts[0].startswith("0="):
                parts.insert(0, parts[0].split("=", 1)[1].replace("=", "0=", 1) if "=" in parts[0] else "0=0")
            animated[prop_name] = " ".join(parts)

    return animated


def _build_keyframe_filters(clip: Clip, fps: int) -> list[tuple[str, dict[str, str]]]:
    """Convert clip keyframes to MLT filter specifications.

    Maps Prism property names to MLT filters:
      opacity -> alpha filter (level)
      scaleX/scaleY -> affine filter (scale)
      rotation -> affine filter (angle)
      x/y -> affine filter (rect)
      volume -> volume filter (level)
    """
    if not clip.keyframes:
        return []

    filters: list[tuple[str, dict[str, str]]] = []
    animated = _keyframes_to_mlt_animation(clip.keyframes, fps)

    # Collect affine properties so we can merge them into a single filter
    affine_props: dict[str, str] = {}

    for prop_name, anim_str in animated.items():
        if prop_name == "opacity":
            # MLT alpha filter: level 0.0 = transparent, 1.0 = opaque
            filters.append(("alpha", {"level": anim_str}))

        elif prop_name in ("scaleX", "scaleY"):
            # Use affine for scale; if both present, last one wins (simplified)
            scale_parts = anim_str.split(" ")
            # affine scale: "frame=val frame=val" where val is multiplier
            affine_props["scale"] = anim_str

        elif prop_name == "rotation":
            affine_props["angle"] = anim_str

        elif prop_name in ("x", "y"):
            # affine rect: "x y w h" per frame — we animate x,y with fixed w,h
            # For simplicity, use animate=1 pattern with rect property
            affine_props["rect"] = anim_str

        elif prop_name == "volume":
            filters.append(("volume", {"level": anim_str}))

    # Add a single affine filter if any affine properties were collected
    if affine_props:
        filters.append(("affine", affine_props))

    return filters


# ---------------------------------------------------------------------------
# Text overlay filters
# ---------------------------------------------------------------------------

def _build_text_filters(clip: Clip, fps: int) -> list[tuple[str, dict[str, str]]]:
    """Build MLT filters for text overlays.

    For text-only clips (sourceId == 0, no sourcePath), generates a color producer
    with drawtext. For clips with video AND text, adds drawtext filter.
    """
    if not clip.text:
        return []

    text = clip.text.get("text", "")
    if not text:
        return []

    font_size = clip.text.get("fontSize", 32)
    font_color = clip.text.get("fontColor", "white")
    font_family = clip.text.get("fontFamily", "Sans")

    # Escape special characters for ffmpeg drawtext
    escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
    escaped_text = escaped_text.replace("%", "%%")  # ffmpeg uses % for time codes

    # Convert hex color
    ffmpeg_color = _hex_to_ffmpeg_color(font_color)

    # Position: use x,y from text data, default to centered
    x_pos = clip.text.get("x")
    y_pos = clip.text.get("y")

    if x_pos is not None and y_pos is not None:
        # Convert from pixel coords to ffmpeg drawtext coords
        x_expr = str(int(x_pos))
        y_expr = str(int(y_pos))
    else:
        # Center the text
        x_expr = "(w-text_w)/2"
        y_expr = "(h-text_h)/2"

    # Build drawtext filter string
    drawtext = (
        f"drawtext=text='{escaped_text}'"
        f":fontsize={font_size}"
        f":fontcolor={ffmpeg_color}"
        f":fontfile=''"  # Use default font
        f":x={x_expr}"
        f":y={y_expr}"
    )

    return [("avfilter", {"window_text": drawtext})]


def _build_text_producer(mlt: Element, producer_id: str, clip: Clip, fps: int) -> None:
    """Create a producer for a text-only clip (no video source).

    Uses a black color producer + drawtext filter.
    """
    producer = SubElement(mlt, "producer", {"id": producer_id})
    SubElement(producer, "property", {"name": "mlt_service"}).text = "color"
    SubElement(producer, "property", {"name": "resource"}).text = "black"
    SubElement(producer, "property", {"name": "length"}).text = str(int(clip.duration * fps))
    SubElement(producer, "property", {"name": "mlt_service_name"}).text = "color"

    # Add text filter
    for filter_name, props in _build_text_filters(clip, fps):
        f = SubElement(producer, "filter", {"mlt_service": filter_name})
        for k, v in props.items():
            SubElement(f, "property", {"name": k}).text = v

    # Add keyframe filters if any
    for filter_name, props in _build_keyframe_filters(clip, fps):
        f = SubElement(producer, "filter", {"mlt_service": filter_name})
        for k, v in props.items():
            SubElement(f, "property", {"name": k}).text = v


# ---------------------------------------------------------------------------
# MLT XML generation
# ---------------------------------------------------------------------------

class MLTBuilder:
    """Builds an MLT XML document from a project timeline."""

    def __init__(self, timeline: Timeline) -> None:
        self.timeline = timeline
        self._producer_id = 0
        self._filter_id = 0

    def _next_producer_id(self) -> str:
        self._producer_id += 1
        return f"producer_{self._producer_id}"

    def _next_filter_id(self) -> str:
        self._filter_id += 1
        return f"filter_{self._filter_id}"

    def build(self) -> str:
        """Build the MLT XML string.

        Order matters in MLT XML: producers before playlists before tractor.
        """
        mlt = Element("mlt", {
            "LC_NUMERIC": "C",
            "version": "7.36.0",
            "title": "Prism NLE Export",
        })

        # Profile
        SubElement(mlt, "profile", {
            "description": f"HD {self.timeline.height}p {self.timeline.fps}fps",
            "width": str(self.timeline.width),
            "height": str(self.timeline.height),
            "progressive": "1",
            "sample_aspect_num": "1",
            "sample_aspect_den": "1",
            "display_aspect_num": "16",
            "display_aspect_den": "9",
            "frame_rate_num": str(self.timeline.fps),
            "frame_rate_den": "1",
        })

        # Pass 1: Create all producers (must come before playlists)
        # Store (producer_id, entry_data) pairs per track
        track_entries: dict[str, list[tuple[str, dict]]] = {}

        for track in self.timeline.tracks:
            if track.muted:
                continue
            track_entries[track.id] = []
            for clip in track.clips:
                producer_id = self._next_producer_id()
                self._create_producer(mlt, producer_id, clip, track.type)
                entry = {
                    "producer": producer_id,
                    "in": str(int(clip.in_point * self.timeline.fps)),
                    "out": str(int(clip.out_point * self.timeline.fps)),
                }
                track_entries[track.id].append((producer_id, entry))

        # Pass 2: Create playlists (reference producers defined above)
        track_ids: list[str] = []
        audio_track_ids: list[str] = []

        for track in self.timeline.tracks:
            if track.muted:
                continue
            playlist_id = f"playlist_{track.id}"
            playlist = SubElement(mlt, "playlist", {"id": playlist_id})
            for _, entry_data in track_entries[track.id]:
                SubElement(playlist, "entry", entry_data)

            if track.type == "video":
                track_ids.append(playlist_id)
            elif track.type == "audio":
                audio_track_ids.append(playlist_id)

        # Pass 3: Create tractor
        if track_ids:
            self._build_tractor(mlt, track_ids, audio_track_ids)

        # Serialize
        raw = tostring(mlt, encoding="unicode", xml_declaration=False)
        return '<?xml version="1.0" encoding="utf-8" ?>\n' + raw

    def _create_producer(self, mlt: Element, producer_id: str,
                         clip: Clip, track_type: str) -> None:
        """Create a producer element with all its filters."""
        # Text-only clips (sourceId == 0, no sourcePath) get a color producer
        is_text_only = clip.source_id == 0 and not clip.source_path
        if is_text_only:
            _build_text_producer(mlt, producer_id, clip, self.timeline.fps)
            return

        producer = SubElement(mlt, "producer", {"id": producer_id})
        SubElement(producer, "property", {"name": "resource"}).text = clip.source_path
        SubElement(producer, "property", {"name": "mlt_service"}).text = "avformat"

        if track_type == "audio":
            SubElement(producer, "property", {"name": "video_index"}).text = "-1"

        # Speed filter
        if clip.speed != 1.0:
            f = SubElement(producer, "filter", {"mlt_service": "speed"})
            SubElement(f, "property", {"name": "factor"}).text = str(clip.speed)

        # Text overlay (for clips that have video AND text)
        for filter_name, props in _build_text_filters(clip, self.timeline.fps):
            f = SubElement(producer, "filter", {"mlt_service": filter_name})
            for k, v in props.items():
                SubElement(f, "property", {"name": k}).text = v

        # Keyframe animations (opacity, scale, rotation, position, volume)
        for filter_name, props in _build_keyframe_filters(clip, self.timeline.fps):
            f = SubElement(producer, "filter", {"mlt_service": filter_name})
            for k, v in props.items():
                SubElement(f, "property", {"name": k}).text = v

        # Effects
        for filter_name, props in _effects_to_mlt_filters(clip.effects):
            f = SubElement(producer, "filter", {"mlt_service": filter_name})
            for k, v in props.items():
                SubElement(f, "property", {"name": k}).text = v

        # Volume/fade — skip if keyframes already animate volume
        has_volume_keyframe = "volume" in clip.keyframes
        for filter_name, props in _volume_filters(clip):
            if has_volume_keyframe and filter_name == "volume":
                continue  # keyframe animation takes precedence
            f = SubElement(producer, "filter", {"mlt_service": filter_name})
            for k, v in props.items():
                SubElement(f, "property", {"name": k}).text = v

    @staticmethod
    def _transition_mlt_service(transition_type: str) -> str:
        """Map a Prism transition type to the appropriate MLT transition service."""
        mapping = {
            "crossfade": "luma",
            "dissolve": "luma",
            "wipe-left": "charve",
            "wipe-right": "charve",
            "slide-left": "affine",
            "slide-right": "affine",
        }
        return mapping.get(transition_type, "luma")

    def _build_tractor(self, mlt: Element, track_ids: list[str], audio_track_ids: list[str]) -> None:
        """Build a tractor with multitrack and transitions."""
        tractor = SubElement(mlt, "tractor", {"id": "tractor_main"})
        multitrack = SubElement(tractor, "multitrack")

        all_track_ids = track_ids + audio_track_ids
        for tid in all_track_ids:
            SubElement(multitrack, "track", {"producer": tid})

        # Add transitions between consecutive video clips in the first video track
        if self.timeline.tracks:
            first_video_track = next(
                (t for t in self.timeline.tracks if t.type == "video" and not t.muted),
                None,
            )
            if first_video_track:
                # TODO: same-track MLT transitions require split playlists
                pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def project_to_mlt_xml(project_json: dict[str, Any]) -> str:
    """Convert a Prism NLE project JSON to MLT XML.

    Args:
        project_json: The project dict containing timeline, tracks, clips.

    Returns:
        MLT XML string ready for melt consumption.
    """
    timeline = Timeline(project_json)
    builder = MLTBuilder(timeline)
    return builder.build()


def project_to_mlt_xml_file(project_json: dict[str, Any], output_path: str | Path) -> Path:
    """Write the MLT XML to a file and return the path."""
    path = Path(output_path)
    xml_str = project_to_mlt_xml(project_json)
    path.write_text(xml_str, encoding="utf-8")
    logger.info(f"MLT XML written to {path}")
    return path


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_project = {
        "fps": 30,
        "resolution": {"w": 1920, "h": 1080},
        "tracks": [
            {
                "id": "v1",
                "type": "video",
                "clips": [
                    {
                        "id": "clip_1",
                        "sourceId": 1,
                        "sourcePath": "/home/chotaxdon/Work/Projects/Prism/backend/test_nle/clip_a.mp4",
                        "in": 0.0,
                        "out": 3.0,
                        "trackStart": 0.0,
                        "speed": 1.0,
                        "volume": 1.0,
                        "effects": [{"type": "brightness", "value": 30}],
                        "transitionOut": {"type": "crossfade", "duration": 1.0},
                        "text": {
                            "text": "Hello World",
                            "fontSize": 48,
                            "fontColor": "#FFFFFF",
                            "x": 960,
                            "y": 540,
                        },
                    },
                    {
                        "id": "clip_2",
                        "sourceId": 2,
                        "sourcePath": "/home/chotaxdon/Work/Projects/Prism/backend/test_nle/clip_b.mp4",
                        "in": 0.0,
                        "out": 5.0,
                        "trackStart": 2.0,
                        "speed": 1.0,
                        "volume": 0.8,
                        "effects": [],
                        "keyframes": {
                            "opacity": [
                                {"t": 0.0, "v": 1.0, "interpolation": "linear"},
                                {"t": 2.5, "v": 0.0, "interpolation": "linear"},
                            ],
                        },
                    },
                ],
            },
            {
                "id": "v2",
                "type": "video",
                "clips": [
                    {
                        "id": "text_clip_1",
                        "sourceId": 0,
                        "sourcePath": "",
                        "in": 0.0,
                        "out": 4.0,
                        "trackStart": 0.0,
                        "volume": 1.0,
                        "text": {
                            "text": "TITLE CARD",
                            "fontSize": 72,
                            "fontColor": "#FF0000",
                        },
                    },
                ],
            },
            {
                "id": "a1",
                "type": "audio",
                "clips": [
                    {
                        "id": "aclip_1",
                        "sourceId": 1,
                        "sourcePath": "/home/chotaxdon/Work/Projects/Prism/backend/test_nle/clip_a.mp4",
                        "in": 0.0,
                        "out": 3.0,
                        "trackStart": 0.0,
                        "volume": 1.0,
                        "fadeIn": 0.3,
                    },
                    {
                        "id": "aclip_2",
                        "sourceId": 2,
                        "sourcePath": "/home/chotaxdon/Work/Projects/Prism/backend/test_nle/clip_b.mp4",
                        "in": 0.0,
                        "out": 5.0,
                        "trackStart": 2.0,
                        "volume": 0.8,
                        "fadeOut": 0.5,
                        "keyframes": {
                            "volume": [
                                {"t": 0.0, "v": 0.8, "interpolation": "linear"},
                                {"t": 5.0, "v": 0.0, "interpolation": "linear"},
                            ],
                        },
                    },
                ],
            },
        ],
    }

    xml = project_to_mlt_xml(test_project)
    output = Path("/home/chotaxdon/Work/Projects/Prism/backend/test_nle/engine_output.mlt")
    output.write_text(xml, encoding="utf-8")
    print(f"Written to {output}")
    print(xml[:500])
