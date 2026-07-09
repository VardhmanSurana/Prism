import os
import hashlib
import json
import logging
import subprocess
from datetime import datetime
from pathlib import Path
from PIL import Image
import reverse_geocoder as rg

from app.utils.security import safe_resolve_read

logger = logging.getLogger(__name__)


def validate_source_path(path: str) -> Path:
    """Validate a source file path against allowed read directories.

    Wraps safe_resolve_read to return a resolved Path on success
    or raise ValueError on failure.
    """
    try:
        return safe_resolve_read(path)
    except Exception as e:
        raise ValueError(f"Source path validation failed: {e}") from e


_ffmpeg_available: bool | None = None
_ffprobe_available: bool | None = None

def _check_ffmpeg_available() -> bool:
    global _ffmpeg_available
    if _ffmpeg_available is not None:
        return _ffmpeg_available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        _ffmpeg_available = True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        _ffmpeg_available = False
    return _ffmpeg_available

def _check_ffprobe_available() -> bool:
    global _ffprobe_available
    if _ffprobe_available is not None:
        return _ffprobe_available
    try:
        subprocess.run(['ffprobe', '-version'], capture_output=True, timeout=5)
        _ffprobe_available = True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        _ffprobe_available = False
    return _ffprobe_available

def _get_city_name(lat, lon) -> dict | None:
    try:
        results = rg.search((lat, lon), mode=1)
        if results:
            r = results[0]
            return {
                "city": r.get("name") or None,
                "state": r.get("admin1") or None,
                "country": r.get("cc") or None,
            }
    except Exception as e:
        logger.debug(f"Geocoding failed for ({lat}, {lon}): {e}")
    return None

def _parse_gps_location(location_str: str) -> tuple[float, float] | None:
    if not location_str or location_str == "+00.0000+000.0000//":
        return None
    try:
        parts = location_str.replace('+', '').split('-')
        clean = location_str.strip()
        if clean.startswith('+'):
            clean = clean[1:]
        tokens = clean.split('+')
        if len(tokens) == 2:
            return float(tokens[0]), float(tokens[1])
        parts2 = location_str.split('/')
        if len(parts2) >= 1:
            coords_part = parts2[0].strip()
            if '+' in coords_part:
                tokens = coords_part.split('+')
                if len(tokens) == 2:
                    return float(tokens[0]), float(tokens[1])
    except (ValueError, IndexError):
        pass
    return None

