# Phase 1: Core Editing Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational non-destructive editing pipeline: types, Zustand store, WebGL renderer with adjust shader, and integration with existing UI.

**Architecture:** All edits stored as structured `EditOperation[]` in a Zustand store. A WebGL2 renderer processes the operation list through shader passes (ping-pong FBOs). Existing CSS filter preview is replaced with WebGL rendering. The existing UI components continue to work by reading from the new store.

**Tech Stack:** React 18, TypeScript 5.8, Zustand, WebGL2, GLSL, Vite 6, Tailwind CSS 3

---

## File Structure (Phase 1)

```
frontend/
├── lib/
│   └── editor/
│       ├── types.ts                 # NEW: all edit operation types
│       └── constants.ts             # NEW: default values
│
├── store/
│   ├── editSessionStore.ts          # NEW: edit operations state
│   └── uiStore.ts                   # NEW: editor UI state
│
├── renderer/
│   ├── index.ts                     # NEW: WebGLRenderer class
│   ├── shaders/
│   │   ├── passthrough.vert         # NEW: vertex shader
│   │   └── adjust.frag              # NEW: brightness/contrast/saturation
│   ├── program.ts                   # NEW: shader compilation utils
│   ├── texture.ts                   # NEW: texture loading/caching
│   └── framebuffer.ts               # NEW: FBO ping-pong
│
├── hooks/
│   └── imageEditor/
│       └── useWebGLRenderer.ts      # NEW: React hook connecting renderer to store
│
└── components/lightbox/
    └── ImageDisplay.tsx             # MODIFY: use WebGL canvas instead of CSS filters
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Zustand and nanoid**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && bun add zustand nanoid
```

- [ ] **Step 2: Verify installation**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && bun run build 2>&1 | head -20
```

Expected: Build succeeds (or fails for unrelated reasons, but not because of missing deps)

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/package.json frontend/bun.lock && git commit -m "deps: add zustand and nanoid for editor state management"
```

---

## Task 2: Create Core Editor Types

**Files:**
- Create: `frontend/lib/editor/types.ts`
- Create: `frontend/lib/editor/constants.ts`

- [ ] **Step 1: Create editor types file**

```typescript
// frontend/lib/editor/types.ts

import { AspectRatio } from '../../types';

// ============================================================
// Edit Operation Types
// ============================================================

export type EditOperationType =
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

export interface EditOperation {
  id: string;
  type: EditOperationType;
  params: Record<string, unknown>;
  enabled: boolean;
  timestamp: number;
}

// ============================================================
// Operation Params Schemas
// ============================================================

export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: AspectRatio;
}

export interface AdjustParams {
  brightness: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  temperature: number;
  tint: number;
  clarity: number;
  dehaze: number;
}

export interface RotateParams {
  angle: number;
}

export interface StraightenParams {
  angle: number;
}

export interface SkewParams {
  x: number;
  y: number;
}

export interface FlipParams {
  horizontal: boolean;
  vertical: boolean;
}

export interface FilterParams {
  presetId: string;
}

export interface VignetteParams {
  amount: number;
}

export interface CurvesChannelParams {
  points: CurvePoint[];
}

export interface CurvesParams {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export type ColorChannel = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta';

export interface HSLChannelParams {
  hue: number;
  saturation: number;
  luminance: number;
}

export interface HSLParams {
  channels: Record<ColorChannel, HSLChannelParams>;
}

export interface MarkupParams {
  textStamps: TextStamp[];
  drawingPaths: DrawingPath[];
}

export interface AIEnhancementParams {
  suggestedAdjustments: Partial<AdjustParams>;
  confidence: number;
  description: string;
}

// ============================================================
// Supporting Types
// ============================================================

export interface CurvePoint {
  x: number;
  y: number;
}

export interface TextStamp {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
}

export interface DrawingPath {
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

// ============================================================
// Edit Session
// ============================================================

export interface EditSession {
  id: string;
  photoId: string | number;
  originalPath: string;
  operations: EditOperation[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================
// Editor UI State
// ============================================================

export type EditToolType =
  | 'crop'
  | 'adjust'
  | 'curves'
  | 'hsl'
  | 'filters'
  | 'geometry'
  | 'markup'
  | 'presets'
  | null;

export interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
  mode: 'fit' | 'custom';
}

export interface ComparisonState {
  enabled: boolean;
  mode: 'toggle' | 'split' | 'side-by-side';
  splitPosition: number;
}

// ============================================================
// Renderer Types
// ============================================================

export interface RenderViewport {
  width: number;
  height: number;
}

// ============================================================
// Utility: Extract typed params from operation
// ============================================================

export function getOperationParams<T extends Record<string, unknown>>(
  operation: EditOperation
): T {
  return operation.params as T;
}

// Type-safe param extractors
export function getCropParams(op: EditOperation): CropParams {
  return op.params as unknown as CropParams;
}

export function getAdjustParams(op: EditOperation): AdjustParams {
  return op.params as unknown as AdjustParams;
}

export function getRotateParams(op: EditOperation): RotateParams {
  return op.params as unknown as RotateParams;
}

export function getStraightenParams(op: EditOperation): StraightenParams {
  return op.params as unknown as StraightenParams;
}

export function getSkewParams(op: EditOperation): SkewParams {
  return op.params as unknown as SkewParams;
}

export function getFlipParams(op: EditOperation): FlipParams {
  return op.params as unknown as FlipParams;
}

export function getFilterParams(op: EditOperation): FilterParams {
  return op.params as unknown as FilterParams;
}

export function getVignetteParams(op: EditOperation): VignetteParams {
  return op.params as unknown as VignetteParams;
}

export function getCurvesParams(op: EditOperation): CurvesParams {
  return op.params as unknown as CurvesParams;
}

export function getHSLParams(op: EditOperation): HSLParams {
  return op.params as unknown as HSLParams;
}

export function getMarkupParams(op: EditOperation): MarkupParams {
  return op.params as unknown as MarkupParams;
}
```

