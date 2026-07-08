# Prism NLE Video Editor — Architecture Plan

## Executive Summary

Add a full Non-Linear Editor to Prism as a full-screen overlay (like the existing `EditingMode` photo editor), entering from the Lightbox when a user clicks Edit on a video. The NLE provides a multi-track timeline, clip trimming/splitting, effects with ffmpeg-backed preview, text overlays, transitions, audio editing, and non-destructive export. All heavy processing runs server-side via the existing FastAPI backend + ffmpeg; the frontend is a React timeline UI with a Zustand state store.

---

## 1. Data Model

### 1.1 SQLite Tables

All new tables use SQLAlchemy ORM matching the existing `models.py` pattern (DeclarativeBase, `Mapped[]` columns). Tables are created via `Base.metadata.create_all` in the lifespan startup, following the dynamic-migration pattern already in `main.py:53-131`.

```python
# backend/app/models.py — new models appended

class VideoProject(Base):
    """A non-destructive edit project referencing one or more source clips."""
    __tablename__ = "video_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc),
                                                  onupdate=lambda: datetime.now(timezone.utc))
    # Target output settings
    width: Mapped[int] = mapped_column(Integer, default=1920)
    height: Mapped[int] = mapped_column(Integer, default=1080)
    fps: Mapped[int] = mapped_column(Integer, default=30)
    # Reference to the first clip's photo (for thumbnail / entry point)
    cover_photo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("photos.id", ondelete="SET NULL"), nullable=True)
    # Full timeline state stored as JSON blob for simplicity and fast iteration
    timeline_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class VideoClip(Base):
    """A source media file reference used in projects. Created once per unique source path."""
    __tablename__ = "video_clips"

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("photos.id", ondelete="SET NULL"), nullable=True, index=True)
    source_path: Mapped[str] = mapped_column(String(1024))
    duration: Mapped[float] = mapped_column(Float)  # full original duration
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    fps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    has_audio: Mapped[bool] = mapped_column(Boolean, default=True)
    audio_waveform_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # pre-computed waveform peaks


# Junction: many-to-many between projects and clips, with per-instance editing state
class ProjectClip(Base):
    """Each instance of a clip placed on the timeline."""
    __tablename__ = "project_clips"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("video_projects.id", ondelete="CASCADE"), index=True)
    clip_id: Mapped[int] = mapped_column(
        ForeignKey("video_clips.id", ondelete="CASCADE"), index=True)
    # Position on the timeline
    track_index: Mapped[int] = mapped_column(Integer, default=0)  # 0 = main video track
    track_type: Mapped[str] = mapped_column(String(20), default="video")  # video | audio | text
    start_time: Mapped[float] = mapped_column(Float, default=0)  # position on timeline (seconds)
    # Trim handles (relative to source)
    trim_start: Mapped[float] = mapped_column(Float, default=0)
    trim_end: Mapped[float] = mapped_column(Float, default=0)  # seconds trimmed from end
    speed: Mapped[float] = mapped_column(Float, default=1.0)
    volume: Mapped[float] = mapped_column(Float, default=1.0)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    # Fade in/out in seconds
    fade_in: Mapped[float] = mapped_column(Float, default=0)
    fade_out: Mapped[float] = mapped_column(Float, default=0)
    # Per-clip effects stored as JSON (reuses Adjustments shape from filterEngine.ts)
    effects_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Text overlay properties (for text track type)
    text_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Transition to next clip
    transition_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # null | "crossfade"
    transition_duration: Mapped[float] = mapped_column(Float, default=0)
    # Ordering within the track
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
```

### 1.2 Timeline JSON Shape (stored in `video_projects.timeline_json`)

Rather than splitting every UI nuance into SQL columns, the project stores a canonical JSON timeline that the frontend edits and the backend reads for export. The SQL columns above provide indexed queryability for common operations (search by clip, duration calculations), while the JSON blob is the source of truth for the full state.

```typescript
// frontend/types/nle.ts

interface TimelineState {
  tracks: Track[];
  duration: number;           // computed: max end time across all tracks
  playheadPosition: number;   // current playhead time in seconds
  zoomLevel: number;          // pixels per second
  scrollOffset: number;       // horizontal scroll in px
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
}

interface Clip {
  id: string;
  sourceClipId: number;       // FK to video_clips.id
  sourcePath: string;
  sourceDuration: number;
  // Timeline position
  startFrame: number;          // in timeline frames
  durationFrames: number;      // visible duration on timeline
  // Source trim
  inPoint: number;             // source time offset (seconds)
  outPoint: number;            // source end point (seconds) = inPoint + durationFrames/fps
  // Playback
  speed: number;
  volume: number;              // 0-1
  muted: boolean;
  fadeIn: number;              // seconds
  fadeOut: number;             // seconds
  // Visual
  effects: Adjustments;       // reuse the existing Adjustments type from filterEngine.ts
  // Text track specific
  text?: TextOverlay;
  // Transition
  transition?: {
    type: 'crossfade';
    duration: number;          // seconds
  };
}

interface TextOverlay {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  x: number;                  // percentage 0-100
  y: number;
  start: number;              // seconds within clip
  end: number;
}
```

