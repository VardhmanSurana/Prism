# Prism Video Player — Architecture & Flow

> **Prism** is a local-first, privacy-focused photo/video library built with **React 18 + TypeScript + Tauri v2** (frontend) and **FastAPI + Python** (backend). The video player subsystem encompasses playback, GPU-accelerated rendering, a full Non-Linear Editor (NLE), proxy workflows, and FFmpeg/MLT-based export.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Frontend Architecture](#3-frontend-architecture)
   - 3.1 [VideoPlayer Component](#31-videoplayer-component)
   - 3.2 [WebGL Video Renderer](#32-webgl-video-renderer)
   - 3.3 [VideoFrame Decoder](#33-videoframe-decoder)
   - 3.4 [Audio Mixer](#34-audio-mixer)
   - 3.5 [Keyframe Engine](#35-keyframe-engine)
4. [NLE (Non-Linear Editor)](#4-nle-non-linear-editor)
   - 4.1 [Editor Mode Layout](#41-editor-mode-layout)
   - 4.2 [NLE Store (Zustand)](#42-nle-store-zustand)
   - 4.3 [Timeline Model](#43-timeline-model)
   - 4.4 [Track & Clip Operations](#44-track--clip-operations)
5. [Backend Architecture](#5-backend-architecture)
   - 5.1 [Video Streaming API](#51-video-streaming-api)
   - 5.2 [NLE Engine (MLT XML Generator)](#52-nle-engine-mlt-xml-generator)
   - 5.3 [NLE Preview Service](#53-nle-preview-service)
   - 5.4 [NLE Proxy Service](#54-nle-proxy-service)
   - 5.5 [Video Export Service](#55-video-export-service)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [File Map](#7-file-map)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRISM DESKTOP APP                           │
│                     (Tauri v2 + React 18)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  Lightbox     │   │  NLE Editor  │   │  WebGL Shader Mapper   │  │
│  │  VideoPlayer  │──▶│  VideoEditor │──▶│  (GPU Effects Render)  │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────────────────┘  │
│         │                   │                                        │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌────────────────────────┐  │
│  │ VideoFrame   │   │  NLE Store   │   │  Keyframe Engine       │  │
│  │ Decoder      │   │  (Zustand)   │   │  (Linear/Bezier/Ease)  │  │
│  └──────────────┘   └──────────────┘   └────────────────────────┘  │
│         │                   │                                        │
│  ┌──────▼───────────────────▼───────┐                               │
│  │       Audio Mixer (Web Audio)    │                               │
│  └──────────────────┬───────────────┘                               │
│                     │                                                │
├─────────────────────┼────────────────────────────────────────────────┤
│              FastAPI Backend (Python)                                 │
│                     │                                                │
│  ┌──────────┬───────┼───────┬──────────────┐                       │
│  │ Video    │ NLE   │ NLE   │ NLE Proxy    │                       │
│  │ Stream   │ Engine│ Preview│ Service     │                       │
│  │ (Range)  │(MLT)  │(melt) │ (ffmpeg)     │                       │
│  └──────────┴───────┴───────┴──────────────┘                       │
│                     │                                                │
│  ┌──────────────────▼──────────────┐                                │
│  │     Video Export (FFmpeg)        │                                │
│  └─────────────────────────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Shell | Tauri v2 | Native app wrapper, IPC, file dialogs |
| Frontend UI | React 18 + TypeScript | Component rendering, state |
| State Management | Zustand | NLE timeline state, editor UI |
| GPU Rendering | WebGL 1.0 | Real-time video effects/shaders |
| Frame Decoding | WebCodecs API | Frame-accurate scrubbing |
| Audio Mixing | Web Audio API | Multi-track audio gain/solo/mute |
| Animation | Framer Motion | UI transitions (lightbox open/close) |
| Backend API | FastAPI (Python) | REST endpoints, async I/O |
| Video Processing | FFmpeg / FFprobe | Proxy gen, export, transcoding |
| NLE Rendering | melt (MLT 7) | Timeline-to-video rendering |
| Preview Caching | Disk-based JPEG cache | Fast frame re-renders |

---

## 3. Frontend Architecture

### 3.1 VideoPlayer Component

**File:** `frontend/components/viewers/lightbox/VideoPlayer.tsx` (~789 lines)

The primary video player, rendered inside the Lightbox when a video asset is selected.

#### Key Responsibilities

- **Playback Control:** Play/pause, seek (±5s/10s), speed selection (0.25×–2×), volume, mute
- **Loading States:** Shows thumbnail + "Fetching data" badge while video loads; "Converting…" for transcoded content
- **Error Handling:** Displays error with retry button; distinguishes transcode failures, stalls, and codec issues
- **Auto-Hide Controls:** Controls fade after 3s of inactivity; reappear on mouse move
- **Keyboard Shortcuts:** Space (play/pause), ←/→ (seek ±5s), ↑/↓ (volume), F (fullscreen), M (mute), Esc (close)
- **Picture-in-Picture:** Native PiP toggle via `requestPictureInPicture()`
- **Fullscreen:** Double-click or F key; uses Fullscreen API

#### Props

```typescript
interface VideoPlayerProps {
  photo: Photo;       // Photo metadata (id, path, url, type, etc.)
  onClose?: () => void;
}
```

#### State Management

Uses a lightweight local reducer (`videoPlayerReducer`) for:
- `loadState`: `'loading' | 'ready' | 'error'`
- `isPlaying`, `currentTime`, `duration`
- `volume`, `isMuted`, `playbackRate`
- `showControls`, `showSpeedMenu`
- `isFullscreen`, `isPiP`
- `errorReason`: `'transcode' | 'stall' | 'codec' | null`

#### Video Source Resolution

```
photo.url → /api/v1/videos/stream?path=<encoded_path>
```

The backend streams the original file with HTTP range support (see §5.1).

#### Retry Mechanism

On error, clicking "Retry" triggers:
1. Increments `retryCount` (tracked via ref)
2. At retry 2: requests backend transcode via `/api/v1/video/convert`
3. At retry 3+: gives up with codec error
4. Reloads video `src` with cache-busting timestamp

---

### 3.2 WebGL Video Renderer

**File:** `frontend/lib/videoShaderMapper.ts` (~234 lines)

A custom WebGL renderer that applies real-time color correction and transform effects to video frames — all on the GPU.

#### Shader Pipeline

**Vertex Shader:**
```glsl
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
uniform mat3 u_matrix;
void main() {
  vec3 pos = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
```

**Fragment Shader (effects chain):**
1. **Brightness + Highlights** → additive luminance boost
2. **Contrast + Shadows** → midpoint expansion/compression
3. **Saturation** → luma-weighted interpolation
4. **Temperature** → red/blue channel shift (±100 range)
5. **Vignette** → radial darkening from edges
6. **Opacity** → alpha channel multiplication

#### Uniforms

| Uniform | Type | Range | Effect |
|---------|------|-------|--------|
| `u_brightness` | float | -100 to 100 | Overall luminance |
| `u_contrast` | float | -100 to 100 | Tonal range |
| `u_saturation` | float | -100 to 100 | Color intensity |
| `u_temperature` | float | -100 to 100 | Warm/cool shift |
| `u_highlights` | float | -100 to 100 | Bright area adjustment |
| `u_shadows` | float | -100 to 100 | Dark area adjustment |
| `u_vignette` | float | 0 to 100 | Edge darkening |
| `u_opacity` | float | 0 to 1 | Overall transparency |
| `u_matrix` | mat3 | — | 2D transform (scale, rotate, translate) |

#### Transform Matrix

The `buildTransformMatrix()` method constructs a 3×3 matrix from:
- `x`, `y` → pixel offset from center, converted to clip space
- `scaleX`, `scaleY` → independent axis scaling
- `rotation` → angle in degrees, converted to radians

```typescript
[
  sx*c,  sx*s,  0,
 -sy*s,  sy*c,  0,
  tx,    ty,    1
]
```

#### Rendering Flow

```
HTMLVideoElement / VideoFrame
        │
        ▼
  texImage2D()  ← upload frame to GPU texture
        │
        ▼
  Set uniforms (effects + transform)
        │
        ▼
  gl.drawArrays(TRIANGLES, 0, 6)  ← full-screen quad
        │
        ▼
  Canvas displays corrected frame
```

---

### 3.3 VideoFrame Decoder

**File:** `frontend/utils/videoFrameDecoder.ts` (~103 lines)

Wraps `HTMLVideoElement` to yield `WebCodecs VideoFrame` objects for frame-accurate scrubbing.

#### Key Design

- **Lazy Loading:** Waits for `loadedmetadata` before accepting seeks
- **Concurrency Control:** Only one seek in-flight at a time; rapid scrubbing queues the latest seek and discards intermediate ones
- **VideoFrame API:** Creates `new VideoFrame(videoElement)` after each seek completes — callers must `.close()` to release GPU memory

#### Flow

```
getFrame(time)
    │
    ├─ ensureLoaded() → wait for metadata
    │
    ├─ if seeking in progress → queue as pendingSeek
    │
    └─ performSeek(time)
         │
         ├─ video.currentTime = time
         ├─ wait for 'seeked' event
         ├─ new VideoFrame(video) → return to caller
         │
         └─ if pendingSeek queued → process next
```

---

### 3.4 Audio Mixer

**File:** `frontend/hooks/useAudioMixer.ts` (~95 lines)

Web Audio API-based multi-track audio mixer for the NLE timeline.

#### Architecture

```
HTMLVideoElement (per clip)
        │
  MediaElementAudioSourceNode
        │
    GainNode  ← per-clip volume (with keyframe evaluation)
        │
    MasterGainNode  ← global output
        │
    AudioContext.destination  ← speakers
```

#### Features

- **Per-clip volume** with keyframe interpolation (calls `evaluateKeyframes()`)
- **Track mute/solo** logic: if any track is solo'd, only solo'd non-muted clips play
- **Automatic cleanup:** disconnects nodes for clips that are removed from tracks
- **Resume on play:** calls `ctx.resume()` when playback starts (browser autoplay policy)

---

### 3.5 Keyframe Engine

**File:** `frontend/lib/keyframes.ts` (~94 lines)

Supports 5 interpolation modes for animated properties:

| Mode | Algorithm |
|------|-----------|
| `linear` | `lerp(a, b, t)` |
| `ease-in` | Quadratic acceleration (`t²`) |
| `ease-out` | Quadratic deceleration (`t(2-t)`) |
| `ease-in-out` | Smooth S-curve |
| `bezier` | Custom cubic bezier with binary-search parameterization |

#### Keyframe Type

```typescript
interface Keyframe {
  t: number;  // time in seconds (relative to clip start)
  v: number;  // value
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierCP?: { x1: number; y1: number; x2: number; y2: number };
}
```

#### Animated Properties

`opacity`, `scaleX`, `scaleY`, `rotation`, `volume`, `x`, `y`

#### Utility Functions

- `evaluateKeyframes(kfs, time)` → interpolated value at time
- `splitKeyframes(kfs, t)` → split into before/after at time (for clip splitting)
- `shiftKeyframes(kfs, delta)` → shift all keyframes by delta (for clip moving)

---

## 4. NLE (Non-Linear Editor)

### 4.1 Editor Mode Layout

**File:** `frontend/components/VideoEditing/VideoEditorMode.tsx` (~1233 lines)

Full-screen NLE overlay inspired by FarCut/OpenCut:

```
┌─────────────────────────────────────────────────────────┐
│  Back │ Project Name │ Undo/Redo │ Compare │ Save │ Export │
├───┬───────────┬───────────────────────┬─────────────────┤
│   │           │                       │                 │
│ S │  Assets   │    Preview Area       │   Inspector     │
│ I │  Panel    │    (WebGL Canvas)     │   Panel         │
│ D │           │                       │                 │
│ E │  - Adjust │                       │   - Transform   │
│ B │  - Text   │                       │   - Effects     │
│ A │  - Elements│                      │   - Keyframes   │
│ R │  - Effects│                       │   - Speed       │
│   │  - Trans. │                       │   - Audio       │
│   │  - Presets│                       │                 │
├───┴───────────┴───────────────────────┴─────────────────┤
│                      Timeline                            │
│  [Video 1] ═══════════════════════════════════════════   │
│  [Audio 1] ───────────────────────────────────────────   │
│  [Text 1]  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
└─────────────────────────────────────────────────────────┘
```

#### Left Sidebar Panels

| Panel | Purpose |
|-------|---------|
| `assets` | Import media from library, browse project assets |
| `adjust` | Color correction sliders (brightness, contrast, etc.) |
| `text` | Add text overlays |
| `elements` | Shape/element overlays |
| `effects` | Browse effect presets |
| `transitions` | Clip-to-clip transitions (crossfade, wipe, dissolve) |
| `presets` | Save/load effect presets |
| `settings` | Project resolution, FPS |

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←/→` | Seek ±1 frame |
| `S` | Split clip at playhead |
| `F` | Add freeze frame |
| `Delete/Backspace` | Remove selected clip |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy clip |
| `Ctrl+V` | Paste clip |
| `Ctrl+S` | Save project |
| `\` | Toggle before/after compare |
| `Esc` | Close editor |

#### Preview Area (`PreviewArea` sub-component)

Renders the active clip(s) at the current playhead position using:
1. **Proxy path** for smooth scrubbing (low-res)
2. **WebGL renderer** for real-time effects
3. **Compare mode** with draggable split (original vs. edited)

---

### 4.2 NLE Store (Zustand)

**File:** `frontend/store/nleStore.ts` (~1050 lines)

Central state manager for the entire NLE timeline.

#### State Shape

```typescript
{
  // Project
  projectId: number | null;
  projectName: string;
  projectWidth: number;    // default 1920
  projectHeight: number;   // default 1080
  projectFps: number;      // default 30
  isDirty: boolean;
  isSaving: boolean;

  // Timeline
  tracks: Track[];
  duration: number;
  playheadPosition: number;  // seconds
  zoomLevel: number;
  scrollOffset: number;

  // Selection
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // Playback
  isPlaying: boolean;

  // Undo/Redo
  _history: Track[][];       // max 30 snapshots
  _historyIndex: number;

  // Clipboard
  clipboardClip: Clip | null;

  // Bookmarks
  bookmarks: Bookmark[];

  // Project Assets
  projectAssets: ProjectAsset[];
}
```

#### Key Actions

| Category | Actions |
|----------|---------|
| **Project** | `loadProject()`, `saveProject()`, `createProject()` |
| **Timeline** | `addClip()`, `removeClip()`, `moveClip()`, `splitClip()`, `trimClip()` |
| **Clip Props** | `setClipSpeed()`, `setClipVolume()`, `setClipEffects()`, `setClipTransform()`, `setClipKeyframes()` |
| **Track** | `addTrack()`, `removeTrack()`, `reorderTrack()`, `toggleTrackMute/Solo/Visibility/Locked()` |
| **Playback** | `play()`, `pause()`, `seek()` |
| **Undo** | `pushHistory()`, `undo()`, `redo()` |
| **Bookmarks** | `addBookmark()`, `removeBookmark()`, `updateBookmark()` |

#### Undo/Redo System

- Snapshots are deep-cloned `Track[]` arrays stored in `_history`
- Max 30 history entries (FIFO eviction)
- Every mutating action calls `pushHistorySnapshot()` before applying changes

#### Auto-Save

- Saves every 30 seconds when `isDirty` is true
- Also saves on `Ctrl+S` and on editor close

---

### 4.3 Timeline Model

**File:** `frontend/types/nle.ts` (~173 lines)

#### NLEProject

```typescript
interface NLEProject {
  id: number;
  name: string;
  width: number;           // canvas width
  height: number;          // canvas height
  fps: number;             // frames per second
  cover_photo_id?: number;
  project_json?: TimelineState;
  created_at: string;
  updated_at: string;
}
```

#### Track

```typescript
interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  muted: boolean;
  solo: boolean;
  visible: boolean;
  locked: boolean;
  color?: string;
  clips: Clip[];
}
```

#### Clip

```typescript
interface Clip {
  id: string;
  sourceId: number;          // photo ID in library
  sourcePath: string;        // absolute file path
  proxyPath?: string;        // low-res proxy path
  sourceDuration: number;    // total source duration (seconds)

  // Timeline position (frames)
  startFrame: number;
  durationFrames: number;

  // Source trim (seconds)
  inPoint: number;
  outPoint: number;

  // Playback
  speed: number;             // 0.25 – 4.0
  volume: number;            // 0.0 – 1.0
  muted: boolean;
  fadeIn: number;            // seconds
  fadeOut: number;           // seconds

  // Visual
  effects: ClipEffects;
  transform: ClipTransform;
  keyframes: Record<string, Keyframe[]>;

  // Text overlay (for text tracks)
  text?: TextOverlay;

  // Transitions
  transition?: Transition;

  // Linked clips (move together)
  linkedId?: string;
}
```

#### ClipEffects

```typescript
interface ClipEffects {
  brightness: number;     // -100 to 100
  contrast: number;       // -100 to 100
  saturation: number;     // -100 to 100
  temperature: number;    // -100 to 100
  highlights: number;     // -100 to 100
  shadows: number;        // -100 to 100
  sharpness: number;      // -100 to 100
  vignette: number;       // 0 to 100
  noiseReduction: number; // 0 to 100
}
```

#### ClipTransform

```typescript
interface ClipTransform {
  x: number;         // pixel offset from center
  y: number;
  scaleX: number;    // 1.0 = 100%
  scaleY: number;
  rotation: number;  // degrees
  opacity: number;   // 0 – 1
}
```

#### Transition Types

`crossfade` | `wipe-left` | `wipe-right` | `dissolve` | `slide-left` | `slide-right`

---

### 4.4 Track & Clip Operations

#### Clip Splitting

```
Original Clip:  [──────────────────────]
                         ↑ split at time T

Result:
  Clip 1:       [────────]
  Clip 2:                [─────────────]

Keyframes are split at T; Clip 2's keyframes are time-shifted.
```

#### Clip Trimming

- **In-point trim:** Adjusts `startFrame`, `durationFrames`, and `inPoint`
- **Out-point trim:** Adjusts `durationFrames` and `outPoint`

#### Clip Movement

- Snap to playhead, other clip boundaries (5-frame threshold)
- Prevents overlap on target track
- Linked clips move by the same frame delta

#### Freeze Frame

Splits the clip at the playhead and inserts a still-frame segment (source frozen at that frame).

---

## 5. Backend Architecture

### 5.1 Video Streaming API

**File:** `backend/app/api/video/video_proxy.py` (~127 lines)

HTTP range-request streaming for local video files.

#### Endpoint

```
GET /api/v1/videos/stream?path=<encoded_file_path>
```

#### Features

- **Range requests (HTTP 206):** Supports `bytes=START-END` for seeking
- **CORS:** Allows `tauri://localhost`, `http://tauri.localhost`, `http://localhost:3005`
- **Chunked streaming:** 1MB chunks for memory efficiency
- **MIME detection:** Auto-detects from file extension
- **Security:** `safe_resolve_read()` validates paths (prevents path traversal)

---

### 5.2 NLE Engine (MLT XML Generator)

**File:** `backend/app/services/nle_engine.py` (~681 lines)

Converts the Prism NLE project JSON into **MLT XML** that `melt` can render.

#### Architecture

```
Project JSON (from frontend)
        │
        ▼
    Timeline parser
    ├── Track → Track objects
    ├── Clip → Clip objects (normalize keys)
    └── Effects → Effect dicts
        │
        ▼
    MLTBuilder
    ├── Pass 1: Create producers (one per clip)
    │   ├── avformat producer (video source)
    │   ├── speed filter
    │   ├── text overlay filter
    │   ├── keyframe animation filters
    │   └── effects filters
    ├── Pass 2: Create playlists (one per track)
    └── Pass 3: Create tractor (combines tracks)
        │
        ▼
    MLT XML string → melt CLI → output video
```

#### Effects → MLT Filter Mapping

| Prism Effect | MLT Filter | Parameters |
|-------------|------------|------------|
| brightness | `brightness` | level = value/100 * 0.3 |
| contrast | `gamma` | factor = 1.25 - value * 0.0075 |
| saturation | `frei0r.sopsat` | saturation = 1 + value/100 * 0.6 |
| temperature | `color_balance` | red/blue shift |
| vignette | `vignette` | radius = 1 - value/100 * 0.5 |
| sharpness | `unsharp` | amount = value/100 * 3.0 |
| noiseReduction | `avfilter_nlmeans` | s = value/100 * 5.0 |
| highlights | `lift_gamma_gain` | gain channel |
| shadows | `lift_gamma_gain` | lift channel |

#### Keyframe → MLT Animation

Maps Prism properties to MLT animated properties:

| Prism Property | MLT Filter | MLT Property |
|---------------|------------|--------------|
| opacity | `alpha` | level |
| scaleX/scaleY | `affine` | scale |
| rotation | `affine` | angle |
| x/y | `affine` | rect |
| volume | `volume` | level |

---

### 5.3 NLE Preview Service

**File:** `backend/app/services/nle_preview.py` (~261 lines)

Generates preview frames and short segments using the `melt` CLI.

#### Capabilities

| Method | Output | Use Case |
|--------|--------|----------|
| `generate_frame()` | JPEG bytes | Single frame at playhead position |
| `generate_segment()` | MP4 file | Short preview clip (3s default) |
| `extract_waveform()` | `float[]` | Audio waveform peaks for timeline visualization |

#### Frame Rendering Pipeline

```
project_json
    │
    ▼
project_to_mlt_xml() → MLT XML
    │
    ▼
Write temp .mlt file
    │
    ▼
melt <file.mlt> -consumer avformat:<output.jpg> profile=640x360
    │
    ▼
Read JPEG bytes → cache to disk → return
```

#### Caching

- SHA-256 hash of `(project_id, time, width, height, effects_hash)` → cache key
- Cached as `<key>.jpg` in `DATA_DIR/nle_cache/`
- Auto-cleanup when cache exceeds 500MB (LRU eviction)

---

### 5.4 NLE Proxy Service

**File:** `backend/app/services/nle_proxy.py` (~208 lines)

Generates low-resolution proxy files for smooth timeline scrubbing.

#### Proxy Settings

| Parameter | Value |
|-----------|-------|
| Resolution | 640 × 360 |
| Video Codec | libx264 |
| CRF | 28 (lower quality for speed) |
| Audio Codec | AAC @ 64kbps |
| Container | MP4 (faststart) |

#### Proxy Generation Flow

```
source_path
    │
    ▼
validate_source_path() → security check
    │
    ▼
Check if proxy exists (MD5 hash of path)
    │
    ├─ Yes → return cached proxy path
    │
    └─ No → ffmpeg:
         -i <source>
         -vf scale=640:360 (pad to maintain aspect)
         -c:v libx264 -preset fast -crf 28
         -c:a aac -b:a 64k
         -movflags +faststart
         → <proxy_path>
```

#### Thumbnail Strip

`generate_thumbnail_strip()` extracts N evenly-spaced JPEG thumbnails for timeline filmstrip visualization.

---

### 5.5 Video Export Service

**File:** `backend/app/services/video_export.py` (~215 lines)

FFmpeg-based multi-track video export.

#### Endpoints

```
POST /api/v1/video/export          → Start export, returns job_id
GET  /api/v1/video/export/{id}     → Check status/progress
GET  /api/v1/video/export/{id}/download → Download completed MP4
```

#### Export Request Model

```python
class ExportRequest:
    tracks: list[ExportTrack]       # video + audio + text tracks
    resolution: (1920, 1080)        # output resolution
    fps: 30
    format: "mp4"
```

#### FFmpeg Command Builder

The exporter constructs complex `ffmpeg` commands:

```
1. Input files: -i <source> for each clip
2. Video filters: trim, setpts (speed), concat
3. Audio filters: atrim, asetpts, atempo, volume, amix
4. Text overlays: drawtext with position, font, timing
5. Encoding: libx264 (fast, CRF 23), AAC (192k)
6. Output: MP4 with faststart
```

#### Concurrency

- Max 3 simultaneous exports
- Auto-cleanup of export files > 1 hour old
- Job status tracked in memory (`_jobs` dict)

---

## 6. Data Flow Diagrams

### 6.1 Video Playback Flow (Lightbox)

```
User clicks video in gallery
        │
        ▼
Lightbox detects isVideo=true
        │
        ▼
Renders <VideoPlayer photo={photo} />
        │
        ▼
VideoPlayer resolves source:
  /api/v1/videos/stream?path=<path>
        │
        ▼
Backend: safe_resolve_read() → validate path
        │
        ▼
Backend: Stream file with range support (206)
        │
        ▼
HTMLVideoElement loads & plays
        │
        ├─ On load → state.loadState = 'ready'
        ├─ On error → retry logic (up to 3 attempts)
        └─ On timeupdate → update currentTime display
```

### 6.2 NLE Editing Flow

```
User clicks "Edit" on video in Lightbox
        │
        ▼
Lightbox opens VideoEditorMode overlay
        │
        ▼
VideoEditorMode mounts:
  1. POST /api/v1/nle/clips/analyze → get clip metadata
  2. GET /api/v1/nle/projects?cover_photo_id=X → check for existing project
  3. If exists → loadProject() into NLE store
     If new → createProject() → add initial clip
        │
        ▼
NLE Store initialized with tracks/clips
        │
        ▼
User edits timeline:
  - Drag clips → moveClip()
  - Split → splitClip()
  - Adjust effects → setClipEffects()
  - Add keyframes → setClipKeyframes()
        │
        ▼
Preview updates in real-time:
  1. activeClips computed from playhead position
  2. PreviewArea renders clip with WebGL effects
  3. Audio mixer updates gain nodes
        │
        ▼
Auto-save every 30s → PUT /api/v1/nle/projects/{id}
```

### 6.3 Export Flow

```
User clicks "Export"
        │
        ▼
ExportDialog opens → user selects resolution/format
        │
        ▼
POST /api/v1/video/export
  body: { tracks, resolution, fps, format }
        │
        ▼
Backend validates source paths
        │
        ▼
VideoExporter.start_export():
  1. Create job_id
  2. Spawn asyncio task → _render()
        │
        ▼
_render():
  1. Build ffmpeg command from tracks
  2. Execute: asyncio.create_subprocess_exec()
  3. Monitor process completion
        │
        ├─ Success → status = "completed"
        └─ Failure → status = "failed", store error
        │
        ▼
Frontend polls GET /api/v1/video/export/{job_id}
  → Shows progress bar
  → On completion: download link appears
        │
        ▼
GET /api/v1/video/export/{job_id}/download
  → FileResponse (MP4)
```

### 6.4 WebGL Effects Rendering Flow

```
Playhead moves → activeClip identified
        │
        ▼
Evaluate keyframes at current time:
  opacity = evaluateKeyframes(clip.keyframes['opacity'], t)
  scaleX  = evaluateKeyframes(clip.keyframes['scaleX'], t)
  ...
        │
        ▼
WebGLVideoRenderer.render(
  source: HTMLVideoElement | VideoFrame,
  effects: clip.effects,
  transform: clip.transform,
  canvasWidth, canvasHeight
)
        │
        ▼
GPU Pipeline:
  1. Upload frame as texture (texImage2D)
  2. Set effect uniforms (brightness, contrast, etc.)
  3. Build transform matrix (scale, rotate, translate)
  4. Draw full-screen quad (6 vertices, 2 triangles)
        │
        ▼
Canvas displays rendered frame
```

---

## 7. File Map

### Frontend

| File | Purpose |
|------|---------|
| `components/viewers/lightbox/VideoPlayer.tsx` | Main video player with controls |
| `components/viewers/lightbox/Filmstrip.tsx` | Bottom thumbnail strip for navigation |
| `components/viewers/lightbox/types.ts` | TypeScript interfaces for lightbox props |
| `components/viewers/Lightbox.tsx` | Lightbox container (dispatches to VideoPlayer or ImageDisplay) |
| `components/VideoEditing/VideoEditorMode.tsx` | Full-screen NLE editor |
| `store/videoPlayerStore.ts` | Lightweight video player state (if used) |
| `store/nleStore.ts` | Central NLE Zustand store |
| `types/nle.ts` | All NLE type definitions |
| `lib/videoShaderMapper.ts` | WebGL renderer with GLSL shaders |
| `lib/videoFilterMapper.ts` | Maps filter presets to shader uniforms |
| `lib/keyframes.ts` | Keyframe interpolation engine |
| `hooks/useAudioMixer.ts` | Web Audio API multi-track mixer |
| `hooks/useLightboxGestures.ts` | Pinch/zoom/drag gestures for lightbox |
| `utils/videoFrameDecoder.ts` | WebCodecs VideoFrame decoder |

### Backend

| File | Purpose |
|------|---------|
| `app/api/video/video_proxy.py` | HTTP range-request video streaming |
| `app/api/video/export.py` | Export API endpoints |
| `app/api/nle/clips.py` | NLE clip analysis endpoint |
| `app/api/nle/projects.py` | NLE project CRUD endpoints |
| `app/api/nle/preview.py` | NLE preview frame endpoint |
| `app/api/nle/export.py` | NLE-specific export endpoint |
| `app/services/nle_engine.py` | Project JSON → MLT XML translator |
| `app/services/nle_preview.py` | Preview frame/segment generation (melt) |
| `app/services/nle_proxy.py` | Low-res proxy generation (ffmpeg) |
| `app/services/video_export.py` | Multi-track FFmpeg export |

---

*Generated from Prism source code analysis — `/home/chotaxdon/Work/Projects/Prism/`*