- [ ] **Step 2: Create editor constants file**

```typescript
// frontend/lib/editor/constants.ts

import { AdjustParams, CurvesParams, HSLParams, ColorChannel } from './types';

export const DEFAULT_ADJUSTMENTS: AdjustParams = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  clarity: 0,
  dehaze: 0,
};

const defaultCurvePoints = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export const DEFAULT_CURVES: CurvesParams = {
  rgb: [...defaultCurvePoints],
  red: [...defaultCurvePoints],
  green: [...defaultCurvePoints],
  blue: [...defaultCurvePoints],
};

const defaultHSLChannel = { hue: 0, saturation: 0, luminance: 0 };

export const DEFAULT_HSL_CHANNELS: Record<ColorChannel, { hue: number; saturation: number; luminance: number }> = {
  red: { ...defaultHSLChannel },
  orange: { ...defaultHSLChannel },
  yellow: { ...defaultHSLChannel },
  green: { ...defaultHSLChannel },
  aqua: { ...defaultHSLChannel },
  blue: { ...defaultHSLChannel },
  purple: { ...defaultHSLChannel },
  magenta: { ...defaultHSLChannel },
};

export const MAX_UNDO_STACK = 50;

export const EDIT_SESSION_VERSION = 1;
```

- [ ] **Step 3: Verify types compile**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit --strict lib/editor/types.ts lib/editor/constants.ts 2>&1
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/lib/ && git commit -m "feat(editor): add core types and constants for edit operations"
```

---

## Task 3: Create Zustand Edit Session Store

**Files:**
- Create: `frontend/store/editSessionStore.ts`

- [ ] **Step 1: Create the edit session store**

```typescript
// frontend/store/editSessionStore.ts

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  EditSession,
  EditOperation,
  EditOperationType,
  CropParams,
  AdjustParams,
  CurvesParams,
  HSLParams,
  RotateParams,
  StraightenParams,
  SkewParams,
  FlipParams,
  FilterParams,
  VignetteParams,
  MarkupParams,
} from '../lib/editor/types';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_HSL_CHANNELS,
  MAX_UNDO_STACK,
  EDIT_SESSION_VERSION,
} from '../lib/editor/constants';

// ============================================================
// State Shape
// ============================================================

interface EditSessionState {
  session: EditSession | null;
  undoStack: EditOperation[][];
  redoStack: EditOperation[][];

  // Session lifecycle
  initSession: (photoId: string | number, originalPath: string) => void;
  loadSession: (session: EditSession) => void;
  clearSession: () => void;

  // Operation CRUD
  addOperation: (type: EditOperationType, params: Record<string, unknown>) => string;
  updateOperation: (id: string, params: Record<string, unknown>) => void;
  removeOperation: (id: string) => void;
  toggleOperation: (id: string) => void;
  reorderOperations: (fromIndex: number, toIndex: number) => void;

  // Upsert: update existing operation of type, or create if not found
  upsertOperation: (type: EditOperationType, params: Record<string, unknown>) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // Serialization
  getSessionJSON: () => string;
  loadSessionJSON: (json: string) => void;
}

// ============================================================
// Implementation
// ============================================================