### 1.3 Key Design Decision: JSON Timeline Blob

**Why JSON blob instead of fully normalized SQL?**
- The existing `VideoExporter` already accepts a flat `ExportRequest` with tracks/clips — the JSON maps 1:1 to this.
- Timeline editing is a single-user, single-session operation — no concurrent editing, no need for SQL indexing on clip properties.
- Avoids N+1 joins for rendering the timeline (one read gets everything).
- The normalized columns (`ProjectClip`) exist for quick queries like "which projects use this clip?" and for future features (media library panel).
- The JSON blob is the authoritative state; the SQL rows are derived/cached for queries.

---

## 2. Backend API Design

### 2.1 New Endpoints

All new endpoints go under `backend/app/api/nle/` following the pattern of `backend/app/api/video/`.

```
POST   /api/v1/nle/projects                        → Create project
GET    /api/v1/nle/projects                        → List projects
GET    /api/v1/nle/projects/{id}                   → Get project with full timeline JSON
PUT    /api/v1/nle/projects/{id}                   → Save/update project
DELETE /api/v1/nle/projects/{id}                   → Delete project

POST   /api/v1/nle/clips/analyze                   → Analyze source file (probe metadata, generate waveform)
POST   /api/v1/nle/clips/waveform                  → Get audio waveform peaks for a source path
POST   /api/v1/nle/clips/thumbnail-strip           → Get N thumbnails for a source clip (for timeline scrubbing)

POST   /api/v1/nle/preview                         → Generate a preview frame at a specific timeline position
POST   /api/v1/nle/preview/segment                 → Generate a short preview segment (e.g., 3s around playhead)
POST   /api/v1/nle/preview/stream                  → SSE endpoint streaming preview frames during playback

POST   /api/v1/nle/export                          → Start export job (reuses existing VideoExporter pattern)
GET    /api/v1/nle/export/{job_id}                 → Poll export status
GET    /api/v1/nle/export/{job_id}/download         → Download completed export
```

### 2.2 Preview Generation Strategy

**Three tiers of preview quality, used at different moments:**

#### Tier 1: Source-only playback (no effects, no multi-clip)
- For single clips with no effects applied, play the source file directly via `<video src="...">` — zero server involvement.
- This is the fast path. When the user hasn't applied any effects or transitions, the frontend plays the source file and syncs the playhead via the timeline UI.

#### Tier 2: Server-side frame extraction (effects applied, static preview)
- When the user pauses and adjusts an effect slider, the frontend sends a `POST /preview` request with:
  ```json
  {
    "timeline": { ... },  // full timeline JSON
    "time": 5.2,          // the playhead position
    "width": 640,         // preview resolution (lower than output)
    "height": 360
  }
  ```
- Backend builds a temporary ffmpeg filter graph for that single frame:
  ```
  ffmpeg -ss <time> -i <source> -vf "<effects_chain>" -frames:v 1 -f imagejpeg pipe:1
  ```
- Returns a JPEG frame. Cached by (project_id, time, effects_hash) to avoid recomputation when the user scrubs back to the same position.
- Implemented in `backend/app/services/nle_preview.py`.

#### Tier 3: SSE streaming preview (real-time playback with effects)
- For playback with effects, backend generates frames as a rapid sequence via `POST /preview/stream` SSE endpoint.
- Uses ffmpeg's `-re` flag to output frames at real-time rate to stdout.
- Frontend reads SSE events containing base64 JPEG frames and paints them to a `<canvas>` at the video framerate.
- Falls back to Tier 2 (frame-by-frame polling) if the server can't keep up.
- **This is a stretch goal for Phase 4+. Phase 1-2 use Tier 1+2 only.**

```python
# backend/app/services/nle_preview.py

class NLEPreviewService:
    """Generate preview frames and segments for the NLE timeline."""

    async def generate_frame(self, timeline: dict, time: float, width: int, height: int) -> bytes:
        """Single frame at timeline position. Returns JPEG bytes."""
        cmd = self._build_preview_command(timeline, time, width, height, frames=1)
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await process.communicate()
        return stdout

    async def generate_segment(self, timeline: dict, start: float, duration: float,
                                width: int, height: int, on_frame=None) -> str:
        """Short video segment. Returns path to temp mp4."""
        cmd = self._build_preview_command(timeline, start, width, height, duration=duration)
        # Run and return path
        ...

    def _build_preview_command(self, timeline, time, width, height, frames=1, duration=None):
        """Build ffmpeg command from timeline state."""
        # Find which clips are active at `time`, build filter_complex
        # Apply per-clip effects (reuse Adjustments → ffmpeg filter mapping)
        # Handle transitions (xfade filter)
        # Handle text overlays (drawtext filter)
        # Map audio with volume/fade
        ...
```

