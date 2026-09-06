# AI Vision Studio (Cutout & Magic Eraser)

[![Prism Plugin](https://img.shields.io/badge/Prism-Plugin%20v1.0-blue)](https://github.com/VardhmanSurana/Prism)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ONNX Runtime](https://img.shields.io/badge/Inference-ONNX%20Runtime-green)](https://onnxruntime.ai/)

> Comprehensive on-device neural vision suite for Prism: Subject Cutout & Matting, Magic Eraser Object Removal, Neural Super-Resolution, and Optical Depth Bokeh simulation.

---

## ✨ Studio Capabilities

### 1. ✂️ Subject Cutout & Neural Matting (`background`)
- **Neural Models**:
  - `U²-Net-p (Built-in Fast)`: Lightweight instant on-device matting (zero extra download required).
  - `ISNet (High Quality Universal)`: 1024px high-resolution neural matting with hair and edge detail preservation.
- **Precision Matte Controls**:
  - Gaussian Feathering (0–50px)
  - Edge Smoothing & Contour Shift (-30px to +30px)
  - Alpha Threshold Hardness & Contrast Boost
- **Backdrop Synthesis**: Transparent PNG export, solid color backdrops with studio palettes, Gaussian blur composite, or custom photo backdrops.

### 2. 🪄 Magic Eraser & Object Removal (`magic-eraser`)
- **Neural Models**:
  - `LaMa (Fast Object Removal)`: Fast Fourier transform inpainting to cleanly erase unwanted objects, wires, photobombers, and blemishes.
  - `Stable Diffusion (Neural Fill & Replace)`: Generative neural fill for creative object replacement and prompt-driven composition.
- **Interactive Canvas**: High-precision brush & smart mask drawing directly on high-resolution image views.
- **Keyboard Shortcuts**: `[` to decrease brush size, `]` to increase brush size, `Ctrl+Z` / `Cmd+Z` for undo.

### 3. 🔍 Neural Super-Resolution & Face Restore (`super-resolution`)
- **Neural Upscaling**: Real-ESRGAN 4x neural reconstruction preserving edge contrast and texture details.
- **Facial Feature Recovery**: CodeFormer blind face restoration for vintage and blurry portrait photos.

### 4. 📷 Optical Depth & Bokeh Simulation (`depth-bokeh`)
- **Depth Estimation**: Depth-Anything monocular metric depth map generation.
- **Realistic Lens Simulation**: Focal plane selection, aperture radius blur (f/1.2 to f/16), and catadioptric highlight bokeh rings.

---

## 📦 Installation

### Option 1: Via Prism Desktop UI
1. Open Prism and navigate to **Utilities** → **Plugins**.
2. Switch to the **Plugin Catalog** tab.
3. Locate **AI & Deep Learning Vision Studio** and click **Install Plugin**.

### Option 2: Via Prism CLI
```bash
prism install https://github.com/VardhmanSurana/prism-plugin-ai-vision-studio
```

### Option 3: Manual Git Clone
Clone directly into your Prism `plugins/` folder:
```bash
cd /path/to/prism/plugins
git clone https://github.com/VardhmanSurana/prism-plugin-ai-vision-studio.git ai-vision-studio
```

---

## ⚙️ Configuration & Granular Sub-Features

Settings are stored in `config.json` and can be toggled individually via the **Settings (gear)** icon in Prism:

```json
{
  "enabled": true,
  "settings": {
    "thumbnail_url": "/api/v1/plugins/ai-vision-studio/assets/thumbnail.png",
    "features": {
      "background": true,
      "inpaint": true,
      "super-resolution": true,
      "depth-bokeh": true
    }
  }
}
```

Disabling any feature (e.g. `"inpaint": false`) automatically hides its corresponding panel in the Image Editor sidebar while keeping other tools active.

---

## 📂 Architecture & Directory Layout

```
ai-vision-studio/
├── plugin.json         # Manifest & capabilities registry
├── config.json         # Runtime preferences & sub-feature toggles
├── package.json        # NPM package metadata
├── index.ts            # Component exports & entrypoint
├── BackgroundPanel.tsx # Cutout & backdrop synthesis UI
├── backgroundStage.ts  # Non-destructive export pipeline stage
├── InpaintPanel.tsx    # Smart brush & inpaint controls
├── InpaintCanvas.tsx   # Interactive WebGL/Canvas mask overlay
├── inpaintEngine.ts    # Client-side mask synthesis & telemetry
├── assets/             # Thumbnails and icons
└── models/             # Local ONNX weights (.onnx)
```

---

## 📄 License

MIT © 2026 Vardhman Surana & Prism AI Vision Team