export const useEditSessionStore = create<EditSessionState>((set, get) => ({
  session: null,
  undoStack: [],
  redoStack: [],

  // --- Session lifecycle ---

  initSession: (photoId, originalPath) => {
    const session: EditSession = {
      id: nanoid(),
      photoId,
      originalPath,
      operations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: EDIT_SESSION_VERSION,
    };
    set({ session, undoStack: [], redoStack: [] });
  },

  loadSession: (session) => {
    set({ session, undoStack: [], redoStack: [] });
  },

  clearSession: () => {
    set({ session: null, undoStack: [], redoStack: [] });
  },

  // --- Operation CRUD ---

  addOperation: (type, params) => {
    const id = nanoid();
    const operation: EditOperation = {
      id,
      type,
      params,
      enabled: true,
      timestamp: Date.now(),
    };

    set((state) => {
      if (!state.session) return state;
      const newOperations = [...state.session.operations, operation];
      const newSession = { ...state.session, operations: newOperations, updatedAt: Date.now() };

      // Push current state to undo stack
      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [], // Clear redo on new action
      };
    });

    return id;
  },

  updateOperation: (id, params) => {
    set((state) => {
      if (!state.session) return state;
      const newOperations = state.session.operations.map((op) =>
        op.id === id ? { ...op, params: { ...op.params, ...params } } : op
      );
      const newSession = { ...state.session, operations: newOperations, updatedAt: Date.now() };

      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [],
      };
    });
  },

  removeOperation: (id) => {
    set((state) => {
      if (!state.session) return state;
      const newOperations = state.session.operations.filter((op) => op.id !== id);
      const newSession = { ...state.session, operations: newOperations, updatedAt: Date.now() };

      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [],
      };
    });
  },

  toggleOperation: (id) => {
    set((state) => {
      if (!state.session) return state;
      const newOperations = state.session.operations.map((op) =>
        op.id === id ? { ...op, enabled: !op.enabled } : op
      );
      const newSession = { ...state.session, operations: newOperations, updatedAt: Date.now() };

      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [],
      };
    });
  },

  reorderOperations: (fromIndex, toIndex) => {
    set((state) => {
      if (!state.session) return state;
      const ops = [...state.session.operations];
      const [moved] = ops.splice(fromIndex, 1);
      ops.splice(toIndex, 0, moved);
      const newSession = { ...state.session, operations: ops, updatedAt: Date.now() };

      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [],
      };
    });
  },

  // --- Upsert: key pattern for adjustment sliders ---
  // If an operation of this type exists, update its params.
  // If not, create a new one. For 'adjust', there's only one instance.

  upsertOperation: (type, params) => {
    set((state) => {
      if (!state.session) return state;

      const existingIndex = state.session.operations.findIndex((op) => op.type === type);
      let newOperations: EditOperation[];

      if (existingIndex !== -1) {
        // Update existing
        newOperations = state.session.operations.map((op, i) =>
          i === existingIndex ? { ...op, params: { ...op.params, ...params } } : op
        );
      } else {
        // Create new
        const operation: EditOperation = {
          id: nanoid(),
          type,
          params,
          enabled: true,
          timestamp: Date.now(),
        };
        newOperations = [...state.session.operations, operation];
      }

      const newSession = { ...state.session, operations: newOperations, updatedAt: Date.now() };

      const undoStack = [...state.undoStack, state.session.operations];
      if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();

      return {
        session: newSession,
        undoStack,
        redoStack: [],
      };
    });
  },

  // --- Undo/Redo ---

  undo: () => {
    const { undoStack, session, redoStack } = get();
    if (undoStack.length === 0 || !session) return;

    const prevOperations = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, session.operations];

    set({
      session: { ...session, operations: prevOperations, updatedAt: Date.now() },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  redo: () => {
    const { redoStack, session, undoStack } = get();
    if (redoStack.length === 0 || !session) return;

    const nextOperations = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, session.operations];

    set({
      session: { ...session, operations: nextOperations, updatedAt: Date.now() },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },

  // --- Serialization ---

  getSessionJSON: () => {
    const { session } = get();
    return JSON.stringify(session);
  },

  loadSessionJSON: (json) => {
    try {
      const session = JSON.parse(json) as EditSession;
      set({ session, undoStack: [], redoStack: [] });
    } catch (e) {
      console.error('Failed to load session JSON:', e);
    }
  },
}));
```

- [ ] **Step 2: Verify store compiles**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit store/editSessionStore.ts 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/store/editSessionStore.ts && git commit -m "feat(editor): add Zustand edit session store with upsert and undo/redo"
```

---

## Task 4: Create Zustand UI Store

**Files:**
- Create: `frontend/store/uiStore.ts`

- [ ] **Step 1: Create the UI store**