### 2.3 Extending VideoExporter

The existing `VideoExporter._build_ffmpeg_command` at `backend/app/services/video_export.py:56-157` already handles:
- Multi-input video clips with `trim`, `setpts` for speed
- Audio tracks with `atrim`, `asetpts`, `atempo`, `volume`
- Text overlays via `drawtext`
- Video concat via `concat` filter
- Audio mix via `amix`

**Extensions needed:**

```python
# In _build_ffmpeg_command, extend the clip filter chain:

# 1. Per-clip effects (brightness, contrast, saturation, etc.)
#    Map Adjustments → ffmpeg eq/colorbalance/colorshift filters
def _effects_to_filters(self, effects_json: str) -> list[str]:
    """Convert Adjustments JSON to ffmpeg filter strings."""
    effects = json.loads(effects_json) if effects_json else {}
    filters = []
    if effects.get("brightness", 0) != 0:
        eq_val = effects["brightness"] / 100 * 0.5  # map -100..100 to eq range
        filters.append(f"eq=brightness={eq_val}")
    if effects.get("contrast", 0) != 0:
        ct = effects["contrast"] / 100 * 0.5 + 1
        filters.append(f"eq=contrast={ct}")
    if effects.get("saturation", 0) != 0:
        sat = effects["saturation"] / 100 * 0.5 + 1
        filters.append(f"eq=saturation={sat}")
    if effects.get("temperature", 0) != 0:
        temp = effects["temperature"]
        # colorbalance: positive = warm (more red/yellow), negative = cool (more blue)
        r = temp / 200
        b = -temp / 200
        filters.append(f"colorbalance=rs={r}:bs={b}")
    if effects.get("vignette", 0) != 0:
        vig = effects["vignette"] / 100 * 0.5
        filters.append(f"vignette=PI/{4 - vig}")
    if effects.get("highlights", 0) != 0:
        # Use curves for highlights/shadows
        ...
    if effects.get("clarity", 0) != 0:
        # unsharp mask approximates clarity
        amount = effects["clarity"] / 100 * 3
        filters.append(f"unsharp=5:5:{amount}:5:5:0")
    if effects.get("sharpness", 0) != 0:
        amount = effects["sharpness"] / 100 * 2
        filters.append(f"unsharp=5:5:{amount}:5:5:0")
    if effects.get("noiseReduction", 0) != 0:
        strength = effects["noiseReduction"] / 100 * 5
        filters.append(f"nlmeans=s={strength}")
    return filters

# 2. Fade in/out per clip
#    After trim/speed, append: fade=t=in:st=0:d=<fade_in>,fade=t=out:st=<start>:d=<fade_out>

# 3. Crossfade transitions between clips
#    Replace simple concat with xfade filter for adjacent clips with transitions:
#    [v0][v1]xfade=transition=fade:duration=0.5:offset=<offset>[outv]

# 4. HSL per-band via colorchannelmixer + hue=s= for individual bands
```

### 2.4 Waveform Extraction

```python
# backend/app/services/nle_preview.py

async def extract_waveform(source_path: str, num_points: int = 2000) -> list[float]:
    """Extract audio waveform peaks for visualization."""
    cmd = [
        "ffmpeg", "-i", source_path,
        "-ac", "1",  # mono
        "-filter:a", f"aresample=8000,asetnsamples=n={num_points}",
        "-f", "f32le", "-",
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, _ = await process.communicate()
    import struct
    samples = struct.unpack(f"<{len(stdout)//4}f", stdout)
    # Normalize to 0-1 peaks
    max_val = max(abs(s) for s in samples) or 1
    return [abs(s) / max_val for s in samples]
```

### 2.5 Export Job Management

Reuse the existing pattern from `video_export.py` (in-memory `_jobs` dict + `asyncio.create_task`), but with the NLE timeline as the source:

```python
# backend/app/api/nle/export.py

class NLEExportRequest(BaseModel):
    project_id: int
    resolution: tuple[int, int] = (1920, 1080)
    fps: int = 30
    format: str = "mp4"  # mp4 | webm | mov
    quality: str = "high"  # low | medium | high | custom
    output_mode: str = "new"  # "new" or "overwrite"
    overwrite_path: Optional[str] = None  # path to original file if overwrite

@router.post("/export")
async def start_nle_export(req: NLEExportRequest):
    # Load project timeline from DB
    # Build ExportRequest compatible with existing VideoExporter
    # Start export job
    ...
```

