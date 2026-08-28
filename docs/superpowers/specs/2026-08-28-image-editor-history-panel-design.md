# Image Editor History Panel & Non-Destructive Edit Timeline Design Spec

## 1. Overview & Goals

This specification details the architecture, UI/UX design, state management, and animation model for the **History Panel** in Prism's Image Editor.

The History Panel provides users with a visual, chronological timeline of all adjustments, crops, annotations, and AI operations performed during an image editing session. Users can selectively hide (bypass), delete, or edit individual history steps non-destructively through hover-activated text controls with zero icons, accompanied by GSAP motion animations.

---

## 2. Key Requirements & UX Principles

1. **Dedicated Sidebar Tab**: Positioned inside the Image Editor's right tool sidebar (`activeTool === 'history'`) alongside Adjust, Layers, Presets, Annotations, etc.
2. **Connected Thread Timeline**: A vertical track connecting glowing circular nodes representing each edit state from baseline ("Original Image") to the latest active state.
3. **Hover-Only Text Actions (No Icons)**:
   - On row hover, action links (`hide`/`unhide`, `del`, `edit`) smoothly reveal without any icon clutter.
   - For parametric adjustments: `hide` (or `unhide`), `del`, `edit`.
   - For raster/AI snapshots (e.g. Magic Eraser, AI Background): `revert`, `del`.
4. **Non-Destructive Selective Bypass**:
   - `hide`: Bypasses only that specific adjustment in the live filter pipeline without discarding subsequent edits. The timeline entry is rendered in strikethrough with muted opacity.
   - `del`: Permanently removes that edit step from the history stack and re-evaluates active adjustments.
   - `edit`: Automatically switches the sidebar tool tab to the corresponding tool (e.g., Adjust panel with Exposure focused) so the user can modify values.
5. **GSAP Motion & Micro-Interactions**:
   - Powered by `gsap` and `@gsap/react` (`useGSAP`).
   - Smooth entrance cascades (`gsap.from`), active glowing node transitions, strikethrough wipe animations on hide, and height collapse on delete.
6. **Memory Safety**:
   - Immediate disposal of blob URLs (`URL.revokeObjectURL`) when deleting raster snapshot history entries.
   - Strict baseline protection: the root "Original Image" entry cannot be deleted or hidden.

---

## 3. Data Architecture & State Management

### 3.1 Data Structures (`history.ts`)

```typescript
import { Adjustments } from './filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import type { ToolId } from './Sidebar';

export type HistoryActionType =
  | 'crop'
  | 'rotate'
  | 'flip'
  | 'straighten'
  | 'brightness'
  | 'contrast'
  | 'exposure'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'vibrance'
  | 'saturation'
  | 'hue'
  | 'temperature'
  | 'tint'
  | 'clarity'
  | 'sharpness'
  | 'noiseReduction'
  | 'ambiance'
  | 'curves'
  | 'vignette'
  | 'splitToning'
  | 'grain'
  | 'lightLeak'
  | 'frame'
  | 'blend'
  | 'tiltShift'
  | 'annotations'
  | 'layer'
  | 'inpaint'
  | 'initial';

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  description: string;
  value?: number;
  imageSrc: string;
  adjustments: Adjustments;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straightenAngle: number;
  annotations?: Annotation[];
  hidden?: boolean;
  isSnapshot?: boolean;
  toolId?: ToolId;
  settingKey?: keyof Adjustments;
}
```

### 3.2 Non-Destructive Adjustment Recomputation (`historyUtils.ts` / `useEditingHistory.ts`)

When an entry is toggled `hidden` or deleted, the active adjustments are recomputed:

```typescript
export function recomputeActiveAdjustments(
  history: HistoryEntry[],
  baseAdjustments: Adjustments
): Adjustments {
  let result = { ...baseAdjustments };

  for (const entry of history) {
    if (entry.hidden || entry.type === 'initial') continue;

    if (entry.settingKey && entry.value !== undefined) {
      (result as any)[entry.settingKey] = entry.value;
    } else if (entry.adjustments) {
      // For complex multi-key adjustments (curves, hsl, splitToning, grain, etc.)
      result = { ...result, ...entry.adjustments };
    }
  }

  return result;
}
```

### 3.3 Hook Actions (`useEditingHistory.ts`)

The `useEditingHistory` hook exposes:
- `history: HistoryEntry[]`
- `currentHistoryIndex: number`
- `toggleHideHistoryEntry: (id: string) => void`
- `deleteHistoryEntry: (id: string) => void`
- `jumpToHistoryEntry: (index: number) => void`
- `addHistoryEntry: (...) => void`
- `handleUndo`, `handleRedo`, `canUndo`, `canRedo`

---

## 4. UI Component Architecture (`HistoryPanel.tsx`)

### 4.1 Component Hierarchy
```
EditingMode.tsx
 └── Sidebar.tsx (Tab: 'history')
      └── HistoryPanel.tsx
           ├── Header (Step counter, Reset all)
           ├── TimelineContainer (Vertical connecting line)
           │    └── TimelineItem (GSAP animated)
           │         ├── TimelineDot (Glowing active / muted / dashed hidden)
           │         ├── Content (Label, value, strikethrough state)
           │         └── HoverActions (Pure text: hide/unhide, del, edit, revert)
           └── EmptyState (When only original image exists)
```

### 4.2 GSAP Motion Implementation
- Utilizes `useGSAP` with scoped ref container.
- **Entry cascade**: `gsap.from('.history-item', { opacity: 0, y: 10, stagger: 0.04, ease: 'power2.out', duration: 0.25 })`.
- **Item deletion**: `gsap.to(itemRef, { height: 0, opacity: 0, duration: 0.2, ease: 'power2.inOut', onComplete: () => deleteEntry(id) })`.
- **Active Node Pulse**: Subtle glow animation on the current history step.

---

## 5. Tool Switching & Edit Interaction

Mapping between `HistoryActionType` and `ToolId`:
- `brightness` | `contrast` | `exposure` | `highlights` | `shadows` | `whites` | `blacks` | `vibrance` | `saturation` | `temperature` | `tint` | `clarity` | `sharpness` | `vignette` $\rightarrow$ `activeTool = 'adjust'`
- `hsl` $\rightarrow$ `activeTool = 'hsl'`
- `curves` $\rightarrow$ `activeTool = 'curves'` (or adjust curves)
- `grain` | `lightLeak` | `frame` $\rightarrow$ `activeTool = 'texture'` / `activeTool = 'frame'`
- `crop` | `rotate` | `flip` | `straighten` $\rightarrow$ `activeTool = 'transform'`
- `annotations` $\rightarrow$ `activeTool = 'annotations'`
- `inpaint` $\rightarrow$ `activeTool = 'inpaint'`
- `layer` $\rightarrow$ `activeTool = 'layers'`

---

## 6. Testing & Quality Assurance Plan

1. **Unit Tests (`__tests__/history.test.ts`)**:
   - Test adding history entries and verifying stack bounded limits.
   - Test `toggleHideHistoryEntry` toggles `hidden` flag and correctly recomputes folded `adjustments`.
   - Test `deleteHistoryEntry` deletes specific entries, updates `currentHistoryIndex`, and maintains stack integrity.
   - Test blob URL revocation on raster entry deletion.
2. **UI Tests (`__tests__/HistoryPanel.test.tsx`)**:
   - Render `HistoryPanel` with mock entries.
   - Verify text action visibility on hover.
   - Verify clicking `hide`, `del`, and `edit` fire respective callbacks.
3. **Type & Lint Verification**:
   - `pnpm tsc` (strict TypeScript validation).
   - `pnpm lint` (ESLint checks).
