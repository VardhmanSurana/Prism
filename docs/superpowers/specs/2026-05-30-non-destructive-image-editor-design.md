# Luminary Photos — Non-Destructive Image Editor Design Spec

## Overview

A professional-grade, non-destructive image editing system for Luminary Photos (Tauri + React + TypeScript). Architecture comparable to Lightroom's editing pipeline, optimized for privacy-first desktop use with local-only processing.

**Key decisions:**
- Rendering: WebGL2 shader pipeline (GPU-accelerated)
- State: Zustand store with operation-based undo/redo
- Curves: Cubic Bezier interpolation
- Incremental per-phase PRs

---

## 1. Core Types & Data Model

All edits are structured data — never pixel mutations.

```ts
type EditOperationType =
  | 'crop'
  | 'rotate'
  | 'straighten'
  | 'skew'
  | 'flip'
  | 'adjust'
  | 'curves'
  | 'hsl'
  | 'filter'
  | 'vignette'
  | 'markup'
  | 'aiEnhancement';

interface EditOperation {
  id: string;
  type: EditOperationType;
  params: Record<string, unknown>;
  enabled: boolean;
  timestamp: number;
}
```

### Operation Params Schemas

```ts
interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: AspectRatio;
}

interface AdjustParams {
  brightness: number;   // 0-200, default 100
  contrast: number;     // 0-200, default 100
  saturation: number;   // 0-200, default 100
  highlights: number;   // -100 to 100
  shadows: number;
  vibrance: number;
  temperature: number;
  tint: number;
  clarity: number;
  dehaze: number;
}

interface CurvesParams {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

interface HSLParams {
  channels: Record<ColorChannel, {
    hue: number;
    saturation: number;
    luminance: number;
  }>;
}

interface FilterParams {
  presetId: string;
}

interface VignetteParams {
  amount: number;
}

interface RotateParams {
  angle: number;
}

interface StraightenParams {
  angle: number;
}

interface SkewParams {
  x: number;
  y: number;
}

interface FlipParams {
  horizontal: boolean;
  vertical: boolean;
}

interface MarkupParams {
  textStamps: TextStamp[];
  drawingPaths: DrawingPath[];
}

interface AIEnhancementParams {
  suggestedAdjustments: Partial<AdjustParams>;
  confidence: number;
  description: string;
}
```

### Edit Session

```ts
interface EditSession {
  id: string;
  photoId: string | number;
  originalPath: string;
  operations: EditOperation[];
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### Supporting Types

```ts
interface CurvePoint {
  x: number;  // 0-255 input
  y: number;  // 0-255 output
}

type ColorChannel = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta';

interface TextStamp {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
}

interface DrawingPath {
  color: string;
  size: number;
  points: { x: number; y: number }[];
}
```

---

## 2. State Management (Zustand)

Introduce Zustand as centralized state management. Replaces flat `useState` hooks.

### Edit Session Store

```ts
interface EditSessionState {
  session: EditSession | null;
  addOperation: (type: EditOperationType, params: Record<string, unknown>) => string;
  updateOperation: (id: string, params: Record<string, unknown>) => void;
  removeOperation: (id: string) => void;
  toggleOperation: (id: string) => void;
  reorderOperations: (fromIndex: number, toIndex: number) => void;
  upsertOperation: (type: EditOperationType, params: Record<string, unknown>) => void;
  loadSession: (session: EditSession) => void;
  clearSession: () => void;
  getSessionJSON: () => string;
  loadSessionJSON: (json: string) => void;
}
```

### Undo/Redo State

```ts
interface UndoRedoState {
  undoStack: EditOperation[][];
  redoStack: EditOperation[][];
  pushState: (operations: EditOperation[]) => void;
  undo: () => EditOperation[] | null;
  redo: () => EditOperation[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearStacks: () => void;
}
```

### UI Store

```ts
interface EditorUIState {
  isEditing: boolean;
  activeTool: EditToolType;
  zoom: ZoomState;
  comparison: ComparisonState;
  showHistory: boolean;
  showInfo: boolean;
}

interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
  mode: 'fit' | 'custom';
}

