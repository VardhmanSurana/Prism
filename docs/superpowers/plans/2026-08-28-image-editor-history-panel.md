# Image Editor History Panel & Non-Destructive Edit Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plugin-extensible History Panel in Prism's Image Editor featuring a vertical connected thread timeline, non-destructive selective bypass (`hide`), `delete`, and `edit` text actions (no icons, hover-only), custom variable tracking, and GSAP motion animations.

**Architecture:** Extend `history.ts` with open-ended action types, custom variable bags (`customVariables: Record<string, any>`), and non-destructive state folding utilities (`historyUtils.ts`). Update `useEditingHistory.ts` to automatically detect setting/variable changes and manage selective bypass. Construct `HistoryPanel.tsx` using GSAP motion (`useGSAP`) with pure text hover actions and integrate it into `Sidebar.tsx` and `EditingMode.tsx`.

**Tech Stack:** React 18, TypeScript 5.8, Tailwind CSS, GSAP (`gsap`, `@gsap/react`), Vitest, Testing Library.

---

### Task 1: Extensible History Types & State Folding Engine

**Files:**
- Create: `frontend/components/Editor/ImageEditor/historyUtils.ts`
- Modify: `frontend/components/Editor/ImageEditor/history.ts`
- Modify: `frontend/components/Editor/ImageEditor/__tests__/history.test.ts`

- [ ] **Step 1: Write the failing tests for history types and folding utilities**

```typescript
// frontend/components/Editor/ImageEditor/__tests__/history.test.ts
import { describe, it, expect } from 'vitest';
import { createHistoryEntry, appendBoundedHistory } from '../history';
import { recomputeActiveEditorState } from '../historyUtils';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

describe('history and state folding', () => {
  it('creates an extensible history entry with customVariables and toolId', () => {
    const entry = createHistoryEntry(
      'exposure',
      'Exposure +0.50',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      0.5,
      [],
      { toolId: 'adjust', propertyKey: 'exposure' }
    );

    expect(entry.type).toBe('exposure');
    expect(entry.toolId).toBe('adjust');
    expect(entry.propertyKey).toBe('exposure');
    expect(entry.hidden).toBe(false);
  });

  it('recomputes active adjustments selectively bypassing hidden entries', () => {
    const entry1 = createHistoryEntry(
      'exposure',
      'Exposure +0.50',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      0.5,
      [],
      { propertyKey: 'exposure' }
    );
    const entry2 = createHistoryEntry(
      'contrast',
      'Contrast +20',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      20,
      [],
      { propertyKey: 'contrast' }
    );

    // Both active
    let state = recomputeActiveEditorState([entry1, entry2], DEFAULT_ADJUSTMENTS);
    expect(state.adjustments.exposure).toBe(0.5);
    expect(state.adjustments.contrast).toBe(20);

    // Hide exposure
    entry1.hidden = true;
    state = recomputeActiveEditorState([entry1, entry2], DEFAULT_ADJUSTMENTS);
    expect(state.adjustments.exposure).toBe(DEFAULT_ADJUSTMENTS.exposure);
    expect(state.adjustments.contrast).toBe(20);
  });

  it('folds customVariables for third-party plugins', () => {
    const pluginEntry = createHistoryEntry(
      'plugin:lut-grade',
      'Kodak 2383 LUT',
      'test.jpg',
      DEFAULT_ADJUSTMENTS,
      0,
      false,
      false,
      0,
      'kodak-2383',
      [],
      {
        toolId: 'lut',
        propertyKey: 'customVariables.lutProfile',
        customVariables: { lutProfile: 'kodak-2383', intensity: 0.8 },
      }
    );

    const state = recomputeActiveEditorState([pluginEntry], DEFAULT_ADJUSTMENTS);
    expect(state.customVariables.lutProfile).toBe('kodak-2383');
    expect(state.customVariables.intensity).toBe(0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run components/Editor/ImageEditor/__tests__/history.test.ts`
Expected: FAIL with missing module `historyUtils` or missing properties.

- [ ] **Step 3: Implement `history.ts` and `historyUtils.ts`**

