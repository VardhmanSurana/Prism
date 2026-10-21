# Retouching, Metadata & Security Studio

[![Prism Plugin](https://img.shields.io/badge/Prism-Plugin%20v1.0-blue)](https://github.com/VardhmanSurana/Prism)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Professional frequency-separation skin smoothing, facial feature enhancement, Reinhard perceptual shot color matching, technical vector markup, offline EXIF reverse geocoding, and C2PA provenance credentials.

---

## ✨ Studio Capabilities

### 1. 👤 Portrait & Skin Retouching (`portrait`)
- **Frequency Separation**: High-pass texture retention with low-frequency Gaussian skin tone softening.
- **Facial Enhancement Tools**: Dental brightening & whitening, iris contrast boost, under-eye shadow reduction, lip saturation tuning.
- **Face Landmark Detection**: Automated bounding box and facial region tracking.

### 2. 🎨 Reinhard Shot Color Matcher (`colormatch`)
- **Statistical Color Transfer**: Computes perceptual $L\alpha\beta$ mean and standard deviation matrices between reference and source images.
- **Multi-Shot Consistency**: Balance color tones and ambient lighting across entire photo sessions with a single click.

### 3. 📐 Vector Markup & Technical Annotations (`annotations`)
- **Vector Drawing Suite**: Arrows, rectangles, ellipses, callout boxes, dimension lines, measurement scales, freehand pens.
- **Multi-Layer Stack**: Reorder, lock, hide, and group annotation layers non-destructively.

### 4. 🛡️ EXIF Geocoding & C2PA Provenance (`metadata-c2pa`)
- **Offline Reverse Geocoding**: Converts GPS coordinates to human-readable cities and landmarks using local spatial databases.
- **C2PA Content Credentials**: Inspect and attach cryptographic provenance metadata verifying authenticity and edit history.

---

## 📦 Installation

### Option 1: Via Prism Desktop UI
1. Open Prism and navigate to **Utilities** → **Plugins**.
2. Switch to the **Plugin Catalog** tab.
3. Locate **Retouching, Metadata & Security Studio** and click **Install Plugin**.

### Option 2: Via Prism CLI
```bash
prism install https://github.com/VardhmanSurana/prism-plugin-retouch-metadata-studio
```

### Option 3: Manual Git Clone
Clone directly into your Prism `plugins/` folder:
```bash
cd /path/to/prism/plugins
git clone https://github.com/VardhmanSurana/prism-plugin-retouch-metadata-studio.git retouch-metadata-studio
```

---

## ⚙️ Configuration & Sub-Features

Settings are stored in `config.json` and can be toggled in Prism:

```json
{
  "enabled": true,
  "settings": {
    "thumbnail_url": "/api/v1/plugins/retouch-metadata-studio/assets/thumbnail.png",
    "features": {
      "portrait": true,
      "colormatch": true,
      "annotations": true,
      "metadata-c2pa": true
    }
  }
}
```

---

## 📂 Architecture & Directory Layout

```
retouch-metadata-studio/
├── plugin.json                 # Manifest & capabilities registry
├── config.json                 # Runtime preferences & sub-feature toggles
├── package.json                # NPM package metadata
├── index.ts                    # Component exports & entrypoint
├── PortraitPanel.tsx           # Frequency separation & skin retouch UI
├── FaceBoundingBoxOverlay.tsx  # Facial landmark visualization
├── ColorMatchPanel.tsx         # Reinhard shot matching UI
├── colorMatchEngine.ts         # L*a*b statistical color transfer algorithm
├── AnnotationsPanel/           # Vector annotation toolbars & layer manager
├── AnnotationCanvas/           # Vector renderer & shape utilities
└── assets/                     # Icons and static resources
```

---

## 📄 License

MIT © 2026 Vardhman Surana & Prism Vision & Security Labs
