# Speed Dial FAB and Timeline Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the gallery timeline dial year centering, remove all top import buttons, and add a click-based Speed Dial FAB in the bottom-right.

**Architecture:** We will normalize the timeline scroll progress calculation so that 2025 aligns exactly with `y = 0` (centered) when at the top. We will remove the legacy top-level import buttons. We will expand the FloatingActions component to host a stateful click-triggered speed dial button with framer-motion micro-animations.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Lucide icons, Framer Motion, Vitest.

## Global Constraints

- Follow established TailwindCSS styling patterns.
- Ensure all types match exactly across imports and hook boundaries.
- No placeholders or incomplete code.

---

### Task 1: Normalize Scroll Progress & Center Timeline Dial

**Files:**
- Modify: `frontend/components/PhotoGrid/hooks/useTimeline.ts`
- Modify: `frontend/components/ui/TimelineDial.tsx`
- Test: Run `bun run test layout.test.tsx` (ensure it continues to pass)

**Interfaces:**
- Consumes: Scroll events from the parent scroll ref.
- Produces: Normalized `scrollState.progress` ranging from `0` to `1`.

- [ ] **Step 1: Update useTimeline hook**

Modify `/home/chotaxdon/Work/Projects/Prism/frontend/components/PhotoGrid/hooks/useTimeline.ts` to compute progress as a ratio of `scrollTop / maxScroll` instead of `centerPixel / scrollHeight`:

```typescript
// in handleScroll inside useTimeline:
    const handleScroll = () => {
      const scrollTop = parent.scrollTop;
      const scrollHeight = parent.scrollHeight;
      const clientHeight = parent.clientHeight;

      if (scrollHeight === 0) return;

      const maxScroll = scrollHeight - clientHeight;
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      setScrollState({ progress, height: scrollHeight });
    };
```

- [ ] **Step 2: Commit the change**

```bash
git add frontend/components/PhotoGrid/hooks/useTimeline.ts
git commit -m "feat: normalize scroll progress calculation for timeline centering"
```

---

### Task 2: Remove Top Import Buttons

**Files:**
- Modify: `frontend/components/layout/header/Header.tsx`
- Modify: `frontend/components/layout/types/header.ts`
- Modify: `frontend/components/PhotoGrid/PhotoGrid.tsx`
- Modify: `frontend/components/MainContent.tsx`
- Modify: `frontend/App.tsx`
- Delete: `frontend/components/layout/header/ImportButton.tsx`

- [ ] **Step 1: Update Header component and types**

Remove `onUpload` and `onImportProgress` from `HeaderProps` in `/home/chotaxdon/Work/Projects/Prism/frontend/components/layout/types/header.ts`:

```typescript
export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}
```

Modify `/home/chotaxdon/Work/Projects/Prism/frontend/components/layout/header/Header.tsx` to remove the import button rendering and references:

```typescript
import { NotificationsButton } from './NotificationsButton';
import { UserProfile } from './UserProfile';
import type { HeaderProps } from '../types/header';
import { GlassMaterial } from '@/components/GlassMaterial';

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  sortMode,
  onSortChange,
}) => {
  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-10 shrink-0 z-40 sticky top-0">
      <GlassMaterial intensity="regular" borderRadius="0" className="absolute inset-0 border-b border-white/[0.03] shadow-lg" />

      <div className="relative z-10 w-full flex items-center justify-between">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />

        <div className="flex items-center gap-6 ml-6">
          <NotificationsButton />
          <UserProfile />
        </div>
      </div>
    </header>
  );
};
```

- [ ] **Step 2: Update PhotoGrid component and usages**

Modify `/home/chotaxdon/Work/Projects/Prism/frontend/components/PhotoGrid/PhotoGrid.tsx` to remove the top `Import` button dropdown. Remove `onUpload` and `onImportProgress` from props since they are no longer used by PhotoGrid. Remove the `useImport` hook invocation.

Clean up references in `/home/chotaxdon/Work/Projects/Prism/frontend/components/MainContent.tsx` (remove `onUpload` and `onImportProgress` propagation to `<PhotoGrid />`).
Clean up the `<Header />` instantiation in `/home/chotaxdon/Work/Projects/Prism/frontend/App.tsx` to not pass `onUpload` and `onImportProgress` to the Header.

- [ ] **Step 3: Delete unused legacy ImportButton file**

Delete `/home/chotaxdon/Work/Projects/Prism/frontend/components/layout/header/ImportButton.tsx`.

- [ ] **Step 4: Commit changes**

```bash
git rm frontend/components/layout/header/ImportButton.tsx
git add frontend/components/layout/header/Header.tsx frontend/components/layout/types/header.ts frontend/components/PhotoGrid/PhotoGrid.tsx frontend/components/MainContent.tsx frontend/App.tsx
git commit -m "feat: remove top import buttons from header and photo grid"
```

---

### Task 3: Implement bottom-right Speed Dial FAB

**Files:**
- Modify: `frontend/components/layout/types/floating-actions.ts`
- Modify: `frontend/components/layout/floating-actions/FloatingActions.tsx`
- Modify: `frontend/App.tsx`
- Test: Add a unit test to `frontend/components/layout/__tests__/layout.test.tsx` verifying FAB rendering and speed dial opening.

**Interfaces:**
- Consumes: `onUpload` and `onImportProgress` in `FloatingActionsProps`.
- Produces: A Speed Dial menu with click trigger and interactive file/folder import handlers.

- [ ] **Step 1: Update FloatingActionsProps types**

Modify `/home/chotaxdon/Work/Projects/Prism/frontend/components/layout/types/floating-actions.ts`:

```typescript
import { Photo } from '../../../types';

export interface ImportStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

export interface FloatingActionsProps {
  importStatus: ImportStatus;
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: ImportStatus) => void;
}
```

- [ ] **Step 2: Update FloatingActions component to render FAB Speed Dial**

Modify `/home/chotaxdon/Work/Projects/Prism/frontend/components/layout/floating-actions/FloatingActions.tsx` to add click-triggered speed dial overlay using framer-motion.

- [ ] **Step 3: Update App.tsx props binding**

Modify the `<FloatingActions />` invocation in `/home/chotaxdon/Work/Projects/Prism/frontend/App.tsx` (lines 215-217):

```typescript
        <FloatingActions
          importStatus={importStatus}
          onUpload={handleUpload}
          onImportProgress={setImportStatus}
        />
```

- [ ] **Step 4: Update Unit Tests**

Modify `frontend/components/layout/__tests__/layout.test.tsx` to pass the required props to `FloatingActions` and test the FAB toggle behavior.

- [ ] **Step 5: Run tests and commit**

Run: `bun run test layout.test.tsx`
Expected: All tests pass.

```bash
git add frontend/components/layout/types/floating-actions.ts frontend/components/layout/floating-actions/FloatingActions.tsx frontend/App.tsx frontend/components/layout/__tests__/layout.test.tsx
git commit -m "feat: add bottom-right click-triggered Speed Dial FAB for importing"
```