```typescript
// frontend/components/Editor/ImageEditor/history.ts
import { Adjustments } from './filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

export type HistoryActionType = string;

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  description: string;
  value?: any;
  imageSrc: string;
  adjustments: Adjustments;
  customVariables?: Record<string, any>;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straightenAngle: number;
  annotations?: Annotation[];
  hidden?: boolean;
  isSnapshot?: boolean;
  toolId?: string;
  propertyKey?: string;
}

export const MAX_IMAGE_HISTORY_ENTRIES = 30;

export function appendBoundedHistory(
  history: HistoryEntry[],
  currentHistoryIndex: number,
  entry: HistoryEntry,
  maxEntries = MAX_IMAGE_HISTORY_ENTRIES
): { history: HistoryEntry[]; currentHistoryIndex: number; evicted: HistoryEntry[] } {
  const retained = history.slice(0, currentHistoryIndex + 1);
  const discardedRedo = history.slice(currentHistoryIndex + 1);
  const next = [...retained, entry];
  const overflow = Math.max(0, next.length - maxEntries);
  return {
    history: next.slice(overflow),
    currentHistoryIndex: next.length - 1 - overflow,
    evicted: [...discardedRedo, ...next.slice(0, overflow)],
  };
}

export function createHistoryEntry(
  type: HistoryActionType,
  description: string,
  imageSrc: string,
  adjustments: Adjustments,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  straightenAngle: number,
  value?: any,
  annotations?: Annotation[],
  options?: {
    customVariables?: Record<string, any>;
    hidden?: boolean;
    isSnapshot?: boolean;
    toolId?: string;
    propertyKey?: string;
  }
): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    value,
    imageSrc,
    adjustments: { ...adjustments },
    customVariables: options?.customVariables ? { ...options.customVariables } : {},
    rotation,
    flipH,
    flipV,
    straightenAngle,
    annotations: annotations ? [...annotations] : [],
    hidden: options?.hidden ?? false,
    isSnapshot: options?.isSnapshot ?? false,
    toolId: options?.toolId,
    propertyKey: options?.propertyKey,
  };
}
```

```typescript
// frontend/components/Editor/ImageEditor/historyUtils.ts
import { Adjustments } from './filterEngine';
import { HistoryEntry } from './history';

export function recomputeActiveEditorState(
  history: HistoryEntry[],
  baseAdjustments: Adjustments,
  baseCustomVariables: Record<string, any> = {}
): { adjustments: Adjustments; customVariables: Record<string, any> } {
  let adjustments: Adjustments = { ...baseAdjustments };
  let customVariables: Record<string, any> = { ...baseCustomVariables };

  for (const entry of history) {
    if (entry.hidden || entry.type === 'initial') continue;

    if (entry.propertyKey) {
      if (entry.propertyKey.startsWith('customVariables.')) {
        const varKey = entry.propertyKey.replace('customVariables.', '');
        customVariables[varKey] = entry.value;
      } else if (entry.propertyKey in adjustments) {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run components/Editor/ImageEditor/__tests__/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/components/Editor/ImageEditor/history.ts frontend/components/Editor/ImageEditor/historyUtils.ts frontend/components/Editor/ImageEditor/__tests__/history.test.ts
git commit -m "feat(editor): add extensible history types and state folding utilities"
```

---

### Task 2: Update `useEditingHistory.ts` Hook with Non-Destructive Actions & Auto-Tracking

**Files:**
- Modify: `frontend/components/Editor/ImageEditor/EditingMode/useEditingHistory.ts`
- Modify: `frontend/components/Editor/ImageEditor/__tests__/history.test.ts`

- [ ] **Step 1: Write tests for hook actions (hide, delete, jump, customVariables)**

```typescript
// Add to frontend/components/Editor/ImageEditor/__tests__/history.test.ts
it('handles entry deletion and preserves stack integrity', () => {
  const entry1 = createHistoryEntry('exposure', 'Exposure +0.50', 'test.jpg', DEFAULT_ADJUSTMENTS, 0, false, false, 0, 0.5);
  const entry2 = createHistoryEntry('contrast', 'Contrast +20', 'test.jpg', DEFAULT_ADJUSTMENTS, 0, false, false, 0, 20);
  const list = [entry1, entry2];
  const filtered = list.filter(e => e.id !== entry1.id);
  expect(filtered.length).toBe(1);
  expect(filtered[0].id).toBe(entry2.id);
});
```

- [ ] **Step 2: Update `useEditingHistory.ts`**

Add `customVariables`, `setCustomVariable`, `toggleHideHistoryEntry`, `deleteHistoryEntry`, and `jumpToHistoryEntry`:

```typescript
// Add methods to useEditingHistory return object:
const [customVariables, setCustomVariables] = useState<Record<string, any>>({});

const toggleHideHistoryEntry = useCallback((id: string) => {
  setHistory(prev => {
    const updated = prev.map(entry => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry));
    const recomputed = recomputeActiveEditorState(updated, DEFAULT_ADJUSTMENTS);
    setAdjustments(recomputed.adjustments);
    setCustomVariables(recomputed.customVariables);
    return updated;
  });
}, []);

const deleteHistoryEntry = useCallback((id: string) => {
  setHistory(prev => {
    const target = prev.find(e => e.id === id);
    if (target?.type === 'initial') return prev; // Protect root
    if (target?.imageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(target.imageSrc);
    }
    const updated = prev.filter(e => e.id !== id);
    const recomputed = recomputeActiveEditorState(updated, DEFAULT_ADJUSTMENTS);
    setAdjustments(recomputed.adjustments);
    setCustomVariables(recomputed.customVariables);
    return updated;
  });
  setCurrentHistoryIndex(prev => Math.max(0, prev - 1));
}, []);

const jumpToHistoryEntry = useCallback((index: number) => {
  const target = history[index];
  if (target) {
    applyEntry(target, index);
  }
}, [history, applyEntry]);

const setCustomVariable = useCallback((key: string, value: any, options?: { label?: string; toolId?: string }) => {
  setCustomVariables(prev => {
    const next = { ...prev, [key]: value };
    addHistoryEntry(
      `customVar:${key}`,
      options?.label || `Set ${key}: ${value}`,
      value,
      undefined,
      undefined,
      { toolId: options?.toolId, propertyKey: `customVariables.${key}`, customVariables: next }
    );
    return next;
  });
}, [addHistoryEntry]);
```

- [ ] **Step 3: Run unit tests**

Run: `cd frontend && pnpm vitest run components/Editor/ImageEditor/__tests__/history.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/components/Editor/ImageEditor/EditingMode/useEditingHistory.ts frontend/components/Editor/ImageEditor/__tests__/history.test.ts
git commit -m "feat(editor): add selective hide, delete, jump, and customVariables to useEditingHistory"
```

---

### Task 3: Build `HistoryPanel.tsx` with GSAP Motion and Pure Text Hover Actions

**Files:**
- Create: `frontend/components/Editor/ImageEditor/HistoryPanel.tsx`
- Create: `frontend/components/Editor/ImageEditor/__tests__/HistoryPanel.test.tsx`

- [ ] **Step 1: Write failing UI test for `HistoryPanel.tsx`**

```typescript
// frontend/components/Editor/ImageEditor/__tests__/HistoryPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoryPanel } from '../HistoryPanel';
import { HistoryEntry } from '../history';
import { DEFAULT_ADJUSTMENTS } from '../filterEngine';

const mockEntries: HistoryEntry[] = [
  {
    id: 'entry-1',
    type: 'initial',
    description: 'Original image',
    imageSrc: 'test.jpg',
    adjustments: DEFAULT_ADJUSTMENTS,
    rotation: 0,
    flipH: false,
    flipV: false,
    straightenAngle: 0,
    hidden: false,
  },
  {
    id: 'entry-2',
    type: 'exposure',
    description: 'Exposure +0.50',
    value: 0.5,
    imageSrc: 'test.jpg',
    adjustments: { ...DEFAULT_ADJUSTMENTS, exposure: 0.5 },
    rotation: 0,
    flipH: false,
    flipV: false,
    straightenAngle: 0,
    hidden: false,
    toolId: 'adjust',
  },
];

describe('HistoryPanel Component', () => {
  it('renders timeline entries and fires callbacks', () => {
    const onToggleHide = vi.fn();
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const onJump = vi.fn();

    render(
      <HistoryPanel
        history={mockEntries}
        currentHistoryIndex={1}
        onToggleHide={onToggleHide}
        onDelete={onDelete}
        onEdit={onEdit}
        onJump={onJump}
      />
    );

    expect(screen.getByText('Exposure +0.50')).toBeInTheDocument();
    expect(screen.getByText('Original image')).toBeInTheDocument();

    const hideBtn = screen.getByText('hide');
    fireEvent.click(hideBtn);
    expect(onToggleHide).toHaveBeenCalledWith('entry-2');

    const editBtn = screen.getByText('edit');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockEntries[1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run components/Editor/ImageEditor/__tests__/HistoryPanel.test.tsx`
Expected: FAIL with "HistoryPanel not found".

- [ ] **Step 3: Implement `HistoryPanel.tsx` with GSAP motion and text hover actions**