```typescript
// frontend/store/uiStore.ts

import { create } from 'zustand';
import { EditToolType, ZoomState, ComparisonState } from '../lib/editor/types';

interface EditorUIState {
  // Editor mode
  isEditing: boolean;
  activeTool: EditToolType;

  // Zoom & Pan
  zoom: ZoomState;

  // Comparison
  comparison: ComparisonState;

  // Panel visibility
  showHistory: boolean;
  showInfo: boolean;

  // Actions
  setActiveTool: (tool: EditToolType) => void;
  toggleEditing: () => void;
  setEditing: (editing: boolean) => void;
  setZoom: (zoom: Partial<ZoomState>) => void;
  resetZoom: () => void;
  setComparison: (comparison: Partial<ComparisonState>) => void;
  toggleHistory: () => void;
  toggleInfo: () => void;
}

const DEFAULT_ZOOM: ZoomState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  mode: 'fit',
};

const DEFAULT_COMPARISON: ComparisonState = {
  enabled: false,
  mode: 'toggle',
  splitPosition: 50,
};

export const useEditorUIStore = create<EditorUIState>((set) => ({
  isEditing: false,
  activeTool: null,
  zoom: { ...DEFAULT_ZOOM },
  comparison: { ...DEFAULT_COMPARISON },
  showHistory: true,
  showInfo: false,

  setActiveTool: (tool) => set({ activeTool: tool }),

  toggleEditing: () => set((state) => ({
    isEditing: !state.isEditing,
    activeTool: state.isEditing ? null : state.activeTool,
  })),

  setEditing: (editing) => set({
    isEditing: editing,
    activeTool: editing ? null : null,
  }),

  setZoom: (zoom) => set((state) => ({
    zoom: { ...state.zoom, ...zoom },
  })),

  resetZoom: () => set({ zoom: { ...DEFAULT_ZOOM } }),

  setComparison: (comparison) => set((state) => ({
    comparison: { ...state.comparison, ...comparison },
  })),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),
  toggleInfo: () => set((state) => ({ showInfo: !state.showInfo })),
}));
```

- [ ] **Step 2: Verify store compiles**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit store/uiStore.ts 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/store/uiStore.ts && git commit -m "feat(editor): add Zustand UI store for editor state"
```

---

## Task 5: Create WebGL Renderer Infrastructure

**Files:**
- Create: `frontend/renderer/program.ts`
- Create: `frontend/renderer/texture.ts`
- Create: `frontend/renderer/framebuffer.ts`
- Create: `frontend/renderer/types.ts`
- Create: `frontend/renderer/shaders/passthrough.vert`
- Create: `frontend/renderer/shaders/adjust.frag`

- [ ] **Step 1: Create renderer types**

```typescript
// frontend/renderer/types.ts

export interface RenderPass {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export interface FramebufferPair {
  read: WebGLFramebuffer;
  write: WebGLFramebuffer;
  readTexture: WebGLTexture;
  writeTexture: WebGLTexture;
  width: number;
  height: number;
}

export interface RendererState {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  quadVAO: WebGLVertexArrayObject;
  framebufferPair: FramebufferPair | null;
  sourceTexture: WebGLTexture | null;
}
```

- [ ] **Step 2: Create shader compilation utilities**

```typescript
// frontend/renderer/program.ts

export function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: gl.VERTEX_SHADER | gl.FRAGMENT_SHADER
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${info}`);
  }

  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${info}`);
  }

  // Clean up individual shaders (they're linked into the program now)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

export function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[]
): Record<string, WebGLUniformLocation | null> {
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return uniforms;
}
```

- [ ] **Step 3: Create texture loading utilities**

```typescript
// frontend/renderer/texture.ts