interface ComparisonState {
  enabled: boolean;
  mode: 'toggle' | 'split' | 'side-by-side';
  splitPosition: number;
}

type EditToolType = 'crop' | 'adjust' | 'curves' | 'hsl' | 'filters' | 'geometry' | 'markup' | 'presets' | null;
```

---

## 3. WebGL Rendering Pipeline

### Architecture

```
Original Image (texture)
    ↓
Pass 1: Crop + Geometry Transform
Pass 2: Adjustments (B/C/S/H/S)
Pass 3: Curves LUT
Pass 4: HSL per-channel
Pass 5: Vignette
Pass 6: Filter preset
    ↓
Canvas Display
```

### File Structure

```
src/renderer/
├── index.ts                    # WebGLRenderer class
├── shaders/
│   ├── passthrough.vert        # Vertex shader (shared)
│   ├── adjust.frag             # Brightness/contrast/saturation
│   ├── curves.frag             # Tone curve LUT application
│   ├── hsl.frag                # Per-channel HSL adjustment
│   ├── vignette.frag           # Radial vignette
│   └── filter.frag             # Preset filter LUT
├── program.ts                  # Shader compilation utils
├── texture.ts                  # Texture loading/caching
├── framebuffer.ts              # FBO ping-pong management
├── lutGenerator.ts             # LUT generation for curves
└── types.ts                    # Renderer types
```

### Key Shaders

#### Curves Shader (curves.frag)

Applies cubic Bezier tone curve via LUT texture. Per-channel LUTs (R, G, B) plus combined RGB LUT. Each LUT is a 256x1 texture.

#### HSL Shader (hsl.frag)

Per-color-band HSL adjustment. 8 color channels with Gaussian-weighted hue range masking. Smooth falloff for natural blending between adjacent channels.

#### Adjust Shader (adjust.frag)

Brightness, contrast, saturation, highlights, shadows, vibrance, temperature, tint, clarity, dehaze. Single pass with all uniforms.

### WebGLRenderer Class

```ts
class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private programs: Map<string, WebGLProgram>;
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  private lutTexture: WebGLTexture;

  constructor(canvas: HTMLCanvasElement) {}

  render(
    image: HTMLImageElement | ImageBitmap,
    operations: EditOperation[],
    viewport: { width: number; height: number }
  ): void {}

  generateCurveLUT(points: CurvePoint[]): WebGLTexture {}
  destroy(): void {}
}
```

### Performance Strategy

1. Ping-pong FBOs to avoid GPU read-write hazards
2. Downscaled preview (50%/25%) for UI, full res for export
3. 16ms debounce on slider changes (60fps cap)
4. Lazy shader compilation for active operations only
5. Source image texture cached across renders
6. Curve LUTs cached per unique point set

### Fallback

Graceful degradation to CSS filters if WebGL2 unavailable (unlikely in Tauri). Curves/HSL disabled with message.

---

## 4. Undo/Redo System

### Strategy: Operation-based Array Snapshots

Stores snapshots of the `operations` array. Since operations are small JSON objects, memory is negligible (~100KB for 50-entry stack).

```ts
// Zustand middleware
const MAX_UNDO_STACK = 50;

undo: () => {
  const { undoStack, operations, redoStack } = get();
  if (undoStack.length === 0) return;
  const prev = undoStack[undoStack.length - 1];
  set({
    operations: prev,
    undoStack: undoStack.slice(0, -1),
    redoStack: [...redoStack, operations],
  });
}

