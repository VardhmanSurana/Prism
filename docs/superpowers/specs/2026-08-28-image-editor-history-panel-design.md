# Image Editor History Panel & Non-Destructive Edit Timeline Design Spec

## 1. Overview & Goals

This specification details the architecture, UI/UX design, state management, extensible plugin architecture, and animation model for the **History Panel** in Prism's Image Editor.

The History Panel provides users with a visual, chronological timeline of all adjustments, crops, annotations, AI operations, and third-party plugin edits performed during an image editing session. Users can selectively hide (bypass), delete, or edit individual history steps non-destructively through hover-activated text controls with zero icons, accompanied by GSAP motion animations.

The history system is **plugin-agnostic and fully auto-tracking**: third-party plugin authors do not need to write bespoke history management code. Core adjustments and custom plugin variables are automatically tracked, labeled, bypassed, and restored.

---

## 2. Key Requirements & UX Principles

1. **Dedicated Sidebar Tab**: Positioned inside the Image Editor's right tool sidebar (`activeTool === 'history'`) alongside Adjust, Layers, Presets, Annotations, etc.
2. **Connected Thread Timeline**: A vertical track connecting glowing circular nodes representing each edit state from baseline ("Original Image") to the latest active state.
3. **Hover-Only Text Actions (No Icons)**:
   - On row hover, action links (`hide`/`unhide`, `del`, `edit`) smoothly reveal without any icon clutter.
   - For parametric adjustments & custom variables: `hide` (or `unhide`), `del`, `edit`.
   - For raster/AI snapshots (e.g. Magic Eraser, AI Background): `revert`, `del`.
4. **Non-Destructive Selective Bypass**:
   - `hide`: Bypasses only that specific adjustment/variable in the live filter pipeline without discarding subsequent edits. The timeline entry is rendered in strikethrough with muted opacity.
   - `del`: Permanently removes that edit step from the history stack and re-evaluates active adjustments and custom variables.
   - `edit`: Automatically switches the sidebar tool tab to the corresponding tool or plugin (e.g., Adjust panel with Exposure focused, or a 3rd-party plugin panel) so the user can modify values.
5. **Extensible Plugin & Custom Variables System**:
   - Open-ended action identifiers (`string`).
   - Dynamic `customVariables: Record<string, any>` bag in editor state and history snapshots.
   - Auto-diffing observer in `useEditingHistory` that tracks both standard adjustments and arbitrary plugin custom variables with zero manual boilerplate required by plugin creators.
6. **GSAP Motion & Micro-Interactions**:
   - Powered by `gsap` and `@gsap/react` (`useGSAP`).
   - Smooth entrance cascades (`gsap.from`), active glowing node transitions, strikethrough wipe animations on hide, and height collapse on delete.
7. **Memory Safety**:
   - Immediate disposal of blob URLs (`URL.revokeObjectURL`) when deleting raster snapshot history entries.
   - Strict baseline protection: the root "Original Image" entry cannot be deleted or hidden.

---

## 3. Data Architecture & State Management

### 3.1 Extensible Data Structures (`history.ts`)

```typescript
import { Adjustments } from './filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

// Open-ended string (e.g. 'brightness', 'contrast', 'plugin:my-tool', 'customVar:threshold')
export type HistoryActionType = string;

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  description: string;
  value?: any;
  imageSrc: string;
  adjustments: Adjustments;
  customVariables?: Record<string, any>; // Arbitrary plugin variables bag
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straightenAngle: number;
  annotations?: Annotation[];
  hidden?: boolean;
  isSnapshot?: boolean;
  toolId?: string;                       // Target sidebar tool tab for 'edit'
  propertyKey?: string;                  // Key path (e.g. 'exposure', 'customVariables.bleed')
}
```

### 3.2 Non-Destructive Adjustment & Variable Recomputation (`historyUtils.ts`)

When an entry is toggled `hidden` or deleted, active adjustments and custom variables are recomputed:

```typescript
export function recomputeActiveEditorState(
  history: HistoryEntry[],
  baseAdjustments: Adjustments,
  baseCustomVariables: Record<string, any> = {}
): { adjustments: Adjustments; customVariables: Record<string, any> } {
  let adjustments = { ...baseAdjustments };
  let customVariables = { ...baseCustomVariables };

  for (const entry of history) {
    if (entry.hidden || entry.type === 'initial') continue;

    if (entry.propertyKey) {
      if (entry.propertyKey.startsWith('customVariables.')) {
        const varKey = entry.propertyKey.replace('customVariables.', '');
        customVariables[varKey] = entry.value;
      } else {
        (adjustments as any)[entry.propertyKey] = entry.value;
      }
    } else if (entry.adjustments) {
      adjustments = { ...adjustments, ...entry.adjustments };
    }

    if (entry.customVariables) {
      customVariables = { ...customVariables, ...entry.customVariables };
    }
  }

  return { adjustments, customVariables };
}
```

### 3.3 Hook Actions (`useEditingHistory.ts`)

The `useEditingHistory` hook manages the history stack, auto-diffing, and plugin variables:
- `history: HistoryEntry[]`
- `currentHistoryIndex: number`
- `customVariables: Record<string, any>`
- `setCustomVariable: (key: string, value: any, options?: { label?: string; toolId?: string }) => void`
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
- Utilizes `useGSAP` with scoped ref container for clean React 18 strict mode lifecycle.
- **Entry cascade**: `gsap.from('.history-item', { opacity: 0, y: 10, stagger: 0.04, ease: 'power2.out', duration: 0.25 })`.
- **Item deletion**: `gsap.to(itemRef, { height: 0, opacity: 0, duration: 0.2, ease: 'power2.inOut', onComplete: () => deleteEntry(id) })`.
- **Active Node Glow**: Subtle pulsating glow animation on the current history step.
- **Text Hover Ease**: Micro drift & fade on action text.

---

## 5. Tool Switching & Edit Interaction

Mapping and dynamic discovery for `toolId`:
- Built-in adjustments map to standard tools (`adjust`, `hsl`, `curves`, `texture`, `frame`, `transform`, `annotations`, `inpaint`, `layers`, `colormatch`, `liquify`, `raw`, `lasso`).
- Plugins register or pass their `toolId` with actions or custom variables; clicking `edit` invokes `setActiveTool(entry.toolId)` and focuses the relevant control.

---

## 6. Testing & Quality Assurance Plan

1. **Unit Tests (`__tests__/history.test.ts`)**:
   - Test adding standard and custom plugin history entries.
   - Test `customVariables` persistence and state folding.
   - Test `toggleHideHistoryEntry` toggles `hidden` flag and correctly recomputes active state.
   - Test `deleteHistoryEntry` deletes specific entries, updates `currentHistoryIndex`, and cleans up blob URLs.
2. **UI Tests (`__tests__/HistoryPanel.test.tsx`)**:
   - Render `HistoryPanel` with mock adjustment and plugin entries.
   - Verify text action visibility on hover (no icons).
   - Verify clicking `hide`, `del`, and `edit` fire respective callbacks.
3. **Type & Lint Verification**:
   - `pnpm tsc` (strict TypeScript validation).
   - `pnpm lint` (ESLint checks).