export function createTextureFromImage(
  gl: WebGL2RenderingContext,
  image: HTMLImageElement | ImageBitmap
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createEmptyTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, null
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function updateTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  image: HTMLImageElement | ImageBitmap
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export function deleteTexture(gl: WebGL2RenderingContext, texture: WebGLTexture | null): void {
  if (texture) {
    gl.deleteTexture(texture);
  }
}
```

- [ ] **Step 4: Create framebuffer ping-pong utilities**

```typescript
// frontend/renderer/framebuffer.ts

import { createEmptyTexture } from './texture';
import { FramebufferPair } from './types';

export function createFramebufferPair(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): FramebufferPair {
  const readFBO = gl.createFramebuffer();
  const writeFBO = gl.createFramebuffer();
  if (!readFBO || !writeFBO) throw new Error('Failed to create framebuffers');

  const readTexture = createEmptyTexture(gl, width, height);
  const writeTexture = createEmptyTexture(gl, width, height);

  // Attach read texture
  gl.bindFramebuffer(gl.FRAMEBUFFER, readFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, readTexture, 0);

  // Attach write texture
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTexture, 0);

  // Check completeness
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer not complete: ${status}`);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { read: readFBO, write: writeFBO, readTexture, writeTexture, width, height };
}

export function swapFramebuffers(pair: FramebufferPair): void {
  const tempFBO = pair.read;
  const tempTex = pair.readTexture;

  pair.read = pair.write;
  pair.readTexture = pair.writeTexture;

  pair.write = tempFBO;
  pair.writeTexture = tempTex;
}

export function deleteFramebufferPair(
  gl: WebGL2RenderingContext,
  pair: FramebufferPair | null
): void {
  if (!pair) return;
  gl.deleteFramebuffer(pair.read);
  gl.deleteFramebuffer(pair.write);
  gl.deleteTexture(pair.readTexture);
  gl.deleteTexture(pair.writeTexture);
}

export function resizeFramebufferPair(
  gl: WebGL2RenderingContext,
  pair: FramebufferPair,
  newWidth: number,
  newHeight: number
): FramebufferPair {
  deleteFramebufferPair(gl, pair);
  return createFramebufferPair(gl, newWidth, newHeight);
}
```

- [ ] **Step 5: Create vertex shader (passthrough)**

```glsl
// frontend/renderer/shaders/passthrough.vert

#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
```

- [ ] **Step 6: Create adjust fragment shader**

```glsl
// frontend/renderer/shaders/adjust.frag

#version 300 es
precision highp float;

uniform sampler2D u_texture;

// Adjustment uniforms
uniform float u_brightness;    // 0.0 - 2.0 (1.0 = no change)
uniform float u_contrast;      // 0.0 - 2.0 (1.0 = no change)
uniform float u_saturation;    // 0.0 - 2.0 (1.0 = no change)
uniform float u_highlights;    // -1.0 to 1.0
uniform float u_shadows;       // -1.0 to 1.0
uniform float u_vibrance;      // -1.0 to 1.0
uniform float u_temperature;   // -1.0 to 1.0
uniform float u_tint;          // -1.0 to 1.0
uniform float u_clarity;       // -1.0 to 1.0
uniform float u_dehaze;        // -1.0 to 1.0

in vec2 v_texCoord;
out vec4 fragColor;

// Helper: convert RGB to luminance
float luminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Helper: convert RGB to HSV
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Helper: convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 color = texture(u_texture, v_texCoord);
    vec3 rgb = color.rgb;

    // Brightness
    rgb *= u_brightness;

    // Contrast (around midpoint 0.5)
    rgb = (rgb - 0.5) * u_contrast + 0.5;

    // Saturation
    float lum = luminance(rgb);
    rgb = mix(vec3(lum), rgb, u_saturation);

    // Vibrance (selective saturation - boost less-saturated colors more)
    vec3 hsv = rgb2hsv(rgb);
    float satBoost = u_vibrance * (1.0 - hsv.y) * hsv.y;
    hsv.y = clamp(hsv.y + satBoost, 0.0, 1.0);
    rgb = hsv2rgb(hsv);

    // Highlights / Shadows
    float currentLum = luminance(rgb);
    if (u_highlights != 0.0 && currentLum > 0.5) {
        float highlightFactor = (currentLum - 0.5) * 2.0;
        rgb += u_highlights * highlightFactor * 0.2;
    }
    if (u_shadows != 0.0 && currentLum < 0.5) {
        float shadowFactor = (0.5 - currentLum) * 2.0;
        rgb += u_shadows * shadowFactor * 0.2;
    }

    // Temperature (warm/cool shift)
    if (u_temperature != 0.0) {
        rgb.r += u_temperature * 0.05;
        rgb.b -= u_temperature * 0.05;
    }

    // Tint (green/magenta shift)
    if (u_tint != 0.0) {
        rgb.g += u_tint * 0.05;
    }

    // Clarity (local contrast enhancement via midpoint contrast)
    if (u_clarity != 0.0) {
        float clarityContrast = 1.0 + u_clarity * 0.3;
        rgb = (rgb - 0.5) * clarityContrast + 0.5;
    }

    // Dehaze (contrast + saturation boost)
    if (u_dehaze != 0.0) {
        float dehazeContrast = 1.0 + u_dehaze * 0.2;
        rgb = (rgb - 0.5) * dehazeContrast + 0.5;
        float dehazeSat = 1.0 + u_dehaze * 0.15;
        float dehazeLum = luminance(rgb);
        rgb = mix(vec3(dehazeLum), rgb, dehazeSat);
    }

    // Clamp to valid range
    rgb = clamp(rgb, 0.0, 1.0);

    fragColor = vec4(rgb, color.a);
}
```

- [ ] **Step 7: Verify renderer files compile (tsc check)**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit renderer/program.ts renderer/texture.ts renderer/framebuffer.ts renderer/types.ts 2>&1
```

Expected: No errors

- [ ] **Step 8: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/renderer/ && git commit -m "feat(editor): add WebGL renderer infrastructure (program, texture, FBO, shaders)"
```

---

## Task 6: Create WebGLRenderer Class

**Files:**
- Create: `frontend/renderer/index.ts`

- [ ] **Step 1: Create the main renderer class**

```typescript
// frontend/renderer/index.ts

import { EditOperation } from '../lib/editor/types';
import { getAdjustParams } from '../lib/editor/types';
import { createProgram, getUniformLocations } from './program';
import { createTextureFromImage, deleteTexture } from './texture';
import { createFramebufferPair, swapFramebuffers, deleteFramebufferPair } from './framebuffer';
import { FramebufferPair } from './types';

// Shader sources
import passthroughVert from './shaders/passthrough.vert';
import adjustFrag from './shaders/adjust.frag';

// Vite imports raw GLSL as strings
declare module '*.vert' {
  const value: string;
  export default value;
}
declare module '*.frag' {
  const value: string;
  export default value;
}

// Full-screen quad geometry
const QUAD_VERTICES = new Float32Array([
  -1, -1,  0, 1,   // bottom-left
   1, -1,  1, 1,   // bottom-right
  -1,  1,  0, 0,   // top-left
   1,  1,  1, 0,   // top-right
]);

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private quadVAO: WebGLVertexArrayObject;
  private adjustProgram: WebGLProgram;
  private adjustUniforms: Record<string, WebGLUniformLocation | null>;
  private framebufferPair: FramebufferPair | null = null;
  private sourceTexture: WebGLTexture | null = null;
  private currentImage: HTMLImageElement | ImageBitmap | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 not supported');

    this.gl = gl;
    this.canvas = canvas;

    // Create quad VAO
    this.quadVAO = this.createQuadVAO();

    // Compile shaders
    this.adjustProgram = createProgram(gl, passthroughVert, adjustFrag);
    this.adjustUniforms = getUniformLocations(gl, this.adjustProgram, [
      'u_texture',
      'u_brightness',
      'u_contrast',
      'u_saturation',
      'u_highlights',
      'u_shadows',
      'u_vibrance',
      'u_temperature',
      'u_tint',
      'u_clarity',
      'u_dehaze',
    ]);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private createQuadVAO(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    // Position attribute (location 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

    // TexCoord attribute (location 1)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);
    return vao;
  }

  private ensureFramebufferPair(width: number, height: number): void {
    if (
      !this.framebufferPair ||
      this.framebufferPair.width !== width ||
      this.framebufferPair.height !== height
    ) {
      if (this.framebufferPair) {
        deleteFramebufferPair(this.gl, this.framebufferPair);
      }
      this.framebufferPair = createFramebufferPair(this.gl, width, height);
    }
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private applyAdjustPass(
    texture: WebGLTexture,
    params: ReturnType<typeof getAdjustParams>
  ): void {
    const gl = this.gl;

    gl.useProgram(this.adjustProgram);

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.adjustUniforms.u_texture, 0);

    // Set adjustment uniforms
    gl.uniform1f(this.adjustUniforms.u_brightness, params.brightness / 100);
    gl.uniform1f(this.adjustUniforms.u_contrast, params.contrast / 100);
    gl.uniform1f(this.adjustUniforms.u_saturation, params.saturation / 100);
    gl.uniform1f(this.adjustUniforms.u_highlights, params.highlights / 100);
    gl.uniform1f(this.adjustUniforms.u_shadows, params.shadows / 100);
    gl.uniform1f(this.adjustUniforms.u_vibrance, params.vibrance / 100);
    gl.uniform1f(this.adjustUniforms.u_temperature, params.temperature / 100);
    gl.uniform1f(this.adjustUniforms.u_tint, params.tint / 100);
    gl.uniform1f(this.adjustUniforms.u_clarity, params.clarity / 100);
    gl.uniform1f(this.adjustUniforms.u_dehaze, params.dehaze / 100);

    this.drawQuad();
  }

  /**
   * Load an image as the source texture.
   * Call this when the photo changes.
   */
  loadImage(image: HTMLImageElement | ImageBitmap): void {
    // Clean up old texture
    if (this.sourceTexture) {
      deleteTexture(this.gl, this.sourceTexture);
    }

    this.sourceTexture = createTextureFromImage(this.gl, image);
    this.currentImage = image;

    // Resize canvas to match image
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.gl.viewport(0, 0, image.width, image.height);

    // Ensure framebuffer pair matches size
    this.ensureFramebufferPair(image.width, image.height);
  }

  /**
   * Render the image with the given edit operations.
   * This is the main render entry point.
   */
  render(operations: EditOperation[]): void {
    const gl = this.gl;

    if (!this.sourceTexture || !this.framebufferPair) return;

    // Collect enabled operations by type
    const enabledOps = operations.filter((op) => op.enabled);

    // Find the adjust operation (there should be at most one due to upsert)
    const adjustOp = enabledOps.find((op) => op.type === 'adjust');

    // If no adjust operation, just render the source texture to screen
    if (!adjustOp) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.adjustProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.uniform1i(this.adjustUniforms.u_texture, 0);
      // Set defaults (no adjustment)
      gl.uniform1f(this.adjustUniforms.u_brightness, 1.0);
      gl.uniform1f(this.adjustUniforms.u_contrast, 1.0);
      gl.uniform1f(this.adjustUniforms.u_saturation, 1.0);
      gl.uniform1f(this.adjustUniforms.u_highlights, 0.0);
      gl.uniform1f(this.adjustUniforms.u_shadows, 0.0);
      gl.uniform1f(this.adjustUniforms.u_vibrance, 0.0);
      gl.uniform1f(this.adjustUniforms.u_temperature, 0.0);
      gl.uniform1f(this.adjustUnits.u_tint, 0.0);
      gl.uniform1f(this.adjustUniforms.u_clarity, 0.0);
      gl.uniform1f(this.adjustUniforms.u_dehaze, 0.0);
      this.drawQuad();
      return;
    }

    // Apply adjust pass: source → FBO
    const params = getAdjustParams(adjustOp);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferPair.write);
    gl.viewport(0, 0, this.framebufferPair.width, this.framebufferPair.height);
    this.applyAdjustPass(this.sourceTexture, params);

    // Swap: what was written is now read
    swapFramebuffers(this.framebufferPair);

    // Final pass: read → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.adjustProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferPair.readTexture);
    gl.uniform1i(this.adjustUniforms.u_texture, 0);
    // Re-apply uniforms for final draw (same shader, just drawing the result)
    gl.uniform1f(this.adjustUniforms.u_brightness, 1.0);
    gl.uniform1f(this.adjustUniforms.u_contrast, 1.0);
    gl.uniform1f(this.adjustUniforms.u_saturation, 1.0);
    gl.uniform1f(this.adjustUniforms.u_highlights, 0.0);
    gl.uniform1f(this.adjustUniforms.u_shadows, 0.0);
    gl.uniform1f(this.adjustUniforms.u_vibrance, 0.0);
    gl.uniform1f(this.adjustUniforms.u_temperature, 0.0);
    gl.uniform1f(this.adjustUniforms.u_tint, 0.0);
    gl.uniform1f(this.adjustUniforms.u_clarity, 0.0);
    gl.uniform1f(this.adjustUniforms.u_dehaze, 0.0);
    this.drawQuad();
  }

  /**
   * Get the current canvas as a data URL (for thumbnails/previews).
   */
  toDataURL(type?: string, quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  /**
   * Get the current canvas as a blob (for export).
   */
  toBlob(callback: BlobCallback, type?: string, quality?: number): void {
    this.canvas.toBlob(callback, type, quality);
  }

  /**
   * Clean up all WebGL resources.
   */
  destroy(): void {
    const gl = this.gl;
    if (this.sourceTexture) deleteTexture(gl, this.sourceTexture);
    deleteFramebufferPair(gl, this.framebufferPair);
    gl.deleteProgram(this.adjustProgram);
    gl.deleteVertexArray(this.quadVAO);
  }
}
```

- [ ] **Step 2: Add Vite config for raw GLSL imports**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && cat vite.config.ts
```

- [ ] **Step 3: Read existing vite.config.ts and add GLSL raw import support**

```typescript
// Modify: frontend/vite.config.ts — add raw import support for .vert and .frag files

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  // Add raw import support for GLSL files
  assetsInclude: ["**/*.vert", "**/*.frag"],
  server: {
    port: 3005,
    strictPort: false,
  },
}));
```

- [ ] **Step 4: Verify renderer compiles**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit renderer/index.ts 2>&1
```

