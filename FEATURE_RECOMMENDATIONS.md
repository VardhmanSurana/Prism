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

1. **Advanced Healing Brush / Clone Stamp**
   - **Description**: Manual texture replication and healing beyond generative inpaint.
   - **User Problem**: Users need to quickly remove small blemishes without invoking heavy AI models.
   - **Implementation**: Extend `AnnotationCanvas` with a brush that samples pixels from a source point using standard canvas composite operations.
   - **Dependencies**: `CanvasArea.tsx`, WebGL fallback handling.
   - **ICE Score**: I:8, C:9, E:5 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks

2. **Adjustment Layers & Masks**
   - **Description**: Allow multiple instances of adjustments (e.g., two different curve layers with radial masks).
   - **User Problem**: Complex edits require isolating adjustments to specific parts of an image.
   - **Implementation**: Refactor `filterEngine.ts` to support an array of adjustment objects composited together, rather than a single flat state.
   - **Dependencies**: `filterEngine.ts`, `CanvasArea.tsx`
   - **ICE Score**: I:9, C:7, E:3 (Total: 19)
   - **Priority**: P2 | **Effort**: 3 weeks

3. **LUT (Look-Up Table) Support**
   - **Description**: Import and apply standard .cube LUT files.
   - **User Problem**: Professionals want to use their existing color grading presets.
   - **Implementation**: Add a WebGL shader pass in the export/preview pipeline to map pixels through a 3D texture.
   - **Dependencies**: `exportPipeline.ts`
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks

4. **Batch Editing / Sync Settings**
   - **Description**: Copy edit settings from one photo and paste them to multiple others.
   - **User Problem**: Editing a batch of photos from the same shoot is currently tedious.
   - **Implementation**: Store serialized `Adjustments` in clipboard and provide a bulk-apply API endpoint.
   - **Dependencies**: `filterEngine.ts`, Gallery Grid multi-select.
   - **ICE Score**: I:9, C:9, E:7 (Total: 25)
   - **Priority**: P0 | **Effort**: 1 week

5. **Magnetic Lasso / Smart Selection Tool**
   - **Description**: Edge-aware selection tool for precise masking.
   - **User Problem**: Manual brushing for masks is imprecise.
   - **Implementation**: Integrate a WebAssembly-based edge detection algorithm (e.g., OpenCV.js) to snap paths to high-contrast edges.
   - **Dependencies**: `AnnotationCanvas.tsx`
   - **ICE Score**: I:7, C:6, E:4 (Total: 17)
   - **Priority**: P2 | **Effort**: 2.5 weeks

