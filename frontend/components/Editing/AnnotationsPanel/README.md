# Annotations Panel Components - Agent Guide

This folder contains components that manage the editing mode's **Markup & Drawing sidebar**.

---

## 📂 File Directory

* **[index.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/index.ts)**:
  * Entry point exporting `AnnotationsPanel` and common types.
* **[types.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/types.ts)**:
  * Extracted TypeScript definitions (`Annotation`, `DrawToolId`).
* **[AnnotationsPanel.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/AnnotationsPanel.tsx)**:
  * Primary wrapper rendering header controls, layer opacity trackers, and embedding the sub-panels below.
* **[ToolsGrid.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/ToolsGrid.tsx)**:
  * Render grid for drawing tools: freehand, rect, circle, highlighter, text, textPath (doodle), and eraser.
* **[ColorPickerSection.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/ColorPickerSection.tsx)**:
  * Handles custom HEX selection, pre-configured color swatches, recently used colors, and pinned color states.
* **[TextPropertiesSection.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/TextPropertiesSection.tsx)**:
  * Settings for active text layer properties (Font Family, Size, Bold/Italic/Underline weight/styles, Alignments, Line-height, and Letter-spacing).
* **[DoodleSettingsSection.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/DoodleSettingsSection.tsx)**:
  * Manages settings for doodle brush texts (the text content rendered along drawn lines, size, font family, and guide toggles).
* **[LayersListSection.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/Editing/AnnotationsPanel/LayersListSection.tsx)**:
  * Lists drawn annotations, coordinates layer visibility toggling, layer ordering, and removal.

---

## 🔄 Interaction with main workspace

The subcomponents report all user interactions up to `AnnotationsPanelProps.onChange` (from `useAnnotationsState` hook) to synchronize markers, labels, and drawings dynamically on the main canvas workspace.