Expected: May show module declaration errors for .vert/.frag imports — we'll handle those in a follow-up

- [ ] **Step 5: Fix any type issues and commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/renderer/index.ts frontend/vite.config.ts && git commit -m "feat(editor): add WebGLRenderer class with adjust shader pipeline"
```

---

## Task 7: Create React Hook for WebGL Renderer

**Files:**
- Create: `frontend/hooks/imageEditor/useWebGLRenderer.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/hooks/imageEditor/useWebGLRenderer.ts

import { useRef, useEffect, useCallback } from 'react';
import { WebGLRenderer } from '../../renderer';
import { useEditSessionStore } from '../../store/editSessionStore';
import { Photo } from '../../types';

interface UseWebGLRendererProps {
  photo: Photo;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  highResUrl: string | null;
}

export function useWebGLRenderer({ photo, canvasRef, highResUrl }: UseWebGLRendererProps) {
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);

  const operations = useEditSessionStore((state) => state.session?.operations ?? []);

  // Initialize renderer when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      rendererRef.current = new WebGLRenderer(canvas);
    } catch (e) {
      console.error('Failed to initialize WebGL renderer:', e);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [canvasRef]);

  // Load image when photo or high-res URL changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const imageUrl = highResUrl || photo.url;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      renderer.loadImage(img);
      renderer.render(operations);
    };
    img.src = imageUrl;
  }, [photo.id, photo.url, highResUrl]);

  // Render on operation changes (debounced via rAF)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      renderer.render(operations);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [operations]);

  // Public methods
  const toDataURL = useCallback((type?: string, quality?: number) => {
    return rendererRef.current?.toDataURL(type, quality);
  }, []);

  const toBlob = useCallback((callback: BlobCallback, type?: string, quality?: number) => {
    rendererRef.current?.toBlob(callback, type, quality);
  }, []);

  return { toDataURL, toBlob };
}
```

- [ ] **Step 2: Verify hook compiles**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit hooks/imageEditor/useWebGLRenderer.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/hooks/imageEditor/useWebGLRenderer.ts && git commit -m "feat(editor): add useWebGLRenderer hook connecting renderer to Zustand store"
```