redo: () => {
  const { redoStack, operations, undoStack } = get();
  if (redoStack.length === 0) return;
  const next = redoStack[redoStack.length - 1];
  set({
    operations: next,
    redoStack: redoStack.slice(0, -1),
    undoStack: [...undoStack, operations],
  });
}
```

### Keyboard Shortcuts

```
Ctrl/Cmd+Z       → Undo
Ctrl/Cmd+Shift+Z → Redo
Ctrl/Cmd+Y       → Redo
```

### History Panel

Reads from `undoStack` to display past states. Each entry corresponds to one operation. Current state is always the live `operations` array.

---

## 5. Image Controls

### Zoom & Pan

- Scroll to zoom centered on cursor
- Double-click toggles 100% / Fit
- Space + drag for panning
- Zoom range: 10% – 1000%
- Transform via CSS transform on canvas container
- WebGL renders at current zoom level resolution

```ts
interface ZoomState {
  scale: number;       // 0.1 to 10.0
  offsetX: number;
  offsetY: number;
  mode: 'fit' | 'custom';
}
```

### Before/After Comparison

- Toggle: hold "\" key
- Split: draggable vertical divider
- Side-by-side: two canvases

```ts
interface ComparisonState {
  enabled: boolean;
  mode: 'toggle' | 'split' | 'side-by-side';
  splitPosition: number;
}
```

---

## 6. Color Tools

### Curves Editor

Cubic Bezier interpolation between control points. Each channel (RGB, Red, Green, Blue) has independent control points.

**LUT generation:**
```ts
function generateLUT(points: CurvePoint[]): Uint8Array {
  // For each input 0-255, evaluate cubic Bezier to get output
  // Returns 256-entry lookup table
}
```

**UI:** Canvas-based curve display with click-to-add, drag-to-move, right-click-to-remove. Channel tabs. Histogram overlay.

### HSL Panel

8 color channels: Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta.

Each channel: Hue (-100 to +100), Saturation (-100 to +100), Luminance (-100 to +100).

Color ranges with Gaussian-weighted hue masking for smooth transitions between adjacent channels.

### Histogram

Computed from downscaled preview image. Displays:
- Luminance channel (white)
- RGB channels (semi-transparent overlaid)
- Shadow/highlight clipping indicators

Computed in Web Worker to avoid blocking main thread.

---

## 7. Export System

### Formats

JPEG, PNG, WebP, TIFF

### Export Options

```ts
interface ExportOptions {
  format: 'jpeg' | 'png' | 'webp' | 'tiff';
  quality: number;
  resize?: { enabled: boolean; maxWidth: number; maxHeight: number };
  preserveMetadata: boolean;
  outputPath: string;
}
```

### Presets

| Preset | Format | Quality | Resize | Metadata |
|--------|--------|---------|--------|----------|
| Web | JPEG | 85 | 2048px | No |
| Social | JPEG | 90 | 1080px | No |
| Print | TIFF | 100 | None | Yes |
| Archive | PNG | 100 | None | Yes |

### Export Flow

1. Create offscreen canvas at full resolution
2. Create WebGLRenderer on offscreen canvas
3. Render all operations at full res
4. `canvas.toBlob()` with format/quality
5. POST to backend `/api/v1/photos/save-edit`
6. Backend writes file, returns updated photo
7. Show progress indicator (non-blocking)

---

## 8. Presets System

```ts
interface EditPreset {
  id: string;
  name: string;
  description: string;
  operations: Omit<EditOperation, 'id' | 'timestamp'>[];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}
```

Storage: JSON files in app data directory via Tauri API (`~/.local/share/luminary/presets/`).

Operations: Save, Apply, Edit (rename/description), Delete, Import/Export.

---

## 9. AI Extensibility (Architecture Only)

```ts
interface AIProvider {
  autoEnhance(image: ImageData): Promise<AIEnhancement>;
  suggestCrop(image: ImageData): Promise<AICropSuggestion[]>;
  segmentBackground(image: ImageData): Promise<ImageData>;
}

interface AIEnhancement {
  suggestedAdjustments: Partial<AdjustParams>;
  confidence: number;
  description: string;
}