---

## 3. Frontend Architecture

### 3.1 Component Hierarchy

```
Lightbox.tsx
  └── [isEditing && photo.type === 'video']
        └── VideoEditorMode (NEW — full-screen overlay, like EditingMode)
              ├── NLETopBar
              │     ├── Undo/Redo buttons
              │     ├── Project name (editable)
              │     ├── Export button
              │     └── Close button
              ├── PreviewArea
              │     ├── VideoCanvas (renders preview frames via <canvas>)
              │     ├── TransportControls (play/pause, skip, frame step)
              │     └── TimeDisplay (current time / total duration)
              ├── Timeline
              │     ├── TimelineToolbar (add clip, split, delete, zoom slider)
              │     ├── TimeRuler (frame/tick marks)
              │     ├── TrackHeader (per-track: name, mute, solo, lock, type icon)
              │     ├── TrackContent (scrollable area)
              │     │     ├── ClipElement (draggable, resizable clip on track)
              │     │     │     ├── ClipThumbnails (filmstrip thumbnails inside clip)
              │     │     │     ├── WaveformOverlay (for audio clips)
              │     │     │     └── TransitionBadge (between clips)
              │     │     └── Playhead (vertical line, draggable)
              │     └── ZoomControl (zoom slider for timeline scale)
              └── InspectorPanel
                    ├── ClipProperties (trim handles, speed, volume, fade)
                    ├── EffectsPanel (reuses AdjustPanel + HslPanel + DetailPanel from photo editor)
                    ├── TextPanel (text overlay editor for text tracks)
                    └── TransitionPanel (crossfade duration)
```

### 3.2 Entry Point: Lightbox Integration

Modify `frontend/components/viewers/Lightbox.tsx` to detect video type and route to the NLE:

```typescript
// In Lightbox.tsx, replace the isEditing block (line 269-318):

const [isEditing, setIsEditing] = useState(false);
const [isVideoEditing, setIsVideoEditing] = useState(false);

// In Toolbar callback:
onEdit={() => {
  if (isVideo) {
    setIsVideoEditing(true);   // → opens NLE
  } else {
    setIsEditing(true);         // → opens photo editor (existing)
  }
}}

// In render:
{isVideoEditing && (
  <VideoEditorMode
    photo={photo}
    photos={photos}
    onClose={() => setIsVideoEditing(false)}
  />
)}
{isEditing && !isVideo && (
  <EditingMode ... />
)}
```

### 3.3 State Management: Zustand Store

```typescript
// frontend/store/nleStore.ts

import { create } from 'zustand';

interface NLEProject {
  id: number;
  name: string;
  timeline: TimelineState;
  isDirty: boolean;
  isSaving: boolean;
  // UI state
  selectedClipId: string | null;
  selectedTrackId: string | null;
  isPlaying: boolean;
  playheadTime: number;
  zoomLevel: number;       // pixels per second
  scrollOffset: number;
  // Preview state
  previewMode: 'source' | 'frame' | 'stream';
  previewFrameUrl: string | null;
  previewFrameTime: number | null;
}

interface NLEStore extends NLEProject {
  // Project actions
  loadProject: (projectId: number) => Promise<void>;
  saveProject: () => Promise<void>;
  createProject: (photo: Photo) => Promise<number>;

  // Timeline mutations
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId: string) => void;
  splitClip: (clipId: string, atTime: number) => void;
  trimClip: (clipId: string, side: 'in' | 'out', newPoint: number) => void;

  // Clip properties
  setClipSpeed: (clipId: string, speed: number) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  setClipMuted: (clipId: string, muted: boolean) => void;
  setClipEffects: (clipId: string, effects: Adjustments) => void;
  setClipFadeIn: (clipId: string, duration: number) => void;
  setClipFadeOut: (clipId: string, duration: number) => void;
  setClipTransition: (clipId: string, type: string | null, duration: number) => void;

  // Track actions
  addTrack: (type: 'video' | 'audio' | 'text') => void;
  removeTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;

  // Playback
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  stepFrame: (direction: 1 | -1) => void;

  // Selection
  selectClip: (clipId: string | null) => void;

  // Computed
  getTimelineDuration: () => number;
  getClipsAtTime: (time: number) => Clip[];
  toExportRequest: () => ExportRequest;
}
```

**What stays in local state vs Zustand:**

