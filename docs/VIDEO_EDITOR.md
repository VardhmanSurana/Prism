# Prism Video Editor (NLE)

Comprehensive documentation for the Prism non-linear video editor (NLE), covering the timeline, preview, inspector, panels, export, and technical architecture.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Editor Layout](#editor-layout)
- [Timeline](#timeline)
- [Preview Area](#preview-area)
- [Inspector Panel](#inspector-panel)
- [Left Sidebar Panels](#left-sidebar-panels)
- [Multi-Cam Mode](#multi-cam-mode)
- [Export](#export)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Backend APIs](#backend-apis)

---

## Overview

The Prism video editor is a full-featured non-linear editing (NLE) workspace built into the desktop application. It provides multi-track timeline editing, real-time preview, effects, transitions, keyframe animation, and local export.

### Key Features

- **Non-destructive editing**: All edits are stored in a project JSON blob, preserving source media
- **Multi-track timeline**: Video, audio, text, and effect tracks
- **Real-time preview**: WebGL-accelerated video rendering with shader effects
- **Keyframe animation**: Animate transforms, effects, and properties over time
- **Multi-cam editing**: Switch between up to 4 camera angles
- **Proxy workflow**: Generate lower-resolution proxies for smooth editing
- **Export**: Local composition export with configurable settings

### File Locations

| Component | Path |
|-----------|------|
| Main editor | `frontend/components/Editor/VideoEditor/VideoEditorMode.tsx` |
| Timeline | `frontend/components/Editor/VideoEditor/Timeline/` |
| Preview area | `frontend/components/Editor/VideoEditor/PreviewArea.tsx` |
| Inspector panel | `frontend/components/Editor/VideoEditor/InspectorPanel/` |
| Left sidebar | `frontend/components/Editor/VideoEditor/LeftSidebar.tsx` |
| Export dialog | `frontend/components/Editor/VideoEditor/ExportDialog.tsx` |
| Editor utilities | `frontend/components/Editor/VideoEditor/editorUtils.ts` |
| Store | `frontend/store/nleStore.ts` |
| Types | `frontend/types/nle.ts` |
| Backend APIs | `backend/app/api/nle/` |
| Backend engine | `backend/app/services/nle_engine.py` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React NLE UI                           │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │ Zustand  │  │ Timeline │  │ Inspector  │            │
│  │ (NLE     │  │ Component│  │ Panel      │            │
│  │  Store)  │  └──────────┘  └────────────┘            │
│  └────┬─────┘                                           │
│       │ REST API                                         │
└───────┼─────────────────────────────────────────────────┘
        │
┌───────┴─────────────────────────────────────────────────┐
│                  FastAPI Backend                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │ NLE APIs │  │ NLE      │  │ Video      │            │
│  │ (clips,  │  │ Engine   │  │ Export     │            │
│  │ projects)│  │          │  │ Service    │            │
│  └──────────┘  └──────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### Data Model

```
VideoProject
├── id: int (PK)
├── name: string
├── cover_photo_id: FK → Photo
├── width: int (default: 1920)
├── height: int (default: 1080)
├── fps: int (default: 30)
├── project_json: Text (JSON blob - timeline state)
├── created_at: datetime
└── updated_at: datetime

VideoClip
├── id: int (PK)
├── photo_id: FK → Photo (nullable)
├── source_path: string
├── duration: float
├── width: int
├── height: int
├── fps: float (nullable)
├── codec: string (nullable)
├── has_audio: bool
├── proxy_path: string (nullable)
├── proxy_status: string (pending/ready/failed)
└── audio_waveform_json: Text (nullable)

Clip (runtime, in project_json)
├── id: string (UUID)
├── sourceId: int (VideoClip id)
├── sourcePath: string
├── proxyPath: string (optional)
├── sourceDuration: float
├── startFrame: int
├── durationFrames: int
├── inPoint: float
├── outPoint: float
├── speed: float (0.25 - 4.0)
├── volume: float (0.0 - 2.0)
├── muted: bool
├── fadeIn: float
├── fadeOut: float
├── effects: ClipEffects
├── transform: ClipTransform
├── keyframes: Record<string, Keyframe[]>

Track (runtime, in project_json)
├── id: string
├── type: "video" | "audio" | "text" | "effect"
├── name: string
├── visible: bool
├── locked: bool
└── clips: Clip[]
```

---

## Editor Layout

```
┌─────────────────────────────────────────────────────────┐
│  Top Bar (Back, Project Name, Save, Export, Undo/Redo)  │
├────┬──────────┬──────────────────────┬──────────────────┤
│    │          │                      │                  │
│ I  │  Assets  │    Preview Area      │   Inspector      │
│ c  │  Panel   │    (WebGL renderer)  │   Panel          │
│ o  │          │                      │   (Effects,      │
│ n  │          │                      │    Transforms,   │
│    │          │                      │    Keyframes)    │
│ S  │          │                      │                  │
│ i  │          │                      │                  │
│ d  │          │                      │                  │
│ e  │          │                      │                  │
│ b  │          │                      │                  │
│ a  │          │                      │                  │
│ r  │          │                      │                  │
├────┴──────────┴──────────────────────┴──────────────────┤
│                     Timeline                             │
│  (Multi-track, clips, playhead, ruler, zoom controls)    │
└─────────────────────────────────────────────────────────┘
```

---

## Timeline

**File**: `Timeline/Timeline.tsx`, `Timeline/index.tsx`, `Timeline/components/`

The timeline is the primary editing interface, built from multiple sub-components.

### Components

| Component | File | Description |
|-----------|------|-------------|
| `Timeline` | `Timeline.tsx` | Main timeline container |
| `TrackLanes` | `components/TrackLanes.tsx` | Vertical track lanes |
| `ClipElement` | `components/ClipElement.tsx` | Individual clip on a track |
| `Playhead` | `components/Playhead.tsx` | Current position indicator |
| `Ruler` | `components/Ruler.tsx` | Time ruler with timecodes |
| `ClipDragLayer` | `components/ClipDragLayer.tsx` | Drag-and-drop overlay |
| `ToolButton` | `components/ToolButton.tsx` | Timeline tool buttons |

### Features

- **Multi-track**: Video, audio, text, and effect tracks
- **Clip operations**: Select, move, trim, split, delete, copy/paste
- **Snapping**: Snap to playhead, clip edges, and markers
- **Zoom**: Horizontal zoom in/out for detailed editing
- **Ruler**: Timecode display with configurable frame rate
- **Playhead**: Draggable position indicator with real-time update
- **Waveform**: Audio waveform visualization (from `audio_waveform_json`)

### Track Types

| Type | Description | Behavior |
|------|-------------|----------|
| `video` | Video clips | Rendered in preview, supports transforms |
| `audio` | Audio clips | Not rendered visually, affects audio mix |
| `text` | Text overlays | Rendered as text layers in preview |
| `effect` | Effect layers | Applies effects to layers below |

### Clip Operations

| Operation | Action |
|-----------|--------|
| Select | Click on clip |
| Move | Drag clip horizontally (time) or vertically (track) |
| Trim | Drag clip edges |
| Split | `S` key at playhead position |
| Delete | `Delete` or `Backspace` |
| Copy/Paste | `Ctrl+C` / `Ctrl+V` |
| Freeze frame | `F` key at playhead position |

---

## Preview Area

**File**: `PreviewArea.tsx`

The preview area renders the edited video in real-time using WebGL acceleration.

### Rendering Pipeline

```
Source Video → WebGL Video Renderer → Shader Effects → Preview Canvas
     │                    │
     ├── Proxy path       ├── Transforms (position, scale, rotation)
     │   (if available)   ├── Effects (brightness, contrast, etc.)
     └── Source path      └── Keyframe interpolation
```

### WebGL Video Renderer

- **File**: `frontend/lib/videoShaderMapper.ts`
- **Purpose**: GPU-accelerated video rendering with real-time shader effects
- **Features**:
  - YUV to RGB color space conversion
  - Per-pixel effect application via GLSL shaders
  - Transform matrix multiplication
  - Multi-layer compositing

### Controls

- **Play/Pause**: Space bar or on-screen button
- **Seek**: Click on timeline or preview area
- **Speed**: Playback speed control via clip speed property
- **Compare mode**: `\` key to toggle before/after comparison

### Compare Mode

Toggle a vertical split-screen view showing:
- **Left**: Original (unprocessed) video
- **Right**: Edited video with all effects applied
- **Slider**: Drag the divider to compare different sections

---

## Inspector Panel

**File**: `InspectorPanel/InspectorPanel.tsx`

The right-side inspector panel provides detailed control over the selected clip's properties.

### Tabs

#### Effects Tab

Controls per-clip video effects:

| Effect | Range | Description |
|--------|-------|-------------|
| Brightness | -100 to +100 | Overall brightness adjustment |
| Contrast | -100 to +100 | Contrast enhancement |
| Saturation | -100 to +100 | Color saturation |
| Temperature | -100 to +100 | White balance (warm/cool) |
| Highlights | -100 to +100 | Highlight region adjustment |
| Shadows | -100 to +100 | Shadow region adjustment |
| Sharpness | 0 to +100 | Sharpening filter |
| Vignette | 0 to +100 | Darken edges |
| Noise Reduction | 0 to +100 | Denoise filter |

#### Transform Tab

Controls clip position, scale, and rotation:

| Property | Description |
|----------|-------------|
| Position X/Y | Clip position on canvas |
| Scale | Width/height scale factor |
| Rotation | Rotation angle in degrees |
| Anchor | Transform origin point |
| Opacity | Clip transparency |

#### Keyframe Editor Tab

**File**: `InspectorPanel/KeyframeEditor.tsx`

Keyframe animation system supporting:

- **Add keyframe**: Set a property value at the current playhead position
- **Remove keyframe**: Delete a keyframe at the current position
- **Navigate**: Jump to previous/next keyframe
- **Interpolation**: Linear or bezier curve interpolation between keyframes
- **Easing**: Ease-in, ease-out, and ease-in-out options

#### Color Presets Tab

**File**: `InspectorPanel/ColorPresets.tsx`

Apply predefined color grading presets:

- Cinematic looks (teal/orange, warm, cool)
- Vintage styles (sepia, retro, film)
- Creative presets (dramatic, soft, vibrant)

---

## Left Sidebar Panels

**File**: `LeftSidebar.tsx`

The vertical icon sidebar provides access to 8 panels:

| Panel | File | Description |
|-------|------|-------------|
| Assets | `AssetsPanel.tsx` | Media browser to add clips to timeline |
| Adjust | `AdjustPanel.tsx` | Quick adjustment controls |
| Text | `TextPanel.tsx` | Text overlay creation and editing |
| Elements | `ElementsPanel.tsx` | Shapes, graphics, and overlays |
| Effects | `EffectsBrowserPanel.tsx` | Effect browser and presets |
| Transitions | `TransitionsPanel.tsx` | Transition effects between clips |
| Presets | `PresetsPanel.tsx` | Save/load effect presets |
| Settings | `SettingsPanel.tsx` | Project settings (resolution, FPS) |

### Assets Panel

- Browse imported videos from the library
- Preview clips before adding to timeline
- Drag and drop clips onto tracks
- Filter by recently imported, favorites, or search

### Text Panel

- Add text overlays to the timeline
- Customize font family, size, color, alignment
- Text animation presets (fade in/out, slide, typewriter)
- Background box with opacity control

### Elements Panel

- Add shapes (rectangle, circle, triangle, star)
- Import images as overlay elements
- Custom borders and shadows
- Element animations

### Effects Browser Panel

- Browse categorized video effects
- Preview effects on a sample clip
- Drag and drop effects onto clips
- Customize effect parameters

### Transitions Panel

- Cross dissolve, fade to black, fade to white
- Slide, push, wipe transitions
- Custom transition duration
- Apply between clips or to clip edges

---

## Multi-Cam Mode

**File**: `MulticamGrid.tsx`

Multi-cam editing supports up to 4 camera angles synchronized by timecode.

### Features

- **Grid view**: See up to 4 camera feeds simultaneously
- **Angle switching**: Press 1/2/3/4 to switch the active camera angle
- **Auto-sync**: Clips are aligned by timecode when added to multi-cam groups
- **Cut indicators**: Visual markers showing where angles were switched

### Workflow

1. Enable Multi-Cam mode from the top bar
2. Add clips from multiple camera angles to the timeline
3. Each camera angle appears as a separate track
4. During playback, press 1/2/3/4 to switch angles
5. Angle switches create cuts at the playhead position

---

## Export

**File**: `ExportDialog.tsx`, `backend/app/api/video/export.py`, `backend/app/services/video_export.py`

### Export Settings

| Setting | Options |
|---------|---------|
| Format | MP4, MOV, MKV |
| Resolution | Project resolution or custom |
| Frame rate | Project FPS or custom |
| Quality | Low, Medium, High, Custom |
| Bitrate | CBR or VBR |
| Codec | H.264, H.265 (NVENC/VAAPI when available) |
| Audio | AAC, MP3, or disabled |

### GPU Encoding

- **NVENC**: NVIDIA hardware encoding (when `ENABLE_GPU_ENCODING=True` and `GPU_ENCODING_MODE=nvenc`)
- **VAAPI**: Intel/AMD hardware encoding
- **CPU**: Software encoding fallback

### Export Pipeline

1. Timline state is serialized from `project_json`
2. ffmpeg command is constructed based on export settings
3. Source clips are decoded, effects applied, transitions rendered
4. Proxy files are used if available (faster source decoding)
5. Final composition is encoded to the selected format
6. Progress is reported via SSE events

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` `→` | Step frame backward/forward |
| `S` | Split clip at playhead |
| `F` | Add freeze frame at playhead |
| `Delete` / `Backspace` | Delete selected clip |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy selected clip |
| `Ctrl+V` | Paste clip |
| `Ctrl+S` | Save project |
| `\` | Toggle before/after comparison |
| `1` `2` `3` `4` | Switch multi-cam angle |
| `Escape` | Close editor |

---

## Backend APIs

**Directory**: `backend/app/api/nle/`

| Endpoint | File | Description |
|----------|------|-------------|
| `POST /api/v1/nle/clips/analyze` | `clips.py` | Analyze a video file and create a VideoClip record |
| `GET /api/v1/nle/projects` | `projects.py` | List projects, optionally filtered by cover_photo_id |
| `POST /api/v1/nle/projects` | `projects.py` | Create a new video project |
| `GET /api/v1/nle/projects/{id}` | `projects.py` | Get project details including full project_json |
| `PUT /api/v1/nle/projects/{id}` | `projects.py` | Update project (save timeline state) |
| `POST /api/v1/nle/export` | `export.py` | Start a video export job |
| `GET /api/v1/nle/export/{id}/status` | `export.py` | Check export progress |
| `GET /api/v1/nle/proxy` | `video_proxy.py` | Serve proxy video files |
| `GET /api/v1/video/export` | `video/export.py` | Video export endpoints |
| `POST /api/v1/video/subtitles` | `video/subtitles.py` | Generate subtitles for video assets |

### Services

| Service | File | Description |
|---------|------|-------------|
| NLE Engine | `services/nle_engine.py` | Core NLE logic (timeline processing, clip analysis) |
| NLE Preview | `services/nle_preview.py` | Preview generation and caching |
| NLE Proxy | `services/nle_proxy.py` | Proxy file management |
| Video Export | `services/video_export.py` | ffmpeg-based video export |
| Subtitle Gen | `services/subtitle_gen.py` | Whisper-based subtitle generation |
