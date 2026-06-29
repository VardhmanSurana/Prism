# Video Editor UI Styling & Responsiveness Design Spec

This document details the design specifications for polishing the UI, styling, and responsiveness of the Prism Video Editor component.

## Goals
- Transform the video editor layout and individual panels to look premium and professional.
- Implement unified styling variables matching the rest of the application.
- Fix visual responsiveness across desktop window resizing.
- Standardize all custom inputs, sliders, and buttons across the video editor interface.

---

## 1. Visual Aesthetics & Themes
We will implement a hybrid professional design utilizing glassmorphism and glowing active states.

### Colors & Gradients
We will use modern, dark-mode gradients for track item clips:
- **Video Track Clips**: Gradient from `#2563eb` (Blue 600) to `#3b82f6` (Blue 500) with a `#60a5fa` hover state.
- **Audio Track Clips**: Gradient from `#059669` (Emerald 600) to `#10b981` (Emerald 500) with a `#34d399` hover state.
- **Text Track Clips**: Gradient from `#7c3aed` (Violet 600) to `#8b5cf6` (Violet 500) with a `#a78bfa` hover state.
- **Subtitle Track Clips**: Gradient from `#0891b2` (Cyan 600) to `#06b6d4` (Cyan 500) with a `#22d3ee` hover state.

### Panel Styling
All sidebars and nested control sections will utilize:
- Backdrop filters: `backdrop-blur-md`
- Background color: `rgba(22, 26, 32, 0.8)` (`--bg-secondary` with transparency)
- Borders: `1px solid rgba(255, 255, 255, 0.05)`

---

## 2. Interactive Components

### Playhead
- The vertical line will be a bright red `#ef4444` line with an outer glow: `shadow-[0_0_8px_rgba(239,68,68,0.5)]`.
- The handle at the top of the timeline will be styled as a clean diamond indicator with a hover scaling transition.

### Controls & Input Elements
- **Sliders**: Range sliders will use a custom webkit-slider-thumb representing a white circular handle with scaling on hover (`hover:scale-125`) and active grabbing cursors.
- **Buttons**: All buttons will use standard `transition-all duration-200` with subtle scale transforms on click (`active:scale-95`).
- **Cards (Transitions & Effects)**: Card selectors will scale up slightly on hover (`hover:scale-[1.02]`) and show a subtle halo shadow to indicate selectability.

---

## 3. Layout & Responsiveness
- **Main Viewport**: Ensure the preview canvas handles window resizing by scaling the absolute coordinates proportionally.
- **Timeline Height**: Maintain a minimum timeline height of `180px`, scaling up dynamically with track count while ensuring at least `40%` of the viewport remains dedicated to the video preview area.
- **Scrollbars**: Apply custom scrollbars (`.custom-scrollbar`) to timeline tracks and panels to avoid distracting default browser styling.

---

## 4. Verification Plan
- **Type Checking**: Verify compilation using `bunx tsc --noEmit`.
- **Unit Testing**: Run vitest unit tests in `frontend/`.
- **Manual Verification**: Run the desktop app and interact with panels, transport controls, and timeline resizing to verify smooth animations and correct alignment.