def extract_video_metadata(file_path: str, probe_data: dict | None = None) -> dict:
    width = height = 0
    aspect_ratio = 1.0
    mime_type = "video/mp4"
    duration = None
    fps = None
    codec = None
    audio_codec = None
    rotation = 0
    date_taken = None
    latitude = longitude = None
    city = state = country = location_str = None

    if probe_data:
        fmt = probe_data.get("format", {})
        streams = probe_data.get("streams", [])

        duration_str = fmt.get("duration")
        if duration_str:
            try:
                duration = float(duration_str)
            except ValueError:
                pass

        tags = fmt.get("tags", {})
        location_tag = tags.get("location") or tags.get("com.apple.quicktime.location.ISO6709")
        if location_tag:
            coords = _parse_gps_location(location_tag)
            if coords:
                latitude, longitude = coords

        date_tag = tags.get("creation_time") or tags.get("com.apple.quicktime.creationdate")
        if date_tag:
            for fmt_str in ('%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d %H:%M:%S'):
                try:
                    date_taken = datetime.strptime(date_tag, fmt_str)
                    break
                except ValueError:
                    continue

        for s in streams:
            if s.get("codec_type") == "video":
                codec = s.get("codec_name")
                width = s.get("width", 0)
                height = s.get("height", 0)
                tags = s.get("tags") or {}
                raw_rotation = tags.get("rotate")
                if raw_rotation is None:
                    for side_data in s.get("side_data_list", []):
                        if "rotation" in side_data:
                            raw_rotation = side_data.get("rotation")
                            break
                try:
                    rotation = int(round(float(raw_rotation or 0))) % 360
                except (TypeError, ValueError):
                    rotation = 0
                r_frame_rate = s.get("r_frame_rate", "0/1")
                if "/" in r_frame_rate:
                    num, den = r_frame_rate.split("/")
                    try:
                        fps = float(num) / float(den) if float(den) > 0 else 0
                    except (ValueError, ZeroDivisionError):
                        fps = 0
                else:
                    try:
                        fps = float(r_frame_rate)
                    except ValueError:
                        fps = 0
            elif s.get("codec_type") == "audio":
                audio_codec = s.get("codec_name")

    if not date_taken:
        try:
            stat = os.stat(file_path)
            date_taken = datetime.fromtimestamp(min(stat.st_mtime, stat.st_ctime))
        except Exception:
            date_taken = datetime.utcnow()

    if width > 0 and height > 0:
        aspect_ratio = width / height
    if codec:
        ext = os.path.splitext(file_path)[1].lower().lstrip('.')
        mime_type = f"video/{ext}" if ext else "video/mp4"
    if latitude is not None and longitude is not None:
        loc_info = _get_city_name(latitude, longitude)
        if loc_info:
            city = loc_info.get("city")
            state = loc_info.get("state")
            country = loc_info.get("country")
            location_str = ", ".join(p for p in [city, state, country] if p) or None

    return {
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "mime_type": mime_type,
        "date_taken": date_taken,
        "city": city,
        "state": state,
        "country": country,
        "location": location_str,
        "latitude": latitude,
        "longitude": longitude,
        "file_type": "video",
        "duration": duration,
        "fps": fps,
        "codec": codec,
        "audio_codec": audio_codec,
        "rotation": rotation,
    }

