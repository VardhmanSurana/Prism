# Creative, Color & Film Emulation Studio

[![Prism Plugin](https://img.shields.io/badge/Prism-Plugin%20v1.0-blue)](https://github.com/VardhmanSurana/Prism)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Professional 3D LUT color grading, 35mm/120mm analog film grain synthesis, red halation glow, vintage instant Polaroid frames, and camera metadata watermark badges.

---

## ✨ Studio Capabilities

### 1. 🎬 3D LUT Color Grading (`lut`)
- **Cinematic Stock Presets**: Kodak Vision3 2383, Fujifilm Eterna 8543, Teal & Orange Blockbuster, Bleach Bypass, Vivid Dusk.
- **Custom LUT Importer**: Drag-and-drop industry-standard `.cube` 3D lookup tables (17x17x17, 33x33x33, 65x65x65).
- **Interpolation & Blend**: Trilinear tetrahedral interpolation with 0–100% opacity mixing.

### 2. 🎞️ Analog Film Grain & Halation (`texture`)
- **Photochemical Grain Synthesis**: Realistic 35mm fine grain, 120 medium format grain, and ISO 800/1600 low-light grit.
- **Red-Edge Halation Glow**: Highlight diffusion scattering that simulates photochemical emulsion glow on high-contrast edges.
- **Light Leak Overlays**: Vintage prism flares and analog shutter burn simulations.

### 3. 🖼️ Vintage Polaroid & Instant Frames (`frame`)
- **Frame Styles**: Instant 600 white border, Polaroid Classic, 35mm Film Sprocket Rebate, Minimal Passepartout, Exhibition Gallery Mat.
- **Camera Metadata Watermark Badges**: Automatic EXIF imprint (Leica red dot badge, Hasselblad typography, shutter/focal metadata).

---

## 📦 Installation

### Option 1: Via Prism Desktop UI
1. Open Prism and navigate to **Utilities** → **Plugins**.
2. Switch to the **Plugin Catalog** tab.
3. Locate **Creative, Color & Film Emulation Studio** and click **Install Plugin**.

### Option 2: Via Prism CLI
```bash
prism install https://github.com/VardhmanSurana/prism-plugin-creative-color-studio
```

### Option 3: Manual Git Clone
Clone directly into your Prism `plugins/` folder:
```bash
cd /path/to/prism/plugins
git clone https://github.com/VardhmanSurana/prism-plugin-creative-color-studio.git creative-color-studio
```

---

## ⚙️ Configuration & Sub-Features

Settings are stored in `config.json` and can be customized via the Prism UI:

```json
{
  "enabled": true,
  "settings": {
    "thumbnail_url": "/api/v1/plugins/creative-color-studio/assets/thumbnail.png",
    "features": {
      "lut": true,
      "texture": true,
      "frame": true
    }
  }
}
```

---

## 📂 Architecture & Directory Layout

```
creative-color-studio/
├── plugin.json         # Manifest & capabilities registry
├── config.json         # Runtime preferences & sub-feature toggles
├── package.json        # NPM package metadata
├── index.ts            # Component exports & entrypoint
├── LutPanel.tsx        # 3D LUT browser & .cube loader UI
├── lutEngine.ts        # 3D color cube interpolation engine
├── TexturePanel.tsx    # Film grain & halation simulation UI
├── FramesPanel.tsx     # Instant frame & border styling UI
├── vividDuskLuts.ts    # Embedded preset color curves
└── assets/             # LUT assets and frame overlays
```

---

## 📄 License

MIT © 2026 Vardhman Surana & Prism Creative Labs