interface AICropSuggestion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  description: string;
}
```

Pluggable via `registerAIProvider()`. If null, AI features hidden from UI.

---

## 10. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Arrow Left/Right | Navigate photos |
| Escape | Exit editing / close lightbox |
| Space + drag | Pan |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+Y | Redo |
| R | Rotate 90° |
| F | Flip horizontal |
| 0 | Fit to screen |
| 1 | Zoom to 100% |
| + / - | Zoom in/out |
| C | Crop tool |
| A | Adjust panel |
| T | Curves panel |
| H | HSL panel |
| L | Filters panel |
| \ (hold) | Before/after toggle |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Shift+S | Save as copy |

---

## 11. File Structure

```
frontend/
├── store/
│   ├── editSessionStore.ts      # NEW
│   ├── uiStore.ts               # NEW
│   └── undoRedoMiddleware.ts    # NEW
│
├── renderer/
│   ├── index.ts                 # NEW: WebGLRenderer
│   ├── shaders/
│   │   ├── passthrough.vert     # NEW
│   │   ├── adjust.frag          # NEW
│   │   ├── curves.frag          # NEW
│   │   ├── hsl.frag             # NEW
│   │   ├── vignette.frag        # NEW
│   │   └── filter.frag          # NEW
│   ├── program.ts               # NEW
│   ├── texture.ts               # NEW
│   ├── framebuffer.ts           # NEW
│   ├── lutGenerator.ts          # NEW
│   └── types.ts                 # NEW
│
├── curves/
│   ├── bezier.ts                # NEW
│   └── lutGenerator.ts          # NEW
│
├── hsl/
│   ├── colorRanges.ts           # NEW
│   └── computeHSL.ts            # NEW
│
├── histogram/
│   └── computeHistogram.ts      # NEW
│
├── components/lightbox/
│   ├── EditingControls/
│   │   ├── panels/
│   │   │   ├── CurvesPanel.tsx  # NEW
│   │   │   ├── HSLPanel.tsx     # NEW
│   │   │   └── PresetsPanel.tsx # NEW
│   │   └── components/
│   │       └── CurvesCanvas.tsx # NEW
│   ├── Histogram.tsx            # NEW
│   ├── ComparisonView.tsx       # NEW
│   ├── ExportDialog.tsx         # NEW
│   └── KeyboardShortcuts.ts     # NEW
│
├── hooks/
│   ├── imageEditor/             # REFACTOR
│   └── useKeyboardShortcuts.ts  # NEW
│
└── types.ts                     # EXTEND
```

---

## 12. Performance Requirements

- WebGL2 GPU-accelerated rendering
- Ping-pong FBOs for multi-pass rendering
- Downscaled preview for UI, full res for export
- 16ms debounce on slider updates
- Lazy shader compilation
- Texture and LUT caching
- Web Worker for histogram computation
- Operation batching for rapid changes
- `requestAnimationFrame` for all UI animations

---

## 13. Implementation Phases

### Phase 1: Core Editing Architecture
- Core types and data model
- Zustand store with upsert pattern
- WebGL renderer shell (passthrough + adjust shaders)
- Replace CSS filter preview with WebGL
- Integration with existing UI components

### Phase 2: State & History Management
- Undo/redo middleware
- History panel upgrade
- Jump-to-state
- Clear history

### Phase 3: Image Controls
- Zoom & pan system
- Before/after comparison (toggle + split)
- Keyboard shortcuts registry

### Phase 4: Color Tools
- Curves editor (cubic Bezier + LUT)
- HSL panel (8 color channels)
- Histogram (Web Worker)

### Phase 5: Export System
- Export dialog with presets
- Full-resolution rendering pipeline
- Backend integration

### Phase 6: Presets System
- Save/load/edit presets
- Preset storage via Tauri API
- Import/export

### Phase 7: AI Extensibility
- AI provider interface
- Pluggable hooks
- UI integration stubs

---

## 14. Acceptance Criteria

- All edits are non-destructive (operations stored as JSON)
- Undo/redo works reliably with Ctrl+Z / Ctrl+Shift+Z
- Curves update image in real-time via WebGL
- HSL works correctly per color band with smooth transitions
- Export produces correct output at full resolution
- Performance remains responsive on 20MP images
- Edit sessions can be saved/loaded as JSON
- Architecture allows adding new tools without refactoring core
- Existing editing features (crop, adjust, filters, geometry, markup) continue to work