def extract_frame_at_time(file_path: str, timestamp: float, output_path: str, width: int = 400) -> bool:
    cmd = [
        'ffmpeg', '-y', '-ss', str(timestamp),
        '-i', file_path,
        '-vframes', '1',
        '-vf', f'scale={width}:-2',
        '-q:v', '3',
        output_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        logger.error(f"Frame extraction failed: {e}")
        return False

def extract_scene_keyframes(file_path: str, output_dir: str, threshold: float = 0.3, max_frames: int = 50) -> list[tuple[float, str]]:
    import re
    pattern = os.path.join(output_dir, 'scene_%04d.jpg')
    cmd = [
        'ffmpeg', '-y', '-i', file_path,
        '-vf', f"select='gt(scene,{threshold})',showinfo",
        '-vsync', 'vfp',
        '-q:v', '3',
        pattern
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception as e:
        logger.error(f"Scene detection failed: {e}")
        return []

    timestamps = []
    for line in result.stderr.split('\n'):
        match = re.search(r'pts_time:(\d+\.\d+)', line)
        if match:
            timestamps.append(float(match.group(1)))

    frames = []
    for i, ts in enumerate(timestamps[:max_frames]):
        frame_path = os.path.join(output_dir, f'scene_{i+1:04d}.jpg')
        if os.path.exists(frame_path):
            frames.append((ts, frame_path))

    return sorted(frames, key=lambda x: x[0])


def compute_frame_hash(frame_path: str) -> str:
    try:
        import cv2
        img = cv2.imread(frame_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return ''
        img = cv2.resize(img, (8, 8))
        avg = img.mean()
        bits = (img > avg).flatten()
        return ''.join('1' if b else '0' for b in bits)
    except Exception:
        return ''


def _hamming_distance(hash1: str, hash2: str) -> int:
    if len(hash1) != len(hash2):
        return max(len(hash1), len(hash2))
    return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))


def sample_video_frames(file_path: str, duration: float, output_dir: str,
                        scene_threshold: float = 0.3, max_frames: int = 50,
                        min_gap: float = 5.0, dedup_threshold: int = 3) -> list[tuple[float, str]]:
    all_frames = []

    scene_frames = extract_scene_keyframes(file_path, output_dir, scene_threshold, max_frames)
    all_frames.extend(scene_frames)

    if duration and duration > 0:
        covered_times = sorted([ts for ts, _ in all_frames]) if all_frames else []

        if not covered_times:
            num_samples = min(int(duration / min_gap) + 1, max_frames)
            for i in range(num_samples):
                ts = (duration * i) / max(num_samples - 1, 1)
                frame_path = os.path.join(output_dir, f'uniform_{i:04d}.jpg')
                if extract_frame_at_time(file_path, ts, frame_path, width=640):
                    all_frames.append((ts, frame_path))
        else:
            if covered_times[0] > min_gap:
                num_gap = min(int(covered_times[0] / min_gap), 5)
                for i in range(num_gap):
                    ts = covered_times[0] * (i + 1) / (num_gap + 1)
                    frame_path = os.path.join(output_dir, f'gap_pre_{i:04d}.jpg')
                    if extract_frame_at_time(file_path, ts, frame_path, width=640):
                        all_frames.append((ts, frame_path))

            for i in range(len(covered_times) - 1):
                gap = covered_times[i+1] - covered_times[i]
                if gap > min_gap:
                    num_gap = min(int(gap / min_gap) - 1, 5)
                    for j in range(num_gap):
                        ts = covered_times[i] + gap * (j + 1) / (num_gap + 1)
                        frame_path = os.path.join(output_dir, f'gap_{i}_{j:04d}.jpg')
                        if extract_frame_at_time(file_path, ts, frame_path, width=640):
                            all_frames.append((ts, frame_path))

            if duration - covered_times[-1] > min_gap:
                remaining = duration - covered_times[-1]
                num_gap = min(int(remaining / min_gap), 5)
                for i in range(num_gap):
                    ts = covered_times[-1] + remaining * (i + 1) / (num_gap + 1)
                    frame_path = os.path.join(output_dir, f'gap_post_{i:04d}.jpg')
                    if extract_frame_at_time(file_path, ts, frame_path, width=640):
                        all_frames.append((ts, frame_path))

    all_frames.sort(key=lambda x: x[0])

    if len(all_frames) <= 1:
        return all_frames

    unique_frames = [all_frames[0]]
    prev_hash = compute_frame_hash(all_frames[0][1])

    for ts, frame_path in all_frames[1:]:
        curr_hash = compute_frame_hash(frame_path)
        if curr_hash and prev_hash and _hamming_distance(curr_hash, prev_hash) <= dedup_threshold:
            try:
                os.remove(frame_path)
            except OSError:
                pass
            continue
        unique_frames.append((ts, frame_path))
        prev_hash = curr_hash

    if len(unique_frames) > max_frames:
        step = len(unique_frames) / max_frames
        unique_frames = [unique_frames[int(i * step)] for i in range(max_frames)]

    return unique_frames


def _generate_animated_webp(file_path: str, thumb_dir: str, file_hash: str, duration: float) -> str | None:
    """Generate a short animated WebP preview (~2s at 8fps) for hover playback.
    Uses ffmpeg to extract frames, then PIL to compose animated WebP."""
    anim_path = Path(thumb_dir) / f"{file_hash}_anim.webp"
    if anim_path.exists():
        return f"/thumbnails/{file_hash}_anim.webp"

    seek_time = max(0, (duration * 0.1) - 1.0)
    clip_duration = min(2.0, max(duration - seek_time, 1.0))
    tmp_dir = Path(thumb_dir) / f"_anim_tmp_{file_hash}"
    try:
        tmp_dir.mkdir(parents=True, exist_ok=True)
        pattern = str(tmp_dir / "frame_%03d.jpg")
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-ss', str(seek_time),
            '-i', file_path,
            '-t', str(clip_duration),
            '-vf', 'fps=8,scale=320:-2',
            '-q:v', '5',
            pattern,
        ]
        result = subprocess.run(ffmpeg_cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            logger.warning(f"Animated WebP frame extraction failed: {result.stderr.decode()[:200]}")
            return None

        frame_files = sorted(tmp_dir.glob("frame_*.jpg"))
        if not frame_files:
            return None

        frames = []
        for fp in frame_files:
            try:
                img = Image.open(fp).convert("RGB")
                frames.append(img)
            except Exception:
                continue

        if len(frames) < 2:
            for f in frames:
                f.close()
            return None

        frames[0].save(
            str(anim_path),
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=125,
            loop=0,
            quality=75,
        )
        for f in frames:
            f.close()
        return f"/thumbnails/{file_hash}_anim.webp"
    except Exception as e:
        logger.warning(f"Animated WebP generation failed: {e}")
        return None
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def generate_video_thumbnail(file_path: str, thumb_dir: str):
    if not _check_ffprobe_available():
        logger.warning("ffprobe not available — skipping video metadata/thumbnail")
        return None, None
    if not _check_ffmpeg_available():
        logger.warning("ffmpeg not available — skipping video thumbnail")
        return None, None

    try:
        hasher = hashlib.md5()
        file_size = 0
        try:
            stat = os.stat(file_path)
            file_size = stat.st_size
            hasher.update(str(file_size).encode())
            with open(file_path, 'rb') as f:
                hasher.update(f.read(1024 * 1024))
        except Exception:
            hasher.update(file_path.encode())
        file_hash = hasher.hexdigest()

        static_path = Path(thumb_dir) / f"{file_hash}.webp"
        anim_url = f"/thumbnails/{file_hash}_anim.webp" if (Path(thumb_dir) / f"{file_hash}_anim.webp").exists() else None

        if static_path.exists():
            metadata = extract_video_metadata(file_path)
            metadata["hash"] = file_hash
            metadata["blur_score"] = None
            metadata["file_size"] = file_size
            metadata["animated_url"] = anim_url
            return metadata, f"/thumbnails/{file_hash}.webp"

        probe_cmd = [
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format', '-show_streams',
            file_path
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, timeout=30)
        if probe_result.returncode != 0:
            logger.error(f"ffprobe failed for {file_path}: {probe_result.stderr.decode()}")
            return None, None

        probe_data = json.loads(probe_result.stdout.decode())
        metadata = extract_video_metadata(file_path, probe_data)
        metadata["hash"] = file_hash
        metadata["blur_score"] = None
        metadata["file_size"] = file_size

        duration = metadata.get("duration") or 10.0
        seek_time = duration * 0.1

        single_frame_path = Path(thumb_dir) / f"{file_hash}_frame.jpg"
        webp_path = str(static_path)

        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-ss', str(seek_time),
            '-i', file_path,
            '-vframes', '1',
            '-vf', 'scale=400:-2',
            '-q:v', '3',
            str(single_frame_path)
        ]
        result = subprocess.run(ffmpeg_cmd, capture_output=True, timeout=120)
        if result.returncode != 0:
            logger.error(f"ffmpeg thumbnail failed for {file_path}: {result.stderr.decode()}")
            return metadata, None

        if not single_frame_path.exists():
            logger.warning(f"No frame extracted for {file_path}")
            return metadata, None

        try:
            img = Image.open(single_frame_path).convert("RGB")
            img.save(webp_path, format="WEBP", quality=80)
            img.close()
        except Exception as e:
            logger.error(f"Failed to save static thumbnail for {file_path}: {e}")
            return metadata, None
        finally:
            try:
                single_frame_path.unlink()
            except Exception:
                pass

        anim_url = _generate_animated_webp(file_path, thumb_dir, file_hash, duration)
        metadata["animated_url"] = anim_url

        return metadata, f"/thumbnails/{file_hash}.webp"

    except Exception as e:
        logger.error(f"Video thumbnail generation failed for {file_path}: {e}")
        return None, None
