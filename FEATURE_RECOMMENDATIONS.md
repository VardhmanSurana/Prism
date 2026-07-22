# Prism Feature Recommendation Report

## Executive Summary
This report analyzes the current state of the Prism application across its major departments, identifying architectural strengths, weaknesses, and opportunities for enhancement. The recommendations are grounded in the existing capabilities of the codebase (React, TypeScript, Tauri, FastAPI, Zustand) and prioritized using ICE (Impact, Confidence, Ease) scoring.

---

## 1. Image Editor (`frontend/components/Editor/ImageEditor/`)

### A. Current State Assessment
- **Features**: Comprehensive non-destructive adjustment engine (`filterEngine.ts`), Curves, HSL, Split Toning, Grain, Light Leaks, Tilt-Shift, Vignette, Borders, Annotations, and Inpainting.
- **Architecture**: Leverages WebGL/Canvas with fallbacks to CSS and complex SVG filters (e.g., in `CanvasArea.tsx`). A central state object (`Adjustments`) drives the real-time preview.
```typescript
// Evidence from frontend/components/Editor/ImageEditor/filterEngine.ts
export interface Adjustments {
  brightness:  number; // -100 → 100
  contrast:    number; // -100 → 100
  exposure:    number; // -100 → 100
  // ... HSL, curves, splitToning, grain, lightLeak, etc.
}
```
- **Strengths**: Robust feature set rivaling professional tools; performant real-time preview pipeline.
- **Weaknesses**: Heavy reliance on SVG filters can become a performance bottleneck for very high-res images; lacks layer-based compositing for complex edits.

### B. Feature Recommendations

1. **Advanced Healing Brush / Clone Stamp** ✅ IMPLEMENTED
   - **Description**: Manual texture replication and healing beyond generative inpaint.
   - **User Problem**: Users need to quickly remove small blemishes without invoking heavy AI models.
   - **Implementation**: New `HealingCanvas.tsx` + `HealingPanel.tsx` with session-only Canvas2D overlay. Alt+Click sets source point, then paint to clone. 'Clone & Heal' sidebar tab added. Healing brush uses luminosity blending for organic-looking corrections.
   - **Dependencies**: `CanvasArea.tsx`, `HealingCanvas.tsx`, `HealingPanel.tsx`, `Sidebar.tsx`.
   - **ICE Score**: I:8, C:9, E:5 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks | **Status**: ✅ Shipped

2. **Adjustment Layers & Masks**
   - **Description**: Allow multiple instances of adjustments (e.g., two different curve layers with radial masks).
   - **User Problem**: Complex edits require isolating adjustments to specific parts of an image.
   - **Implementation**: Refactor `filterEngine.ts` to support an array of adjustment objects composited together, rather than a single flat state.
   - **Dependencies**: `filterEngine.ts`, `CanvasArea.tsx`
   - **ICE Score**: I:9, C:7, E:3 (Total: 19)
   - **Priority**: P2 | **Effort**: 3 weeks

3. **LUT (Look-Up Table) Support** ✅ IMPLEMENTED
   - **Description**: Import and apply standard .cube LUT files. Includes 10 built-in cinematic LUTs.
   - **User Problem**: Professionals want to use their existing color grading presets.
   - **Implementation**: New `lutEngine.ts` with `.cube` parser and trilinear interpolation. New `LutPanel.tsx` sidebar (10 built-in LUTs across 5 categories + import/export). LUT applied in `canvasDrawing.ts` and `exportPipeline.ts` via Canvas2D pixel mapping — no SVG filters needed.
   - **Dependencies**: `lutEngine.ts`, `LutPanel.tsx`, `filterEngine.ts`, `canvasDrawing.ts`, `exportPipeline.ts`, `Sidebar.tsx`
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks | **Status**: ✅ Shipped

4. **Batch Editing / Sync Settings** ✅ IMPLEMENTED
   - **Description**: Copy edit settings from one photo and paste them to multiple others (non-destructive).
   - **User Problem**: Editing a batch of photos from the same shoot is currently tedious.
   - **Implementation**: New 'Paste Edits' button in `TopBar.tsx` (emerald glow when enabled). Reads `copiedAdjustments` from `editStore` and merges non-destructively into current photo. Adjustments stored as JSON, no baking.
   - **Dependencies**: `TopBar.tsx`, `EditingMode.tsx`, `editStore.ts`
   - **ICE Score**: I:9, C:9, E:7 (Total: 25)
   - **Priority**: P0 | **Effort**: 1 week | **Status**: ✅ Shipped

5. **Magnetic Lasso / Smart Selection Tool**
   - **Description**: Edge-aware selection tool for precise masking.
   - **User Problem**: Manual brushing for masks is imprecise.
   - **Implementation**: Integrate a WebAssembly-based edge detection algorithm (e.g., OpenCV.js) to snap paths to high-contrast edges.
   - **Dependencies**: `AnnotationCanvas.tsx`
   - **ICE Score**: I:7, C:6, E:4 (Total: 17)
   - **Priority**: P2 | **Effort**: 2.5 weeks