| Zustand (nleStore) | Local React state |
|---|---|
| Timeline tracks/clips (source of truth) | Inspector panel form values (debounced → Zustand) |
| Playhead position | Drag state (clip dragging, trimming) |
| Selected clip/track | Timeline scroll position (high-frequency, non-persisted) |
| Project metadata (name, id, dirty flag) | Preview canvas rendering state |
| Undo/redo history | Tooltip/popover visibility |
| Zoom level | |

### 3.4 Timeline Component Design

The timeline is the most performance-critical UI component. Key approach:

```
Timeline
├── TimeRuler          ← pure divs, one per tick, position: absolute
├── TrackHeaders       ← fixed width left column, scroll-synchronized with TrackContent
└── TrackContent       ← overflow-x: auto, position: relative container
      ├── ClipElement  ← position: absolute, left: startTime * zoom, width: duration * zoom
      │   └── inner: CSS background with thumbnail strip or waveform
      └── Playhead     ← position: absolute, left: playheadTime * zoom
```

**Performance strategy:**
- **No virtualization needed for Phase 1-2**: A typical NLE project has < 50 clips. DOM nodes are fine.
- **CSS transforms for playhead**: `transform: translateX()` on a single div, updated via `requestAnimationFrame` during playback. No React re-renders during playback.
- **Clip thumbnails**: Pre-extracted on clip import (`/clips/thumbnail-strip`), rendered as a CSS `background-image` with `background-size` and `background-position` shifting — one element per clip, not per thumbnail.
- **Waveform**: Pre-extracted peaks stored as JSON array. Rendered via `<canvas>` inside each clip element, drawn once on mount, redrawn only when clip boundaries change.
- **Zoom**: CSS `transform: scaleX()` on the TrackContent container. Only re-layout at the boundaries of zoom changes.
- **Drag operations**: Use pointer events + `transform: translateX()` during drag. Commit to store on `pointerup`. No re-renders during drag.

### 3.5 Preview Player

```typescript
// frontend/components/VideoEditing/PreviewArea.tsx

// Strategy:
// 1. When no effects on current clip → play source file directly via <video>
// 2. When effects present → server-side frame extraction, painted to <canvas>
// 3. For export → all processing server-side

const PreviewArea: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);

  // Determine which clip is at the playhead
  const activeClip = useNLEStore(s => s.getActiveClipAtPlayhead());
  const hasEffects = activeClip ? !isDefaultAdjustments(activeClip.effects) : false;

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      if (hasEffects || activeClip?.transition) {
        // Server-side frame: request frame from /preview, paint to canvas
        requestPreviewFrame(playheadTime).then(frame => {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx && frame) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = URL.createObjectURL(frame);
          }
        });
      } else {
        // Source playback: sync playhead to <video> currentTime
        if (videoRef.current) {
          seek(playheadTime);
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, hasEffects, playheadTime]);
```

### 3.6 Audio Waveform Visualization

Waveform data is extracted server-side via `POST /clips/waveform` and cached in `video_clips.audio_waveform_json`. The frontend renders it inside each audio/video clip on the timeline:

```typescript
// frontend/components/VideoEditing/WaveformDisplay.tsx

// Renders a <canvas> with peaks as bars or lines.
// Props: peaks: number[], clipWidth: number, clipHeight: number, color: string

// Drawing approach:
// 1. Canvas fills the clip element's width
// 2. Each peak = one vertical bar, centered vertically
// 3. Bars are drawn with requestAnimationFrame for smooth reveal during trim
// 4. Uses devicePixelRatio for crisp rendering on HiDPI
// 5. Clip waveform is split at trim points — only visible portion is drawn
```

### 3.7 Effects Panel Architecture

The photo editor's existing panels (`AdjustPanel`, `HslPanel`, `DetailPanel`, `PortraitPanel`, `SelectivePanel`) can be directly reused inside the NLE inspector by parameterizing them with the selected clip's `effects` state:

```typescript
// In InspectorPanel.tsx:

import { AdjustPanel } from '@/components/Editing/AdjustPanel';
import { HslPanel } from '@/components/Editing/HslPanel';
import { DetailPanel } from '@/components/Editing/DetailPanel';
import { isDefaultAdjustments } from '@/components/Editing/filterEngine';

const InspectorPanel: React.FC = () => {
  const selectedClip = useNLEStore(s => s.getSelectedClip());
  const setClipEffects = useNLEStore(s => s.setClipEffects);

  if (!selectedClip) return <EmptyState />;

  return (
    <div className="w-72 border-l border-white/10 overflow-y-auto">
      <ClipProperties clip={selectedClip} />

      {/* Reuse photo editor panels — they just need Adjustments + onChange */}
      <AdjustPanel
        adjustments={selectedClip.effects}
        onChange={(adj) => setClipEffects(selectedClip.id, adj)}
      />
      <HslPanel
        adjustments={selectedClip.effects}
        onChange={(adj) => setClipEffects(selectedClip.id, adj)}
      />
      <DetailPanel
        adjustments={selectedClip.effects}
        onChange={(adj) => setClipEffects(selectedClip.id, adj)}
      />
    </div>
  );
};
```