```tsx
// frontend/components/Editor/ImageEditor/HistoryPanel.tsx
import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { HistoryEntry } from './history';

interface HistoryPanelProps {
  history: HistoryEntry[];
  currentHistoryIndex: number;
  onToggleHide: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (entry: HistoryEntry) => void;
  onJump: (index: number) => void;
  onResetAll?: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentHistoryIndex,
  onToggleHide,
  onDelete,
  onEdit,
  onJump,
  onResetAll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.timeline-item', {
        opacity: 0,
        y: 8,
        stagger: 0.03,
        duration: 0.25,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [history.length] }
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--bg-secondary)] select-none text-white/90 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Timeline of Edits</h3>
          <p className="text-[10px] text-white/40">{history.length} {history.length === 1 ? 'Step' : 'Steps'}</p>
        </div>
        {onResetAll && history.length > 1 && (
          <button
            onClick={onResetAll}
            className="text-[10px] text-red-400/80 hover:text-red-300 transition-colors uppercase font-medium tracking-wider"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 relative">
        {/* Continuous Track Line */}
        <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-white/10" />

        {history.map((entry, index) => {
          const isActive = index === currentHistoryIndex;
          const isInitial = entry.type === 'initial';
          const isHidden = !!entry.hidden;

          return (
            <div
              key={entry.id}
              className={`timeline-item group relative flex items-center gap-3 p-2 rounded-lg transition-all duration-150 cursor-pointer ${
                isActive ? 'bg-indigo-950/40 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'
              }`}
              onClick={() => onJump(index)}
            >
              {/* Timeline Node Dot */}
              <div
                className={`relative z-10 w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200 ${
                  isActive
                    ? 'bg-indigo-500 ring-4 ring-indigo-500/20 scale-110'
                    : isHidden
                    ? 'border-2 border-white/30 bg-transparent'
                    : 'bg-white/40'
                }`}
              />

              {/* Item Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-medium truncate ${
                      isHidden ? 'line-through text-white/40' : isActive ? 'text-indigo-200 font-semibold' : 'text-white/80'
                    }`}
                  >
                    {entry.description}
                  </span>

                  {/* Pure Text Hover Actions (No icons) */}
                  {!isInitial && (
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-semibold flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onToggleHide(entry.id)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {isHidden ? 'unhide' : 'hide'}
                      </button>
                      <button
                        onClick={() => onDelete(entry.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        del
                      </button>
                      {entry.toolId && (
                        <button
                          onClick={() => onEdit(entry)}
                          className="text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run UI test to verify it passes**

Run: `cd frontend && pnpm vitest run components/Editor/ImageEditor/__tests__/HistoryPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/components/Editor/ImageEditor/HistoryPanel.tsx frontend/components/Editor/ImageEditor/__tests__/HistoryPanel.test.tsx
git commit -m "feat(editor): create HistoryPanel component with GSAP animations and pure text hover actions"
```

---

### Task 4: Integrate History Panel into `Sidebar.tsx` and `EditingMode.tsx`

**Files:**
- Modify: `frontend/components/Editor/ImageEditor/Sidebar.tsx`
- Modify: `frontend/components/Editor/ImageEditor/EditingMode/EditingMode.tsx`

- [ ] **Step 1: Add `'history'` Tool to `Sidebar.tsx`**

```typescript
// frontend/components/Editor/ImageEditor/Sidebar.tsx
export type ToolId =
  | 'history'
  | 'transform'
  | 'adjust'
  | 'detail'
  | ...

// Add 'history' tab to DEFAULT_TABS_ORDER and TOOL_ICONS (using History from lucide-react in Sidebar tab list)
```

- [ ] **Step 2: Mount `HistoryPanel` in `EditingMode.tsx`**

```tsx
// Inside EditingMode.tsx tool rendering block:
{activeTool === 'history' && (
  <HistoryPanel
    history={historyState.history}
    currentHistoryIndex={historyState.currentHistoryIndex}
    onToggleHide={historyState.toggleHideHistoryEntry}
    onDelete={historyState.deleteHistoryEntry}
    onEdit={(entry) => {
      if (entry.toolId) {
        setActiveTool(entry.toolId as ToolId);
      }
    }}
    onJump={historyState.jumpToHistoryEntry}
  />
)}
```

- [ ] **Step 3: Run full tests to verify integration**

Run: `cd frontend && pnpm vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/components/Editor/ImageEditor/Sidebar.tsx frontend/components/Editor/ImageEditor/EditingMode/EditingMode.tsx
git commit -m "feat(editor): wire HistoryPanel into Sidebar and EditingMode"
```

---

### Task 5: Final Validation & Quality Verification

**Files:**
- Verify across all edited files

- [ ] **Step 1: Run TypeScript Type Check**

Run: `cd frontend && pnpm tsc`
Expected: 0 errors.

- [ ] **Step 2: Run ESLint**

Run: `cd frontend && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Run Full Test Suite**

Run: `cd frontend && pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Final commit and summary**

```bash
git commit -m "chore(editor): complete history panel and timeline integration"
```