### C. Quick Wins
- **Before/After Split Slider** ✅ IMPLEMENTED: Upgraded `isComparing` toggle to persistent click-toggle (sticky split view). Backslash `\` key also toggles. Drag slider was already present in `CanvasArea.tsx` — UX polished.
- **Auto-Level Hotkey** ✅ IMPLEMENTED: `Cmd+L` / `Ctrl+L` mapped to `handleAutoEnhance` via `useKeyBindings.ts`. Shared handler between keyboard shortcut and AdjustPanel button.

### D. Architecture Recommendations
- **Migrate SVG Filters to WebGL**: Complex SVG filters (like the custom regional masking and curves) should be fully migrated to WebGL shaders for better performance on large images.

---

## 2. Video Editor (`frontend/components/Editor/VideoEditor/`)

### A. Current State Assessment
- **Features**: NLE interface with `Timeline.tsx`, multi-track support (Video, Audio, Text), transitions, keyframing, and a WebGL-based video renderer (`WebGLVideoRenderer`).
- **Architecture**: Managed by a Zustand store (`useNLEStore`). Uses `hls.js` or raw streams via the backend, with frame-accurate scrubbing.
```tsx
// Evidence from frontend/components/Editor/VideoEditor/VideoEditorMode.tsx
const {
  tracks, playheadPosition, isPlaying, selectedClipId,
  addClip, removeClip, splitClip, selectClip, addFreezeFrame,
  undo, redo, projectFps
} = useNLEStore();
```
- **Strengths**: Highly ambitious in-browser NLE; solid foundation for tracks, clips, and transitions.
- **Weaknesses**: Lacks advanced professional grading tools *(addressed by Color Scopes)* and audio processing capabilities *(addressed by 3-Band EQ & Auto-Ducking)*.

### B. Feature Recommendations

1. **Color Grading Scopes (Waveform & Vectorscope)** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Real-time visual analysis of luma and chroma.
   - **User Problem**: Professionals cannot color grade accurately without scopes.
   - **Implementation**: Created `scopesEngine.ts` (Luma Waveform with 0–100 IRE scale, RGB Parade, and Cb/Cr Vectorscope with Rec.709 primary/secondary targets & yellow skin-tone reference line) and `ColorScopesPanel.tsx` real-time 60 FPS overlay canvas integrated into `PreviewArea.tsx` and `AdjustPanel.tsx`.
   - **Dependencies**: `scopesEngine.ts`, `ColorScopesPanel.tsx`, `PreviewArea.tsx`, `AdjustPanel.tsx`
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks | **Status**: ✅ Shipped

2. **Speed Ramping / Time Remapping** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Variable speed playback within a single clip using keyframes.
   - **User Problem**: Creating cinematic speed ramps currently requires cutting the clip into multiple pieces.
   - **Implementation**: Created `speedRampUtils.ts` (numerical integration for variable speed mapping $\int_0^t \text{speed}(\tau)d\tau$, presets for Hero Slow-Mo, Fast Burst, Bullet Time, Accelerate Ramp). Added `'speed'` keyframes to `KeyframeProperty` and `KeyframeEditor.tsx` visual curve editor. Updated `PreviewArea.tsx` decoder/video sourceTime calculations and `useAudioMixer.ts` dynamic playbackRate adaptation.
   - **Dependencies**: `speedRampUtils.ts`, `nle.ts`, `KeyframeEditor.tsx`, `InspectorPanel.tsx`, `PreviewArea.tsx`, `useAudioMixer.ts`
   - **ICE Score**: I:8, C:6, E:4 (Total: 18)
   - **Priority**: P2 | **Effort**: 3 weeks | **Status**: ✅ Shipped

3. **Audio Keyframing & EQ** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Volume ducking, fade handles, and basic EQ.
   - **User Problem**: Background music overpowers speech tracks.
   - **Implementation**: Extended Web Audio API nodes in `useAudioMixer.ts` with a 3-band BiquadFilter equalizer chain (Low 320Hz, Mid 1kHz, High 3.2kHz), fade-in/out envelopes, keyframed volume, and automatic background music ducking (-12dB) when speech is active. Created `AudioEQPanel` in `InspectorPanel.tsx` with 3-band EQ sliders, EQ presets (Flat, Voice Enhance, Bass Boost, Bright Treble), and auto-ducking toggle.
   - **Dependencies**: `nle.ts`, `timelineStore.ts`, `types.ts`, `useAudioMixer.ts`, `InspectorPanel.tsx`
   - **ICE Score**: I:9, C:8, E:6 (Total: 23)
   - **Priority**: P1 | **Effort**: 1.5 weeks | **Status**: ✅ Shipped

4. **Multi-cam Editing** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Sync multiple clips by audio and switch between them in real-time.
   - **User Problem**: Editing interviews with multiple angles is painful.
   - **Implementation**: Created `MulticamGrid.tsx` (4-up synchronized camera angle grid preview with LIVE indicators and click-to-cut functionality). Added `angle` (1..4) to `Track`, `cameraAngle` to `Clip`, and store state/actions (`isMulticamMode`, `toggleMulticamMode`, `setTrackAngle`, `switchMulticamAngle`). Added Multi-Cam top toolbar toggle and keyboard hotkeys (`1`–`4`) for live camera angle switching during playback.
   - **Dependencies**: `MulticamGrid.tsx`, `nle.ts`, `timelineStore.ts`, `types.ts`, `PreviewArea.tsx`, `VideoEditorMode.tsx`
   - **ICE Score**: I:7, C:6, E:3 (Total: 16)
   - **Priority**: P3 | **Effort**: 4 weeks | **Status**: ✅ Shipped

5. **Hardware-Accelerated WebCodecs Export** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Client-side rendering and encoding using WebCodecs API.
   - **User Problem**: Server-side rendering can be slow and resource-intensive.
   - **Implementation**: Created `webcodecsExporter.ts` (native browser `VideoEncoder` H.264 GPU pipeline piping WebGL frames into compressed video chunks). Updated `ExportDialog.tsx` with engine selector (`⚡ Hardware WebCodecs` vs `⚙️ Melt CLI`), real-time GPU frame progress tracking, and client-side download/save link.
   - **Dependencies**: `webcodecsExporter.ts`, `ExportDialog.tsx`
   - **ICE Score**: I:9, C:7, E:4 (Total: 20)
   - **Priority**: P1 | **Effort**: 3 weeks | **Status**: ✅ Shipped

### C. Quick Wins
- **Audio Waveform Caching** ✅ **IMPLEMENTED** (2026-07-21): `waveformCache` Map in `ClipElement.tsx` caches fetched waveform peak buffers in memory, preventing redundant network requests on zoom/pan.
- **Detached Audio** ✅ **IMPLEMENTED** (2026-07-21): Added right-click context menu to video clips on the timeline with "Detach Audio to Track" action that extracts clip audio to an audio track and mutes video audio.

### D. Architecture Recommendations
- **WebCodecs Decoder**: Investigate moving `VideoFrameDecoder` to the native WebCodecs API instead of relying heavily on backend streams, to reduce network overhead for proxies.

---

## 3. Lightbox / Photo Viewer

### A. Current State Assessment
- **Features**: `Toolbar.tsx` for actions, `PhotoMetadataDisplay.tsx` for EXIF and AI summaries. Filmstrip navigation. **Interactive Slideshow Mode** (auto-advance, transitions, optional BGM).
- **Architecture**: Simple React state, overlays on top of the main application. Slideshow logic lives in `useSlideshow` + `SlideshowControls`.
```tsx
// Evidence from frontend/components/viewers/lightbox/PhotoMetadataDisplay.tsx
const summary = metadata?.summary || photo.ai_summary || photo.caption;
// ...
{summary && (
  <p className="text-[11px] text-white/30 italic truncate max-w-md text-center hidden md:block">
    &ldquo;{summary}&rdquo;
  </p>
)}
```
- **Strengths**: Clean, distraction-free viewing with essential metadata easily accessible; cinematic slideshow for albums/collections.
- **Weaknesses**: Limited metadata editing capabilities. *(Static viewing addressed by Interactive Slideshow Mode.)*

### B. Feature Recommendations

1. **Interactive Slideshow Mode** ✅ **IMPLEMENTED** (2026-07-14)
   - **Description**: Auto-play photos with cinematic transitions and background music.
   - **User Problem**: Users want to showcase albums to friends/family without manual clicking.
   - **Implementation**: Extend `Lightbox.tsx` with a timer, transition animations (Framer Motion), and an audio player element.
   - **Dependencies**: `Lightbox.tsx`, Album data.
   - **ICE Score**: I:8, C:9, E:8 (Total: 25)
   - **Priority**: P1 | **Effort**: 1 week
   - **Status**: Done
   - **What shipped**:
     - `frontend/hooks/useSlideshow.ts` — play/pause, interval, loop, transition type, progress, local BGM
     - `frontend/components/viewers/lightbox/SlideshowControls.tsx` — distraction-free controls + settings
     - Toolbar **Slideshow** button + keyboard `S` to start; `Space` play/pause; `Esc` exit slideshow
     - Transitions: Fade, Slide, Ken Burns (Framer Motion + existing CSS)
     - Videos auto-play in slideshow and advance on `ended`
     - Addresses weakness: *static viewing experience*

2. **Manual EXIF Editor** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Edit date, time, location, caption, and camera EXIF data directly from the info panel.
   - **User Problem**: Imported photos from old cameras often have incorrect timestamps or missing EXIF tags.
   - **Implementation**: Updated `InfoPanel.tsx` with inline input forms and edit mode connected to `PUT /api/v1/photos/{photo_id}/metadata` mutation API, syncing SQLite DB and XMP sidecars.
   - **Dependencies**: `InfoPanel.tsx`, `PUT /api/v1/photos/{photo_id}/metadata`
   - **ICE Score**: I:9, C:9, E:7 (Total: 25)
   - **Priority**: P0 | **Effort**: 1 week | **Status**: ✅ Shipped

3. **Face Tagging UI Adjustment** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Click on unrecognized faces or faces in the image to manually tag or rename people.
   - **User Problem**: AI sometimes misses faces or misidentifies them.
   - **Implementation**: Created `FaceTaggingOverlay.tsx` overlaying interactive bounding boxes over high-res images, connected to `GET /{photo_id}/faces` and `POST /{photo_id}/tag-face` endpoints.
   - **Dependencies**: `FaceTaggingOverlay.tsx`, `ImageDisplay.tsx`, `Toolbar.tsx`
   - **ICE Score**: I:8, C:8, E:5 (Total: 21)
   - **Priority**: P1 | **Effort**: 2 weeks | **Status**: ✅ Shipped

4. **Side-by-Side Comparison Mode** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Select photos and view them simultaneously side-by-side with synchronized zoom and pan.
   - **User Problem**: Culling similar burst photos is difficult when flipping back and forth.
   - **Implementation**: Created `ComparisonView.tsx` with 2-up and 4-up synchronized viewing grid and shared zoom/pan controls.
   - **Dependencies**: `ComparisonView.tsx`, `Lightbox.tsx`
   - **ICE Score**: I:9, C:8, E:6 (Total: 23)
   - **Priority**: P1 | **Effort**: 1.5 weeks | **Status**: ✅ Shipped

5. **Quick Export Presets** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: 1-click export for social media (Instagram 4:5, Instagram Square 1:1, Story 9:16, Web 1080p, Full Res Original).
   - **User Problem**: Users have to manually crop and resize photos for different platforms.
   - **Implementation**: Added Quick Export dropdown in `Toolbar.tsx` calling `POST /api/v1/photos/{photo_id}/export-preset` backend cropping/resizing pipeline.
   - **Dependencies**: `Toolbar.tsx`, `export.py`
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 3 days | **Status**: ✅ Shipped

### C. Quick Wins
- **Keyboard Shortcut Overlay** ✅ **IMPLEMENTED** (2026-07-22): Pressing `?` displays `KeyboardShortcutsModal.tsx` listing all Lightbox hotkeys (`Space`, `S`, `E`, `I`, `F`, `Esc`, `Left/Right`, `?`).
- **Copy Image to Clipboard** ✅ **IMPLEMENTED** (2026-07-22): Added action button in `Toolbar.tsx` copying image blob directly to the OS clipboard via `navigator.clipboard.write`.

### D. Architecture Recommendations
- **Preloading Strategy** ✅ **IMPLEMENTED** (2026-07-22): Enhanced `Lightbox.tsx` logic to pre-fetch adjacent 3 photos in hidden `Image` preloader buffers to ensure zero-latency filmstrip navigation.

---

## 4. File Management (`frontend/components/FileFolderBrowser/`)

### A. Current State Assessment
- **Features**: Full browser suite: traversal, multi-select, filter search, sort/group, smart folders, batch rename, recent folders, auto-discovered drives/mounts, user external locations (NAS path / SMB register), virtualized list. Global OS drag-and-drop import (Tauri).
- **Architecture**: Modal dialog + `/list-dir`, `/batch-rename`, `/browser-locations`, external-locations CRUD. Mounts via `app/utils/mounts.py`; cloud provider registry in `app/services/cloud_locations/`. Extra roots from `settings.json` `external_locations`. Drag-drop → import pipeline.
```typescript
// Evidence from frontend/components/FileFolderBrowser/useFileFolderBrowser.ts
const res = await fetch(`${API_BASE}/api/v1/utilities/list-dir`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: path || null, show_hidden: showHiddenFiles }),
});
```
- **Strengths**: Reusable browser; sort/group; smart folders; batch rename; drag-and-drop import; auto-discovered removable/network mounts; user-configured external paths (NAS/SMB mounts); desktop-style two-pane browser with a session-persistent, corner-resizable dialog and aligned metadata table. **UI refresh implemented (2026-07-11).**
- **Weaknesses (remaining)**: S3/Google Drive browsing not live yet (config scaffold only). Drag-drop requires Tauri shell.

### B. Feature Recommendations

1. **Smart Folders / Saved Searches** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Filesystem smart folders — saved filter criteria (name pattern, media type, min size, optional pinned base path), not library rating queries.
   - **User Problem**: Users want quick access to dynamic collections without manually re-applying filters each time.
   - **Implementation**: `browserStorage.ts` + `SaveSmartFolderForm.tsx`; criteria applied in `useFileFolderBrowser` (`filteredFolders` / `filteredFiles`); surfaced in `BrowserShortcuts.tsx` with activate/delete.
   - **Also fixed (foundation)**: broken search wiring (`setSearchQuery` instead of `navigateTo`); include videos in media list; remove hardcoded external drive shortcut; recent folders (last 5); list virtualization; preview close; backend `modified_ms` on list-dir entries.
   - **Dependencies**: `BrowserShortcuts.tsx`, `localStorage`.
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks
   - **Status**: Done

2. **Advanced Sorting & Grouping** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Sort by name, size, date modified, or resolution; group by type (folders/images/videos) or calendar day. Asc/desc toggle; prefs persisted in `localStorage`.
   - **User Problem**: Finding a specific large file in a massive folder is difficult.
   - **Implementation**: `browserSort.ts` pure sort/group helpers; state in `useFileFolderBrowser.ts`; UI in `BrowserSortControls.tsx` via `BrowserHeader.tsx`; group headers in virtualized `BrowserList.tsx`. Secondary meta column shows size, modified date, or `WxH` based on active sort field. `list-dir` now enriches media entries with `width_px` / `height_px` using lightweight image header reads and ffprobe for videos.
   - **Dependencies**: `useFileFolderBrowser.ts`, `size_bytes` / `modified_ms` / `width_px` / `height_px` from list-dir
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 4 days
   - **Status**: Done

3. **Batch File Renaming** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Rename multiple files with patterns (e.g., `Vacation_{nnn}` → `Vacation_001.jpg`).
   - **User Problem**: Cameras generate non-descriptive filenames (e.g., DSC001.JPG).
   - **Implementation**: Context menu + footer “Rename” open `BatchRenameModal.tsx` with live preview (`renamePattern.ts`). Backend `POST /api/v1/utilities/batch-rename` (tokens `{n}/{nn}/{nnn}/{nnnn}`, `{name}`, `{ext}`, `{date}`, `{yyyy}`, `{mm}`, `{dd}`), dry-run, collision checks, two-phase rename, `safe_resolve_write` boundaries. Tests in `backend/tests/test_batch_rename.py`.
   - **Dependencies**: `BrowserList.tsx`, Backend API.
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week
   - **Status**: Done

4. **Drag and Drop Import** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Drag files or folders from the OS onto the Prism window to import into the library.
   - **User Problem**: Opening the browser dialog requires multiple clicks.
   - **Implementation**: `useDragDropImport` listens to Tauri `getCurrentWebview().onDragDropEvent`; `resolveDroppedPaths` classifies media files vs directories (expand via `/api/v1/photos/expand-directory`); reuses `useImportProcess.startImport`. `DragDropOverlay` shows hover state + errors. Wired in `App.tsx`. FAB copy mentions drag & drop. Unit tests for media path detection.
   - **Dependencies**: Tauri API, App root, existing import pipeline.
   - **ICE Score**: I:9, C:9, E:8 (Total: 26)
   - **Priority**: P0 | **Effort**: 3 days
   - **Status**: Done

5. **Cloud Storage / Network Drive Integration** ✅ **PHASE A+B DONE** (2026-07-11) — live mounts + path/SMB register; S3/GDrive scaffold
   - **Description**: Access external volumes and network locations from the file browser.
   - **User Problem**: Users keep large archives on NAS drives and remotes.
   - **Implementation**:
     - **Phase A (live)**: `discover_browser_mounts()` scans `/run/media`, `/media`, `/mnt`, `/Volumes` + psutil network fstypes (cifs/nfs/sshfs…). `GET /api/v1/utilities/browser-locations` surfaces them as **Drives:** shortcuts. Home added to allowed roots.
     - **Phase B (scaffold + path register)**: `external_locations` in `settings.json` via CRUD API; providers `local_path` / `smb` (ready — register existing mount path) and `s3` / `gdrive` (config saved, status `scaffold`). Allowed roots merge enabled `mount_path`s. UI: `AddExternalLocationForm` + Drives row in `BrowserShortcuts`.
   - **Dependencies**: Backend filesystem modules, settings.json.
   - **ICE Score**: I:8, C:6, E:3 (Total: 17)
   - **Priority**: P3 | **Effort**: 3 weeks
   - **Status**: Phase A complete; Phase B path/SMB usable; S3/GDrive browse deferred

### C. Quick Wins
- **Context Menu**: ✅ Right-click menu now supports batch/pattern rename and `Open in OS Explorer` for files/folders. Explorer launch is handled by backend `POST /api/v1/utilities/open-in-os-explorer`, avoiding a Tauri opener plugin dependency. **IMPLEMENTED** (2026-07-11)
- **Recent Folders Shortcut**: ✅ Maintain a history of the last 5 accessed folders in the shortcuts panel. **IMPLEMENTED**

### D. Architecture Recommendations
- **Virtualization**: ✅ `BrowserList.tsx` uses `@tanstack/react-virtual` to avoid DOM bloat on large directories. **IMPLEMENTED**

---

## 5. Map View (`frontend/components/MapView/`)

### A. Current State Assessment
- **Features**: Integrates `react-leaflet`, `leaflet.markercluster` for performant clustering of `PhotoMarkers`. Supports multiple map styles.
- **Architecture**: Clean separation of hooks (`usePhotoGeoData`) and UI. Custom HTML markers containing photo thumbnails.
```tsx
// Evidence from frontend/components/MapView/components/PhotoMarkers.tsx
const group = (L as any).markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  // ... custom icon rendering
});
```
- **Strengths**: Visually engaging; highly performant clustering.
- **Weaknesses**: Static representation; lacks storytelling elements like routes or temporal filtering.

### B. Feature Recommendations

1. **Travel Routes / Timeline Path** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Draw lines connecting photos sequentially by time.
   - **User Problem**: Users want to see their road trip or vacation journey chronologically.
   - **Implementation**: Added a `TravelRouteLayer` Leaflet `Polyline` connecting geotagged photos sorted by capture time, with start/latest route markers and route-aware overlay copy. `usePhotoGeoData` now also derives sorted timeline photos plus geographic bounds for map framing.
   - **Also fixed (weakness + quick win)**: the map no longer relies on a static average-center view. `MapViewportManager` now fits bounds to current geotagged photos, and a `Zoom to extents` control was added to reframe the visible journey on demand. A route toggle in `MapToolbar` makes the storytelling layer optional instead of permanently static.
   - **Dependencies**: `react-leaflet`, `MapView/index.tsx`
   - **ICE Score**: I:8, C:9, E:8 (Total: 25)
   - **Priority**: P1 | **Effort**: 4 days
   - **Status**: Done

2. **Heatmap Overlay** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Toggle a density layer showing where photos cluster most heavily.
   - **User Problem**: Visualizing where most photos are taken without zooming into clusters.
   - **Implementation**: Added a custom no-dependency `DensityLayer` canvas overlay that projects visible geotagged photos into the Leaflet viewport and paints stacked radial gradients to reveal hotspots. Exposed via a toolbar toggle and reflected in the overlay copy.
   - **Also fixed (weakness)**: this gives Map View a second storytelling mode beyond static markers, making repeated shooting patterns visible at a glance without relying on cluster interaction.
   - **Dependencies**: `react-leaflet`, `MapView/index.tsx`
   - **ICE Score**: I:7, C:9, E:7 (Total: 23)
   - **Priority**: P2 | **Effort**: 1 week
   - **Status**: Done

3. **Reverse Geocoding Auto-Albums** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Group photos automatically by Country/City based on coordinates.
   - **User Problem**: Organizing travel photos manually is tedious.
   - **Implementation**: Extended smart albums with dynamic `places` albums generated from location metadata. Backend now exposes auto-grouped place albums plus a generic smart-album photo resolver keyed by smart album id. Existing geotagged photos with missing `city/country` are backfilled via offline reverse geocoding before album grouping, then surfaced in the Albums UI with location-aware detail headers.
   - **Also fixed (weakness)**: this removes a hidden failure mode where older geotagged photos with coordinates but no resolved place labels would never appear in location grouping. The map/albums flow now stays coherent even when metadata was imported before reverse geocoding support matured.
   - **Dependencies**: Backend Geocoding service, Albums smart-album UI
   - **ICE Score**: I:9, C:8, E:5 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks
   - **Status**: Done

4. **Location Edit via Map Drag** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Allow users to drag a photo marker to a new location to update its EXIF GPS data.
   - **User Problem**: Correcting bad GPS data is currently a text-based or non-existent process.
   - **Implementation**: Added explicit map `Edit locations` mode with draggable markers. On drop, the frontend calls `PUT /api/v1/photos/{photo_id}/location`, which updates GPS coordinates, refreshes city/state/country via offline reverse geocoding, and attempts XMP sidecar export so the correction persists beyond the DB.
   - **Also fixed (weakness)**: edits are no longer trapped in the map surface. Updated coordinates flow back into the app’s shared photo state immediately, so map, albums, and metadata surfaces stay in sync after a drag operation.
   - **Dependencies**: `PhotoMarkers.tsx`, photos metadata API, XMP export
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks
   - **Status**: Done

5. **Temporal Map Slider** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: A timeline slider at the bottom of the map that filters visible markers by date range.
   - **User Problem**: Finding a photo taken in a specific location at a specific time.
   - **Implementation**: Added a bottom-mounted `MapTemporalSlider` dual-range control that filters the input photo set by capture date before it reaches `usePhotoGeoData`, so markers, routes, density, and viewport framing all respond to the same temporal subset. Slider state is deferred to keep interaction smooth while redrawing the map.
   - **Also fixed (weakness)**: map storytelling is no longer only spatial. The map can now answer “where was I in this period?” instead of forcing users to visually scan the entire lifetime of the library at once.
   - **Dependencies**: `MapView/index.tsx`
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week
   - **Status**: Done

### C. Quick Wins
- **Zoom to Extents**: ✅ Added a button to reset the map view to bound all current markers using `map.fitBounds()`. **IMPLEMENTED** (2026-07-11)

### D. Architecture Recommendations
- **Tile Caching**: Implement local caching of Leaflet map tiles via Tauri/Backend to allow offline map usage, aligning with the app's privacy/offline-first philosophy.

### E. Additional Delivered Feature

6. **Time-Lapse Map Animation** ✅ **IMPLEMENTED** (2026-07-11)
   - **Description**: Animate photo markers appearing on the map chronologically, showing your photography journey over time.
   - **User Problem**: Users want to visualize their photographic life across years and continents.
   - **Implementation**: Added a dedicated time-lapse mode with play/pause/reset and manual scrubbing. The playback clock is driven by `requestAnimationFrame`, and the visible marker/route/density subset is progressively revealed against the currently selected temporal range. A live date counter is surfaced in the map overlay and playback panel.
   - **Dependencies**: `Photo.date` sorting, Leaflet markers, temporal map filter
   - **ICE Score**: I:6, C:7, E:5 (Total: 18)
   - **Status**: Done

---

## 6. Storage Cleanup (`frontend/components/utilities/storageCleanup/`)

### A. Current State Assessment
- **Features**: Identifies blurry photos, duplicates, and documents. Allows clearing thumbnail cache and vacuuming the SQLite database.
- **Architecture**: `StorageCleanup.tsx` uses `useStorageCleanup.ts` to coordinate with backend diagnostic endpoints.
```typescript
// Evidence from frontend/components/utilities/storageCleanup/useStorageCleanup.ts
const [blurryRes, duplicatesRes, documentsRes, _] = await Promise.all([
  activeSubTab === 'blurry' ? fetch(`${API_BASE}/api/v1/utilities/blurry`) : Promise.resolve(null),
  activeSubTab === 'duplicates' ? fetch(`${API_BASE}/api/v1/utilities/duplicates`) : Promise.resolve(null),
  activeSubTab === 'documents' ? fetch(`${API_BASE}/api/v1/utilities/documents`) : Promise.resolve(null),
  fetchDiagnostics()
]);
```
- **Strengths**: Provides excellent system-level maintenance tools directly in the UI.
- **Weaknesses**: Detection relies on exact duplicates or strict blur thresholds; missing "similar" photo detection.

### B. Feature Recommendations

1. **Similar Photos Finder (Burst Mode)**
   - **Description**: Group visually similar photos taken within a short timeframe.
   - **User Problem**: Exact duplicate finders miss bursts of photos where the user only wants to keep the best one.
   - **Implementation**: Use a lightweight perceptual hash (pHash) or image embedding distance in the backend to cluster similar photos.
   - **Dependencies**: Backend image processing.
   - **ICE Score**: I:9, C:7, E:5 (Total: 21)
   - **Priority**: P1 | **Effort**: 2.5 weeks

2. **Large Files / Video Size Analyzer**
   - **Description**: A new tab identifying the largest files taking up space, particularly videos.
   - **User Problem**: Running out of disk space, users need to find the heaviest files quickly.
   - **Implementation**: Add a backend endpoint sorting files by size descending, presented in a list view.
   - **Dependencies**: `useStorageCleanup.ts`
   - **ICE Score**: I:8, C:9, E:8 (Total: 25)
   - **Priority**: P0 | **Effort**: 3 days

3. **Automated Cleanup Rules**
   - **Description**: Automatically trash blurry photos or screen recordings after 30 days.
   - **User Problem**: Users forget to run manual cleanups.
   - **Implementation**: Background cron job in the backend, configurable via a settings modal in the UI.
   - **Dependencies**: Backend scheduler.
   - **ICE Score**: I:7, C:8, E:5 (Total: 20)
   - **Priority**: P2 | **Effort**: 2 weeks

4. **Archive / Cold Storage Helper**
   - **Description**: Workflow to move rarely accessed large files to external storage while keeping a low-res proxy in the main library.
   - **User Problem**: Managing a library larger than the local SSD.
   - **Implementation**: Backend file moving logic and database path updating.
   - **Dependencies**: File browser integration.
   - **ICE Score**: I:9, C:6, E:3 (Total: 18)
   - **Priority**: P2 | **Effort**: 4 weeks

5. **Orphaned Files Detector**
   - **Description**: Find files in the storage directory that are not indexed in the database (or vice-versa).
   - **User Problem**: Application crashes or manual file moves can cause database inconsistencies.
   - **Implementation**: Background scan comparing filesystem tree to DB records.
   - **Dependencies**: Backend scanner.
   - **ICE Score**: I:8, C:8, E:7 (Total: 23)
   - **Priority**: P1 | **Effort**: 1 week

### C. Quick Wins
- **Select All / Bulk Action**: Add a "Select All" checkbox in the Duplicates/Blurry tabs to mass-trash items.
- **Space Saved Counter**: Show a running total of MB/GB saved after performing cleanup actions.

### D. Architecture Recommendations
- **Pagination/Virtualization**: If the user has thousands of duplicates, the current UI will lag. Implement infinite scrolling or virtualization for the cleanup lists.

---

## 7. Dashboard / Explore (`frontend/components/explore/`)

### A. Current State Assessment
- **Features**: Highly visual entry point with `MemoriesCarousel`, `OnThisDaySection`, `AIThemeGrid`, `SeasonalGrid`, and `EventTimeline`.
- **Architecture**: Modular layout comprising independently fetching React components.
```tsx
// Evidence from frontend/components/explore/ExploreView.tsx
export const ExploreView: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      <MemoriesCarousel />
      <OnThisDaySection />
      <AIThemeGrid />
      <SeasonalGrid />
      <EventTimeline />
    </div>
  );
};
```
- **Strengths**: Excellent engagement mechanics; effectively surfaces old content.
- **Weaknesses**: Lacks personalization regarding user habits and data insights.

### B. Feature Recommendations

1. **Photography Stats & Insights** ✅ **IMPLEMENTED** (2026-07-14)
   - **Description**: Widgets showing most used cameras, favorite focal lengths, ISO averages, and top locations.
   - **User Problem**: Photographers love analyzing their gear usage and habits.
   - **Implementation**: Backend aggregation queries on EXIF data, visualized with a charting library (e.g., Recharts).
   - **Dependencies**: Backend EXIF data.
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks
   - **Status**: Done
   - **What shipped**: `GET /api/v1/explore/insights` aggregates visible-library camera, lens, ISO, and location data; `PhotographyInsights.tsx` presents accessible camera/location rankings and shooting metrics with useful missing-metadata states. Import now persists EXIF focal length and ISO for new photos.

2. **Recent Activity Feed** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: A timeline of recent imports, edits, album creations, and AI searches.
   - **User Problem**: Hard to pick up where you left off after opening the app.
   - **Implementation**: Created `RecentActivityFeed.tsx` and `GET /api/v1/explore/activity` endpoint tracking recent imports, album creations, and neural search sessions with direct action links.
   - **Dependencies**: `RecentActivityFeed.tsx`, `GET /api/v1/explore/activity`
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 1 week | **Status**: ✅ Shipped

3. **Auto-generated Video Highlights** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Automatically compile clips and photos from an event/season into a short reel.
   - **User Problem**: Video editing is too time-consuming for casual memories.
   - **Implementation**: Created `HighlightReelSection.tsx`, `GET /api/v1/explore/highlights`, and `POST /api/v1/explore/highlights/generate` endpoint compiling memory reels with 1-click preview and NLE editor project generation.
   - **Dependencies**: `HighlightReelSection.tsx`, `VideoEditor` backend.
   - **ICE Score**: I:9, C:6, E:3 (Total: 18)
   - **Priority**: P3 | **Effort**: 4 weeks | **Status**: ✅ Shipped

4. **Custom Dashboard Widgets** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Allow users to reorder and toggle visibility of Explore view sections.
   - **User Problem**: Not all users care about every default dashboard section.
   - **Implementation**: Created `ExploreWidgetCustomizer.tsx` layout manager modal, allowing users to toggle section visibility and reorder widgets with layout state persisted in `localStorage`.
   - **Dependencies**: `ExploreView.tsx`, `ExploreWidgetCustomizer.tsx`
   - **ICE Score**: I:6, C:8, E:5 (Total: 19)
   - **Priority**: P3 | **Effort**: 2 weeks | **Status**: ✅ Shipped

5. **"Rediscover" Smart Prompts** ✅ **IMPLEMENTED** (2026-07-22)
   - **Description**: Prompt the user to tag unnamed faces, organize un-albumed photos, review blurry clutter, or add geotags.
   - **User Problem**: Organization tasks pile up.
   - **Implementation**: Created `RediscoverPrompts.tsx` and `GET /api/v1/explore/rediscover-prompts` surfacing actionable micro-task cards with direct navigation buttons.
   - **Dependencies**: `RediscoverPrompts.tsx`, `explore.py`
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1.5 weeks | **Status**: ✅ Shipped

### C. Quick Wins
- **Greeting Personalization** ✅ **IMPLEMENTED** (2026-07-22): Time-aware greeting (`getTimeGreeting()`) in `ExploreHeader.tsx` ("Good Morning", "Good Afternoon", "Good Evening", "Good Night").
- **Empty States** ✅ **IMPLEMENTED** (2026-07-22): Friendly, informative empty-library fallbacks across all Explore widgets.

### D. Architecture Recommendations
- **Staggered Loading** ✅ **IMPLEMENTED** (2026-07-22): Independent component fetching and non-blocking skeleton states in `ExploreView.tsx`.

--- prevent the Dashboard from blocking the main thread while 5 different components query the backend simultaneously.

---

## 8. AI Features (`frontend/components/AgentView/`)

### A. Current State Assessment
- **Features**: Chat-based agent (`AgentView.tsx`) utilizing semantic/temporal search, execution logs, and inline photo grids.
- **Architecture**: Streaming SSE (Server-Sent Events) connecting to a backend agent capable of tool use (FTS5, metadata).
```typescript
// Evidence from frontend/components/AgentView/useAgentView.ts
const response = await fetch(`${API_BASE}/api/v1/agent/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: query, history: historyPayload }),
});
// Read SSE chunks mapping to progress and results...
```
- **Strengths**: Impressive conversational UI, transparent execution logs (diagnostics).
- **Weaknesses**: Features are siloed in a chat interface; AI could be more integrated into workflow tools.

### B. Feature Recommendations

1. **AI Auto-Cull Assistant**
   - **Description**: The agent selects the best photos from a shoot based on focus, expression (eyes open), and composition.
   - **User Problem**: Culling hundreds of wedding/event photos is the most tedious part of photography.
   - **Implementation**: Backend multi-modal model evaluates photos and tags them with an "AI Score", surfaced in the UI.
   - **Dependencies**: Backend vision models.
   - **ICE Score**: I:10, C:6, E:4 (Total: 20)
   - **Priority**: P0 | **Effort**: 4 weeks

2. **Natural Language Image Editing**
   - **Description**: Type "make this look like vintage film" and the agent adjusts the `filterEngine` parameters automatically.
   - **User Problem**: Users don't know how to manipulate curves and HSL to achieve a specific look.
   - **Implementation**: Map LLM outputs to the `Adjustments` interface in `filterEngine.ts`.
   - **Dependencies**: `ImageEditor`, Agent Backend.
   - **ICE Score**: I:9, C:7, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks

3. **Smart Album Generation** ✅ **IMPLEMENTED** (2026-07-21)
   - **Description**: Tell the agent "Create an album of my dog at the beach" or click 1-Click Create Album to auto-generate a custom album from search results.
   - **User Problem**: Manual album creation is slow.
   - **Implementation**: Created `SmartAlbumModal.tsx` and integrated header "📁 Create Album" buttons into `GalleryDrawer.tsx` & `SuggestedFollowups.tsx`. Invokes `POST /api/v1/albums/` and batch adds candidate photo IDs via `POST /api/v1/albums/{id}/add-photos`.
   - **Dependencies**: `SmartAlbumModal.tsx`, `GalleryDrawer.tsx`, `SuggestedFollowups.tsx`, Albums API.
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week | **Status**: ✅ Shipped

4. **Generative Expand (Outpainting)**
   - **Description**: Extend the canvas of a photo using AI generation.
   - **User Problem**: Fixing crooked horizons or converting a vertical photo to landscape.
   - **Implementation**: Connect the existing `InpaintCanvas` architecture to an outpainting model endpoint.
   - **Dependencies**: `ImageEditor` inpaint pipeline.
   - **ICE Score**: I:9, C:6, E:4 (Total: 19)
   - **Priority**: P2 | **Effort**: 3 weeks

5. **Voice Search Integration**
   - **Description**: Click a microphone to talk to the agent instead of typing.
   - **User Problem**: Mobile/tablet users prefer speaking over typing long queries.
   - **Implementation**: Use Web Speech API integrated into `ChatInput.tsx`.
   - **Dependencies**: `ChatInput.tsx`
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 3 days

### C. Quick Wins
- **Contextual Agent Invocation** ✅ **IMPLEMENTED** (2026-07-21): Added `askAboutPhoto` helper in `useAgentView.ts` and "✨ Ask AI About Photo" action on photo cards in `GalleryDrawer.tsx`.
- **Suggested Follow-ups** ✅ **IMPLEMENTED** (2026-07-21): Created `SuggestedFollowups.tsx` presenting interactive chips under AI assistant response messages (Favorites only, Videos only, Create album, etc.).

### D. Architecture Recommendations
- **Global Command Palette**: Decouple the Agent logic from `AgentView.tsx` so it can be invoked globally (e.g., via `Cmd+K`) as a floating command palette across the entire app.
