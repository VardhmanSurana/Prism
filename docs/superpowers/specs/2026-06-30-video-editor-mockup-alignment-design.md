# Video Editor Mockup Alignment Design Spec

This spec outlines the changes required to align the Prism Video Editor UI layout, components, and interactive feedback with the reference mockups (images 2 and 3).

## Goals
- Relocate the playback Transport Controls to float directly inside the video preview area.
- Add a new Timeline Header bar containing clip edit tools (Split, Delete), playback time display, and zoom slider controls.
- Implement an interactive orange bounding box with corner handles on the canvas for the selected text clip.
- Modify the Left Sidebar to include all mockup tabs (Plus, Uploads, Canvas, Text, Videos, Audios, Photos, Records, Subtitles) with corresponding styles.
- Add select/grab tools, undo/redo icons, profiles, and decorative window elements to the Top Bar.

---

## 1. Top Bar & Sidebar Adjustments

### Top Bar
- **macOS Dots**: Render decorative Red, Yellow, and Green window control dots on the top left.
- **Tools**: Add select cursor and hand tool toggles in the center, alongside Undo and Redo arrows.
- **Avatars**: Render two user profile avatars on the right, next to the **Export** button.

### Sidebar
- **Tab Layout**:
  - `+` (Plus button at the very top, styled as a light circular button).
  - Uploads
  - Canvas (new placeholder)
  - Text
  - Videos (new placeholder)
  - Audios
  - Photos (new placeholder)
  - Records (new placeholder)
  - Subtitles
- Placeholder tabs will display a simple empty state or descriptive text.

---

## 2. Floating Transport Controls & Canvas Selection Box

### Floating Transport Controls
- The `TransportControls` component will be positioned absolutely at the bottom center of the video preview player frame.
- Controls will feature: skip-back, play/pause, skip-forward, and fullscreen (removed time displays from this control bar).

### Canvas Text Selection Box
- The `renderTextOverlays` function in `TextOverlayRenderer.ts` will receive the `selectedClipId`.
- If the text clip being rendered is selected:
  - Measure text dimensions: `const metrics = ctx.measureText(text)`.
  - Draw a solid orange `#f97316` rectangle outline around the text block with custom padding.
  - Draw white circle handles (`#ffffff` fill, orange border) at the four corners of the box.

---

## 3. Timeline Header & Tools

- A new `TimelineHeader` component will be added at the top of the timeline section.
- **Left Tools**:
  - Scissors (Split): Split selected clip at `currentTime`.
  - Trash (Delete): Delete selected clip.
  - Copy/Paste/Undo/Redo: Styled placeholder buttons.
- **Center Display**: Playback time display `00:00.00 / 00:00.00` centered in the header.
- **Right Zoom**: Horizontal zoom slider matching the mockup zoom controls.

---

## 4. Verification Plan
- **TypeScript compilation**: Check utilizing `bunx tsc --noEmit` in the frontend directory.
- **Unit Tests**: Ensure all vitest tests continue to pass (`bun run test`).
- **Manual Verification**: Run the Tauri dev app and verify the visual layout matches the mockup details.