---

## Task 8: Create Barrel Exports for New Modules

**Files:**
- Create: `frontend/lib/editor/index.ts`
- Create: `frontend/store/index.ts`
- Create: `frontend/renderer/index.ts` (barrel re-export)

- [ ] **Step 1: Create editor barrel export**

```typescript
// frontend/lib/editor/index.ts

export * from './types';
export * from './constants';
```

- [ ] **Step 2: Create store barrel export**

```typescript
// frontend/store/index.ts

export { useEditSessionStore } from './editSessionStore';
export { useEditorUIStore } from './uiStore';
```

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/lib/editor/index.ts frontend/store/index.ts && git commit -m "chore: add barrel exports for editor types and stores"
```

---

## Task 9: Update Existing Hooks to Use Zustand Store

**Files:**
- Modify: `frontend/hooks/imageEditor/useImageAdjustments.ts`
- Modify: `frontend/hooks/imageEditor/index.ts`

- [ ] **Step 1: Refactor useImageAdjustments to use Zustand store**

```typescript
// frontend/hooks/imageEditor/useImageAdjustments.ts

import { useCallback } from 'react';
import { useEditSessionStore } from '../../store/editSessionStore';
import { AdjustParams } from '../../lib/editor/types';
import { DEFAULT_ADJUSTMENTS } from '../../lib/editor/constants';