This reuses ~2000 lines of existing UI code without modification.

### 3.8 Undo/Redo

The photo editor uses a linear `HistoryEntry[]` with snapshots. The NLE needs a different pattern because timeline mutations are structural (add/remove/move clips), not just value changes.

```typescript
// frontend/store/nleHistory.ts

interface NLEHistoryEntry {
  id: string;
  timestamp: number;
  type: 'add_clip' | 'remove_clip' | 'move_clip' | 'split_clip' | 'trim_clip' |
        'change_effects' | 'change_volume' | 'change_speed' | 'add_track' | 'remove_track' |
        'add_transition' | 'change_text';
  description: string;
  snapshot: TimelineState;  // full timeline snapshot for undo
}

// Store last 50 actions. Undo = restore previous snapshot. Redo = re-apply.
// Use structured clone for deep copy of timeline state.
```

---

## 4. Phase Breakdown

### Phase 1: MVP — Single Clip Editing (4-5 weeks)
**Deliverable:** Click "Edit" on a video → opens NLE overlay with one clip on timeline, playhead, transport controls, basic effects, and export.

- Backend:
  - `VideoProject`, `VideoClip`, `ProjectClip` models + migration
  - `POST /nle/projects` (create from photo), `GET/PUT /nle/projects/{id}`
  - `POST /nle/clips/analyze` (ffprobe metadata + waveform)
  - `POST /nle/preview` (single frame with effects)
  - Extend `VideoExporter` with per-clip effects filter chain + fade in/out
  - `POST /nle/export` + status/download endpoints
- Frontend:
  - `VideoEditorMode` full-screen overlay, routed from Lightbox
  - `nleStore` with timeline state, undo/redo
  - `PreviewArea` with source playback + canvas frame fallback
  - Minimal `Timeline` with single track, single clip, playhead
  - `InspectorPanel` with clip properties (trim, speed, volume, fade)
  - Effects panel (reuse AdjustPanel + HslPanel from photo editor)
  - Export dialog (resolution, fps, quality, save as/overwrite)
- Integration:
  - Lightbox routes videos to NLE instead of photo editor
  - Tauri dialog for save-as file picker (existing pattern from `Lightbox.tsx:285`)

### Phase 2: Multi-Clip Assembly (3-4 weeks)
**Deliverable:** Drag multiple videos onto timeline, reorder, trim handles, split at playhead.

- Backend:
  - `POST /nle/clips/thumbnail-strip` (extract N thumbnails for timeline scrubbing)
  - Extend preview to handle multi-clip timeline (find active clip at time, build correct filter chain)
  - Extend export for multi-clip concat with transitions
