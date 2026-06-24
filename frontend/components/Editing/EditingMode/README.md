# Editing Mode Workspace & Hooks - Agent Guide

This folder contains the core layout and custom state hooks driving the image editor.

---

## 📂 File Directory

* **[index.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/EditingMode/index.ts)**:
  * Entry point exporting `EditingMode`.
* **[EditingMode.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/EditingMode/EditingMode.tsx)**:
  * Workspace coordinator. Connects custom hooks, updates preview filters, binds crop events, processes backend inpainting requests, and renders the primary viewport.
* **[useAnnotationsState.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/EditingMode/useAnnotationsState.ts)**:
  * Manages markup layers and their text attributes, tracks current select item, handles doodle text, and implements an independent annotations undo/redo past/future history stack. Includes a debouncing mechanism to merge continuous strokes.
* **[useEditingHistory.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/EditingMode/useEditingHistory.ts)**:
  * Tracks exposure, crop URL, rotation angles, and general slider adjustments. Manages history checkpoints, including entries deletion/hiding, and recomposes preview images sequentially to build filter strings.
* **[useKeyBindings.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/EditingMode/useKeyBindings.ts)**:
  * Binds keyboard events:
    * `Ctrl+Z` / `Ctrl+Y`: Undoes/redoes drawings if annotations tool is active, else steps exposure adjustments history index.
    * `\` (Backslash): Activates hold-to-compare mode to preview original image.
    * `Ctrl` + `+`/`-`/`0`: Viewport zooms.
    * `Ctrl` + `Click & Drag` (Left/Right-click): Pans the viewport canvas.
    * `[` / `]`: Brush size step modifiers for inpaint tools.

---

## 🛠️ Verification Command

Ensure no compiler regressions after code changes:
```bash
cd frontend && bunx tsc --noEmit
```