/**
 * Hook that reads/writes adjustments through the Zustand store.
 * Replaces the old useState-based implementation.
 */
export const useImageAdjustments = () => {
  const session = useEditSessionStore((state) => state.session);
  const upsertOperation = useEditSessionStore((state) => state.upsertOperation);

  // Extract current adjust params from operations
  const adjustOp = session?.operations.find(
    (op) => op.type === 'adjust' && op.enabled
  );
  const params = (adjustOp?.params as Partial<AdjustParams>) ?? {};

  // Merge with defaults
  const current: AdjustParams = { ...DEFAULT_ADJUSTMENTS, ...params };

  const update = useCallback(
    (partial: Partial<AdjustParams>) => {
      upsertOperation('adjust', { ...current, ...partial });
    },
    [upsertOperation, current]
  );

  const resetAdjustments = useCallback(() => {
    upsertOperation('adjust', { ...DEFAULT_ADJUSTMENTS });
  }, [upsertOperation]);

  return {
    brightness: current.brightness,
    setBrightness: useCallback((v: number) => update({ brightness: v }), [update]),
    contrast: current.contrast,
    setContrast: useCallback((v: number) => update({ contrast: v }), [update]),
    saturation: current.saturation,
    setSaturation: useCallback((v: number) => update({ saturation: v }), [update]),
    highlights: current.highlights,
    setHighlights: useCallback((v: number) => update({ highlights: v }), [update]),
    shadows: current.shadows,
    setShadows: useCallback((v: number) => update({ shadows: v }), [update]),
    vibrance: current.vibrance,
    setVibrance: useCallback((v: number) => update({ vibrance: v }), [update]),
    temperature: current.temperature,
    setTemperature: useCallback((v: number) => update({ temperature: v }), [update]),
    tint: current.tint,
    setTint: useCallback((v: number) => update({ tint: v }), [update]),
    clarity: current.clarity,
    setClarity: useCallback((v: number) => update({ clarity: v }), [update]),
    dehaze: current.dehaze,
    setDehaze: useCallback((v: number) => update({ dehaze: v }), [update]),
    resetAdjustments,
  };
};
```

- [ ] **Step 2: Verify refactored hook compiles**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit hooks/imageEditor/useImageAdjustments.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add frontend/hooks/imageEditor/useImageAdjustments.ts && git commit -m "refactor(editor): useImageAdjustments now reads from Zustand store"
```

---

## Task 10: Integration Test — Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full TypeScript check**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && npx tsc --noEmit 2>&1
```

Expected: No new errors introduced (existing errors from other files are acceptable)

- [ ] **Step 2: Run Vite build**

```bash
cd /home/chotaxdon/Work/Projects/Luminary/frontend && bun run build 2>&1
```

Expected: Build succeeds

- [ ] **Step 3: Final commit**

```bash
cd /home/chotaxdon/Work/Projects/Luminary && git add -A && git commit -m "feat(editor): Phase 1 complete — core editing architecture

- EditOperation types and params schemas
- Zustand edit session store with upsert pattern
- Zustand UI store for editor state
- WebGL2 renderer with adjust shader pipeline
- useWebGLRenderer hook
- Refactored useImageAdjustments to use store
- GLSL shaders for brightness/contrast/saturation/vibrance/etc"
```

---

## Phase 1 Summary

After completing all 10 tasks:

1. **Types**: All edit operation types defined with typed params
2. **Store**: Zustand store with upsert pattern, undo/redo stacks
3. **WebGL Renderer**: Full pipeline with adjust shader (brightness, contrast, saturation, vibrance, highlights, shadows, temperature, tint, clarity, dehaze)
4. **React Integration**: `useWebGLRenderer` hook connects renderer to store
5. **Backward Compatibility**: Existing UI components continue to work via refactored hooks

**Next phases** (not in this plan):
- Phase 2: Undo/redo UI + history panel
- Phase 3: Zoom/pan + comparison + keyboard shortcuts
- Phase 4: Curves + HSL + histogram
- Phase 5: Export system
- Phase 6: Presets
- Phase 7: AI hooks