- Frontend:
  - "Add Clip" button → opens file picker / media browser (list of user's videos from Prism library)
  - `ClipElement` with draggable + resizable trim handles (pointer events based)
  - Split at playhead: `S` keyboard shortcut
  - Clip reordering via drag within track
  - Timeline zoom control (buttons + scroll wheel)
  - Time ruler with tick marks
  - Keyboard shortcuts: Space (play/pause), Left/Right arrows (frame step), Delete (remove clip)

### Phase 3: Audio Editing + Waveforms (2-3 weeks)
**Deliverable:** Waveform visualization, per-clip volume, mute, fade in/out, audio track separation.

- Backend:
  - Waveform peak extraction (cache in DB)
  - Extend preview/export for audio fades and volume
- Frontend:
  - `WaveformDisplay` component inside audio/video clips
  - Volume slider per clip in inspector
  - Mute toggle per clip and per track
  - Fade in/out handles on clip edges (visual indicators)
  - Audio track visual distinction (different color per track type)

### Phase 4: Text Overlays + Transitions (2-3 weeks)
**Deliverable:** Text track with titles/captions, crossfade transitions between clips.

- Backend:
  - Extend preview with `drawtext` filter for text at specific timeline positions
  - Extend export with `xfade` filter for crossfade transitions
- Frontend:
  - Text track creation and editing
  - `TextPanel` in inspector (font, size, color, position, timing)
  - Visual text preview on canvas
  - Transition badges between clips (click to set type/duration)
  - Crossfade preview during scrub

### Phase 5: Advanced Effects + Polish (2-3 weeks)
**Deliverable:** Full effects parity with photo editor, curves, split toning, presets, selective adjustments.

- Backend:
  - Implement all Adjustment types as ffmpeg filters (curves via LUT, split toning via colorbalance, etc.)
  - Higher-quality preview rendering
- Frontend:
  - Full effect panels (all 12 tools from photo editor)
  - Effect presets for video (same presets.ts from photo editor)
  - Before/after comparison toggle
  - Better drag-and-drop UX, snap-to-clip, ripple editing

### Phase 6: Real-Time Preview + Performance (3-4 weeks)
**Deliverable:** Smooth playback with effects applied, streaming preview, performance optimization.

- Backend:
  - SSE streaming preview endpoint (frames at real-time rate)
  - Ffmpeg GPU acceleration (NVENC/CUDA) if available
  - Preview cache invalidation by effects hash
- Frontend:
  - Canvas-based streaming frame renderer
  - `requestAnimationFrame` playhead sync
  - Performance monitoring (drop frame detection)
  - Timeline virtualization for large projects (100+ clips)

---

## 5. Key Technical Decisions

### 5.1 Preview Frame Generation

**Decision:** Two-mode preview — source playback for clean clips, server-side frame extraction for clips with effects.

**Rationale:** Most editing sessions involve adjusting effects on a paused frame. Full real-time playback with effects (Tier 3 SSE streaming) is a Phase 6 optimization. The common case (scrub, pause, adjust slider, see result) is served well by single-frame extraction with caching.

**Cache key:** `sha256(project_id + time + effects_json + resolution)`. Stored in `settings.DATA_DIR / "nle_cache"`. Evicted when project is deleted or when cache exceeds 500MB.

### 5.2 Real-Time Playback with Effects

**Decision:** For Phase 1-5, playback with effects falls back to lower-resolution frame-by-frame extraction at 15fps. Phase 6 introduces true streaming.

**Fallback chain:**
1. If source clip has no effects → play source `<video>` directly (full quality, native framerate)
2. If effects present, preview resolution → 640x360, target 15fps via `/preview/stream` SSE
3. If server can't keep up → drop to 1fps frame updates on pause/seek

### 5.3 Timeline UI Rendering

**Decision:** Pure DOM (divs with absolute positioning) for Phase 1-5. Canvas rendering only for waveform display.

**Rationale:** With < 50 clips, DOM is fast enough and far easier to debug/interact with than canvas. Clip elements are simple colored rectangles with thumbnail strips (CSS background). Playhead is a single absolutely-positioned div animated via `transform: translateX()` without React re-renders (direct DOM manipulation via ref).

**When to switch to canvas:** Only if profiling shows DOM layout as a bottleneck with 100+ clips (Phase 6).

### 5.4 ffmpeg Filter Graph from Frontend Effects

**Decision:** A dedicated `adjustmentsToFilters(effects: Adjustments) -> string[]` function maps the frontend `Adjustments` type to ffmpeg filter strings. This is the inverse of the CSS `toFilterString()` already in `filterEngine.ts`.

```typescript
// frontend/lib/videoFilterMapper.ts

export function adjustmentsToFFmpegFilters(adj: Adjustments): string[] {
  const filters: string[] = [];

  // Brightness → eq filter
  if (adj.brightness !== 0) {
    filters.push(`eq=brightness=${adj.brightness / 100 * 0.3}`);
  }

  // Contrast → eq filter
  if (adj.contrast !== 0) {
    filters.push(`eq=contrast=${1 + adj.contrast / 100 * 0.5}`);
  }

  // Saturation → eq filter
  if (adj.saturation !== 0) {
    filters.push(`eq=saturation=${1 + adj.saturation / 100 * 0.6}`);
  }

  // Temperature → colorbalance
  if (adj.temperature !== 0) {
    const r = adj.temperature / 200;
    const b = -adj.temperature / 200;
    filters.push(`colorbalance=rs=${r.toFixed(3)}:bs=${b.toFixed(3)}`);
  }

  // Highlights → curves
  if (adj.highlights !== 0 || adj.shadows !== 0 || adj.whites !== 0 || adj.blacks !== 0) {
    const points = buildCurvePoints(adj);
    filters.push(`curves=${points}`);
  }

  // Vignette
  if (adj.vignette !== 0) {
    const angle = Math.PI / (4 - adj.vignette / 100 * 2);
    filters.push(`vignette=angle=${angle.toFixed(3)}`);
  }

  // Sharpness → unsharp
  if (adj.sharpness > 0) {
    const amount = adj.sharpness / 100 * 3;
    filters.push(`unsharp=5:5:${amount.toFixed(2)}:5:5:0`);
  }

  // Noise reduction → nlmeans
  if (adj.noiseReduction > 0) {
    const strength = adj.noiseReduction / 100 * 5;
    filters.push(`nlmeans=s=${strength.toFixed(1)}`);
  }

  // Clarity → unsharp (mid-tone contrast)
  if (adj.clarity !== 0) {
    const amount = adj.clarity / 100 * 4;
    filters.push(`unsharp=7:7:${amount.toFixed(2)}:7:7:0`);
  }

  // HSL per-band → individual hue/saturation adjustments
  if (adj.hsl) {
    for (const [band, values] of Object.entries(adj.hsl)) {
      if (values.hue !== 0 || values.saturation !== 0 || values.luminance !== 0) {
        const hueRange = HSL_BAND_RANGES[band]; // {min, max} hue degrees
        filters.push(`hue=s=${1 + values.saturation / 100}:h=${values.hue}`);
      }
    }
  }

  return filters;
}
```

This function lives on both frontend (for preview request building) and backend (for export filter construction), ensuring consistency. The backend version reads the same `effects_json` and applies the same mapping.

### 5.5 Non-Destructive Editing

**Decision:** All edits stored as project data. Original files are never modified.

- Source clips referenced by path in `video_clips.source_path`
- The `VideoExporter` reads source files and applies all transformations during export
- Export creates a new file (or overwrites, user choice) but source files remain untouched
- Project can be reopened and all edits are preserved
- `timeline_json` is the single source of truth; `project_clips` rows are derived cache

### 5.6 File Structure Summary

```
backend/app/
  models.py                    # Add VideoProject, VideoClip, ProjectClip
  api/nle/
    __init__.py                # Router aggregation
    projects.py                # CRUD for projects
    clips.py                   # Analyze, waveform, thumbnails
    preview.py                 # Frame/segment generation
    export.py                  # Export job management
  services/
    nle_preview.py             # Preview frame/segment generation
    nle_filter_builder.py      # Adjustments → ffmpeg filter graph
    video_export.py            # Extend with effects, fades, transitions

frontend/
  types/nle.ts                 # TimelineState, Track, Clip, TextOverlay types
  store/nleStore.ts            # Zustand store for NLE state
  store/nleHistory.ts          # Undo/redo for timeline
  lib/videoFilterMapper.ts     # Adjustments → ffmpeg filter strings
  components/VideoEditing/
    VideoEditorMode.tsx        # Full-screen overlay entry point
    NLETopBar.tsx              # Top toolbar (undo, save, export, close)
    PreviewArea.tsx            # Video preview (video element + canvas)
    TransportControls.tsx      # Play/pause, skip, frame step
    Timeline/
      Timeline.tsx             # Main timeline container
      TimeRuler.tsx            # Tick marks and time labels
      TrackHeader.tsx          # Track name, mute, solo, lock
      TrackContent.tsx         # Scrollable clip area
      ClipElement.tsx          # Draggable/resizable clip
      ClipThumbnails.tsx       # Filmstrip thumbnails inside clip
      WaveformDisplay.tsx      # Canvas-based waveform
      TransitionBadge.tsx      # Transition indicator between clips
      Playhead.tsx             # Vertical playhead line
      ZoomControl.tsx          # Timeline zoom slider
    InspectorPanel/
      InspectorPanel.tsx       # Right-side property panel
      ClipProperties.tsx       # Trim, speed, volume, fade
      EffectsTab.tsx           # Wraps photo editor panels
      TextTab.tsx              # Text overlay editor
      TransitionTab.tsx        # Transition settings
    ExportDialog.tsx           # Export settings modal
    MediaBrowser.tsx           # Video file picker (list from Prism library)
```

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Real-time preview latency | High — poor UX during effect adjustment | Frame caching, lower preview resolution, progressive quality |
| ffmpeg filter graph complexity | Medium — hard to debug | Dedicated filter builder with unit tests, log full command in dev mode |
| Large timeline JSON in DB | Low — SQLite handles 100KB+ blobs fine | Cap timeline JSON at 1MB, archive old projects |
| Multi-track audio mixing quality | Medium — amix has known issues | Use `amerge` + `pan` for specific use cases, test with real content |
| Canvas waveform performance | Low — peaks are small data | Pre-compute, cache, only redraw on trim |
| Tauri file dialog for import | Low — already used in photo editor save-as | Reuse existing `@tauri-apps/plugin-dialog` pattern |

---

## 7. Testing Strategy

- **Backend unit tests**: `adjustmentsToFFmpegFilters()` mapping, waveform extraction, preview frame generation
- **Backend integration tests**: Full export pipeline with multi-clip + effects, using temp video files
- **Frontend component tests**: Timeline clip rendering, drag/trim interactions, undo/redo
- **E2E tests**: Create project → add clip → apply effect → export → verify output with ffprobe
- **Manual testing**: Full workflow from lightbox entry through export with real video files

---

*Architecture plan complete. Ready for implementation starting with Phase 1.*