### C. Quick Wins
- **Before/After Split Slider**: Upgrade the current `isComparing` toggle to an interactive drag slider (similar to the Video Editor's implementation).
- **Auto-Level Hotkey**: Add a quick shortcut (e.g., `Cmd+L`) mapped to the `handleAutoEnhance` function in `AdjustPanel.tsx`.

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
- **Weaknesses**: Lacks advanced professional grading tools and audio processing capabilities.

### B. Feature Recommendations

1. **Color Grading Scopes (Waveform & Vectorscope)**
   - **Description**: Real-time visual analysis of luma and chroma.
   - **User Problem**: Professionals cannot color grade accurately without scopes.
   - **Implementation**: Extract frames from `WebGLVideoRenderer`, process pixel data into a separate canvas graph.
   - **Dependencies**: `VideoEditorMode.tsx`, WebGL Renderer.
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks

2. **Speed Ramping / Time Remapping**
   - **Description**: Variable speed playback within a single clip using keyframes.
   - **User Problem**: Creating cinematic speed ramps currently requires cutting the clip into multiple pieces.
   - **Implementation**: Extend the `speed` property in `Clip` to accept keyframes and update the decoder logic in `PreviewArea` to map timeline time to source time dynamically.
   - **Dependencies**: `useNLEStore.ts`, `Timeline.tsx`
   - **ICE Score**: I:8, C:6, E:4 (Total: 18)
   - **Priority**: P2 | **Effort**: 3 weeks

3. **Audio Keyframing & EQ**
   - **Description**: Volume ducking, fade handles, and basic EQ.
   - **User Problem**: Background music overpowers speech tracks.
   - **Implementation**: Utilize Web Audio API nodes in `useAudioMixer.ts` controlled by clip keyframes.
   - **Dependencies**: `useAudioMixer.ts`
   - **ICE Score**: I:9, C:8, E:6 (Total: 23)
   - **Priority**: P1 | **Effort**: 1.5 weeks

4. **Multi-cam Editing**
   - **Description**: Sync multiple clips by audio and switch between them in real-time.
   - **User Problem**: Editing interviews with multiple angles is painful.
   - **Implementation**: Add an "angle" property to tracks; allow real-time track cutting during playback.
   - **Dependencies**: `Timeline.tsx`, `useNLEStore.ts`
   - **ICE Score**: I:7, C:6, E:3 (Total: 16)
   - **Priority**: P3 | **Effort**: 4 weeks

5. **Hardware-Accelerated WebCodecs Export**
   - **Description**: Client-side rendering and encoding using WebCodecs API.
   - **User Problem**: Server-side rendering can be slow and resource-intensive.
   - **Implementation**: Pipe `WebGLVideoRenderer` output frames to WebCodecs `VideoEncoder` and multiplex with audio.
   - **Dependencies**: `ExportDialog.tsx`
   - **ICE Score**: I:9, C:7, E:4 (Total: 20)
   - **Priority**: P1 | **Effort**: 3 weeks

### C. Quick Wins
- **Audio Waveform Caching**: Currently, `WaveformBar` fetches peaks dynamically. Cache these in the project state to avoid re-fetching on zoom/pan.
- **Detached Audio**: Allow users to right-click a video clip and "Detach Audio" to a separate audio track.

### D. Architecture Recommendations
- **WebCodecs Decoder**: Investigate moving `VideoFrameDecoder` to the native WebCodecs API instead of relying heavily on backend streams, to reduce network overhead for proxies.

---

## 3. Lightbox / Photo Viewer

### A. Current State Assessment
- **Features**: `Toolbar.tsx` for actions, `PhotoMetadataDisplay.tsx` for EXIF and AI summaries. Filmstrip navigation.
- **Architecture**: Simple React state, overlays on top of the main application.
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
- **Strengths**: Clean, distraction-free viewing with essential metadata easily accessible.
- **Weaknesses**: Static viewing experience; limited metadata editing capabilities.

### B. Feature Recommendations

1. **Interactive Slideshow Mode**
   - **Description**: Auto-play photos with cinematic transitions and background music.
   - **User Problem**: Users want to showcase albums to friends/family without manual clicking.
   - **Implementation**: Extend `Lightbox.tsx` with a timer, transition animations (Framer Motion), and an audio player element.
   - **Dependencies**: `Lightbox.tsx`, Album data.
   - **ICE Score**: I:8, C:9, E:8 (Total: 25)
   - **Priority**: P1 | **Effort**: 1 week

2. **Manual EXIF Editor**
   - **Description**: Edit date, time, and location directly from the info panel.
   - **User Problem**: Imported photos from old cameras often have incorrect timestamps.
   - **Implementation**: Add edit modes to `PhotoMetadataDisplay.tsx` connected to a backend mutation API.
   - **Dependencies**: `InfoPanel.tsx`
   - **ICE Score**: I:9, C:9, E:7 (Total: 25)
   - **Priority**: P0 | **Effort**: 1 week

3. **Face Tagging UI Adjustment**
   - **Description**: Click on unrecognized faces to manually tag people.
   - **User Problem**: AI sometimes misses faces or misidentifies them.
   - **Implementation**: Overlay bounding boxes on the high-res image when a "Tag Mode" is active.
   - **Dependencies**: `ImageDisplay.tsx`
   - **ICE Score**: I:8, C:8, E:5 (Total: 21)
   - **Priority**: P1 | **Effort**: 2 weeks

4. **Side-by-Side Comparison Mode**
   - **Description**: Select 2-4 photos and view them simultaneously locked to the same zoom level.
   - **User Problem**: Culling similar photos (e.g., from a burst) is difficult when flipping back and forth.
   - **Implementation**: Modify `Lightbox.tsx` to render a CSS grid of `ImageDisplay` components that share a zoomed state.
   - **Dependencies**: `Lightbox.tsx`, PhotoGrid selection.
   - **ICE Score**: I:9, C:8, E:6 (Total: 23)
   - **Priority**: P1 | **Effort**: 1.5 weeks

5. **Quick Export Presets**
   - **Description**: 1-click export for social media (e.g., "Export for Instagram 4:5").
   - **User Problem**: Users have to manually crop and resize photos for different platforms.
   - **Implementation**: Add a dropdown in `Toolbar.tsx` that calls a backend resizing pipeline.
   - **Dependencies**: `Toolbar.tsx`
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 3 days

### C. Quick Wins
- **Keyboard Shortcut Overlay**: Pressing '?' should show a modal of all Lightbox shortcuts.
- **Copy Image to Clipboard**: Add a button to copy the image blob directly to the OS clipboard.

### D. Architecture Recommendations
- **Preloading Strategy**: Enhance the filmstrip logic to pre-fetch the next 3 high-res images into hidden `<img>` tags to ensure zero-latency navigation.

---

## 4. File Management (`frontend/components/FileFolderBrowser/`)

### A. Current State Assessment
- **Features**: `useFileFolderBrowser.ts` provides directory traversal, hidden file toggling, multi-selection, and predefined shortcuts.
- **Architecture**: Modal dialog (`FileFolderBrowserDialog.tsx`) communicating with backend `/api/v1/utilities/list-dir`.
```typescript
// Evidence from frontend/components/FileFolderBrowser/useFileFolderBrowser.ts
const res = await fetch(`${API_BASE}/api/v1/utilities/list-dir`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: path || null, show_hidden: showHiddenFiles }),
});
```
- **Strengths**: Reusable component, clean UI, responsive to large directories.
- **Weaknesses**: Lacks advanced sorting, virtual/smart folders, and drag-and-drop operations.

### B. Feature Recommendations

1. **Smart Folders / Saved Searches**
   - **Description**: Virtual folders based on search queries (e.g., "All 5-star photos from 2023").
   - **User Problem**: Users want quick access to dynamic collections without manually moving files.
   - **Implementation**: Store search parameters in the database and surface them as virtual nodes in `BrowserList.tsx`.
   - **Dependencies**: Database, `BrowserShortcuts.tsx`.
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks

2. **Advanced Sorting & Grouping**
   - **Description**: Sort by size, date modified, resolution; group by date or type.
   - **User Problem**: Finding a specific large file in a massive folder is difficult.
   - **Implementation**: Add sort state to `useFileFolderBrowser.ts` and UI toggles in `BrowserHeader.tsx`.
   - **Dependencies**: `useFileFolderBrowser.ts`
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 4 days

3. **Batch File Renaming**
   - **Description**: Rename multiple files with patterns (e.g., "Vacation_001.jpg").
   - **User Problem**: Cameras generate non-descriptive filenames (e.g., DSC001.JPG).
   - **Implementation**: Add a context menu action that opens a modal for pattern input, executed via a new backend API.
   - **Dependencies**: `BrowserList.tsx`, Backend API.
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week

4. **Drag and Drop Import**
   - **Description**: Allow dragging folders from the OS directly into the app window to import.
   - **User Problem**: Opening the browser dialog requires multiple clicks.
   - **Implementation**: Use Tauri's drag-and-drop file events globally to trigger the import pipeline.
   - **Dependencies**: Tauri API, App root.
   - **ICE Score**: I:9, C:9, E:8 (Total: 26)
   - **Priority**: P0 | **Effort**: 3 days

5. **Cloud Storage / Network Drive Integration**
   - **Description**: Mount or access SMB/Google Drive/S3 buckets directly.
   - **User Problem**: Users keep large archives on NAS drives.
   - **Implementation**: Backend Python integration to mount or stream from network locations, surfaced as shortcuts in the browser.
   - **Dependencies**: Backend filesystem modules.
   - **ICE Score**: I:8, C:6, E:3 (Total: 17)
   - **Priority**: P3 | **Effort**: 3 weeks

### C. Quick Wins
- **Context Menu**: Add right-click support to `BrowserList.tsx` for "Open in OS Explorer" (using Tauri's shell open).
- **Recent Folders Shortcut**: Maintain a history of the last 5 accessed folders in the shortcuts panel.

### D. Architecture Recommendations
- **Virtualization**: If viewing folders with 10,000+ files, `BrowserList.tsx` should use `@tanstack/react-virtual` (already in `package.json`) to prevent DOM bloat.

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

1. **Travel Routes / Timeline Path**
   - **Description**: Draw lines connecting photos sequentially by time.
   - **User Problem**: Users want to see their road trip or vacation journey chronologically.
   - **Implementation**: Add a Leaflet `Polyline` layer connecting coordinates, sorted by `photo.date`.
   - **Dependencies**: `react-leaflet`, `MapView/index.tsx`
   - **ICE Score**: I:8, C:9, E:8 (Total: 25)
   - **Priority**: P1 | **Effort**: 4 days

2. **Heatmap Overlay**
   - **Description**: Toggle a heatmap layer showing density of photos globally.
   - **User Problem**: Visualizing where most photos are taken without zooming into clusters.
   - **Implementation**: Integrate `leaflet.heat` plugin using the existing `geoPhotos` data.
   - **Dependencies**: `leaflet.heat`
   - **ICE Score**: I:7, C:9, E:7 (Total: 23)
   - **Priority**: P2 | **Effort**: 1 week

3. **Reverse Geocoding Auto-Albums**
   - **Description**: Group photos automatically by Country/City based on coordinates.
   - **User Problem**: Organizing travel photos manually is tedious.
   - **Implementation**: Backend task to reverse-geocode coordinates and create "Smart Albums" based on location tags.
   - **Dependencies**: Backend Geocoding service.
   - **ICE Score**: I:9, C:8, E:5 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks

4. **Location Edit via Map Drag**
   - **Description**: Allow users to drag a photo marker to a new location to update its EXIF GPS data.
   - **User Problem**: Correcting bad GPS data is currently a text-based or non-existent process.
   - **Implementation**: Make markers draggable (when an "Edit Mode" is toggled) and fire a backend mutation on drop.
   - **Dependencies**: `PhotoMarkers.tsx`
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 1.5 weeks

5. **Temporal Map Slider**
   - **Description**: A timeline slider at the bottom of the map that filters visible markers by date range.
   - **User Problem**: Finding a photo taken in a specific location at a specific time.
   - **Implementation**: Add a range slider component that filters the `photos` prop before passing it to `usePhotoGeoData`.
   - **Dependencies**: `MapView/index.tsx`
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week

### C. Quick Wins
- **Zoom to Extents**: Add a button to reset the map view to bound all current markers using `map.fitBounds()`.

### D. Architecture Recommendations
- **Tile Caching**: Implement local caching of Leaflet map tiles via Tauri/Backend to allow offline map usage, aligning with the app's privacy/offline-first philosophy.

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

1. **Photography Stats & Insights**
   - **Description**: Widgets showing most used cameras, favorite focal lengths, ISO averages, and top locations.
   - **User Problem**: Photographers love analyzing their gear usage and habits.
   - **Implementation**: Backend aggregation queries on EXIF data, visualized with a charting library (e.g., Recharts).
   - **Dependencies**: Backend EXIF data.
   - **ICE Score**: I:8, C:8, E:6 (Total: 22)
   - **Priority**: P1 | **Effort**: 2 weeks

2. **Recent Activity Feed**
   - **Description**: A timeline of recent imports, edits, and album creations.
   - **User Problem**: Hard to pick up where you left off after opening the app.
   - **Implementation**: Track audit logs/modification dates in the DB and surface them in a list component.
   - **Dependencies**: Database audit tracking.
   - **ICE Score**: I:7, C:9, E:8 (Total: 24)
   - **Priority**: P2 | **Effort**: 1 week

3. **Auto-generated Video Highlights**
   - **Description**: Automatically compile clips from a specific event into a short reel.
   - **User Problem**: Video editing is too time-consuming for casual memories.
   - **Implementation**: Tie into the existing NLE backend, picking 3-second segments of videos from an event, laying them back-to-back.
   - **Dependencies**: `VideoEditor` backend.
   - **ICE Score**: I:9, C:6, E:3 (Total: 18)
   - **Priority**: P3 | **Effort**: 4 weeks

4. **Custom Dashboard Widgets**
   - **Description**: Allow users to drag, drop, and hide sections of the Explore view.
   - **User Problem**: Not all users care about "On This Day" or "AI Themes".
   - **Implementation**: Save layout preferences in local storage or DB, use a library like `dnd-kit`.
   - **Dependencies**: `ExploreView.tsx`
   - **ICE Score**: I:6, C:8, E:5 (Total: 19)
   - **Priority**: P3 | **Effort**: 2 weeks

5. **"Rediscover" Smart Prompts**
   - **Description**: Prompt the user to tag unnamed faces or review unorganized imports.
   - **User Problem**: Organization tasks pile up.
   - **Implementation**: Add an actionable widget that surfaces small micro-tasks.
   - **Dependencies**: Face detection database.
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1.5 weeks

### C. Quick Wins
- **Greeting Personalization**: Change the header to "Good Morning, [Name]" based on local time.
- **Empty States**: Ensure robust, friendly empty states for "On This Day" if the user has a small library.

### D. Architecture Recommendations
- **Staggered Loading**: Use Suspense or staggered fetch requests to prevent the Dashboard from blocking the main thread while 5 different components query the backend simultaneously.

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

3. **Smart Album Generation**
   - **Description**: Tell the agent "Create an album of my dog at the beach" and it auto-generated it.
   - **User Problem**: Manual album creation is slow.
   - **Implementation**: Extend agent tools to execute DB writes (Create Album, Add Photos).
   - **Dependencies**: Agent tools definition.
   - **ICE Score**: I:8, C:9, E:7 (Total: 24)
   - **Priority**: P1 | **Effort**: 1 week

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
- **Contextual Agent Invocation**: Allow right-clicking a photo in the grid and selecting "Ask AI about this photo" to pre-fill the chat context.
- **Suggested Follow-ups**: After a search, provide 3 clickable chips (e.g., "Refine to only 2023", "Show only videos").

### D. Architecture Recommendations
- **Global Command Palette**: Decouple the Agent logic from `AgentView.tsx` so it can be invoked globally (e.g., via `Cmd+K`) as a floating command palette across the entire app.
