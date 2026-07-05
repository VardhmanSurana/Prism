# Design Spec: Timeline Centering, Import Button Removal & Speed Dial FAB

This document describes the design and specification for the changes to the Prism frontend regarding the gallery timeline positioning, the removal of the top-level import button, and the addition of a bottom-right Floating Action Button (FAB) Speed Dial for file/folder imports.

## Proposed Changes

### 1. Timeline Dial Centering

- **File**: `frontend/components/PhotoGrid/hooks/useTimeline.ts`
- **Behavior change**: Update scroll progress calculation. Instead of `(scrollTop + clientHeight / 2) / scrollHeight`, normalize it using `scrollTop / (scrollHeight - clientHeight)`.
- **Reason**: When the user is at the top of the gallery (`scrollTop = 0`), the scroll progress will be `0`. This aligns the active year "2025" (whose item progress is `0`) at `y = 0` (the exact vertical center/right middle of the dial scroll).

### 2. Remove Import Button from Top Header

- **Files**:
  - `frontend/components/layout/header/Header.tsx` (remove `<ImportButton />` rendering)
  - `frontend/components/PhotoGrid/PhotoGrid.tsx` (remove the `Import` dropdown top button)
  - `frontend/components/layout/header/ImportButton.tsx` (delete / clean up if unused)

### 3. Add Bottom-Right Speed Dial FAB

- **Files**:
  - `frontend/components/layout/floating-actions/FloatingActions.tsx` (implement the FAB and Speed Dial menu)
  - `frontend/components/layout/types/floating-actions.ts` (extend props type signature)
  - `frontend/App.tsx` (wire up the callbacks to `FloatingActions`)
- **Visual & UI Design**:
  - Render a circular floating action button (FAB) at the bottom-right of the screen.
  - The FAB displays a `Plus` symbol. When clicked, it rotates 45 degrees into an "x" (close symbol).
  - Above the FAB, a staggered vertical menu slides up displaying:
    - **Import Files** (displays image/file icon + label "Import Files")
    - **Import Folder** (displays folder icon + label "Import Folder")
  - Add an invisible backdrop covering the screen while the menu is open, so clicking outside the menu collapses it.
  - Use `framer-motion` for staggered slide-up and fade animations.
