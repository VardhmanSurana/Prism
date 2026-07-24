# Prism Image Editor

Comprehensive documentation for the Prism image editor, covering all 19 editing tools, the export pipeline, and technical implementation details.

---

## Table of Contents

- [Overview](#overview)
- [Editor Layout](#editor-layout)
- [Tool Reference](#tool-reference)
  - [AI Tools (Inpaint)](#ai-tools-inpaint)
  - [Clone & Heal](#clone--heal)
  - [Lasso Studio](#lasso-studio)
  - [Layer Stack](#layer-stack)
  - [Camera RAW](#camera-raw)
  - [Liquify & Reshape](#liquify--reshape)
  - [Shot Matcher](#shot-matcher)
  - [Presets](#presets)
  - [Light (Adjust)](#light-adjust)
  - [Color (HSL)](#color-hsl)
  - [Detail](#detail)
  - [Portrait](#portrait)
  - [Regions (Selective)](#regions-selective)
  - [Grain & Leak](#grain--leak)
  - [LUT Grade](#lut-grade)
  - [Frames & Atmosphere](#frames--atmosphere)
  - [Palette](#palette)
  - [Markup & Vector (Annotations)](#markup--vector-annotations)
  - [Crop (Transform)](#crop-transform)
- [Export Pipeline](#export-pipeline)
- [Technical Architecture](#technical-architecture)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Overview

The Prism image editor is a full-featured non-destructive photo editing workspace built into the desktop application. It provides 19 specialized tools organized in a vertical sidebar, with each tool offering a dedicated panel for fine-grained control.

### Key Features

- **Non-destructive editing**: Adjustments are stored as JSON (in `adjustments_json` column) and applied during export
- **19 editing tools**: From basic crop/rotate to AI-powered inpainting
- **Layer-based compositing**: Non-destructive layer stack with 27 blend modes
- **Multiple export formats**: PNG, JPEG, WebP, TIFF
- **History tracking**: Undo/redo through editing history stack
- **GPU acceleration**: Canvas-based rendering with WebGL support

### File Locations

| Component | Path |
|-----------|------|
| Main editor components | `frontend/components/Editor/ImageEditor/` |
| Export pipeline | `frontend/components/Editor/ImageEditor/exportPipeline/` |
| Filter engine | `frontend/components/Editor/ImageEditor/filterEngine.ts` |
| History system | `frontend/components/Editor/ImageEditor/history.ts` |
| Annotations | `frontend/components/Editor/ImageEditor/AnnotationCanvas/` |
| Annotations panel | `frontend/components/Editor/ImageEditor/AnnotationsPanel/` |
| Editing mode | `frontend/components/Editor/ImageEditor/EditingMode/` |

---

## Editor Layout

```
┌─────────────────────────────────────────────────────────┐
│  Top Bar (filename, zoom controls, export button)       │
├────┬────────────────────────────────────────────────────┤
│    │                                                    │
│ S  │  Canvas Area                                       │
│ i  │  (zoomable, pannable, gesture-aware)               │
│ d  │                                                    │
│ e  │                                                    │
│ b  │                                                    │
│ a  │                                                    │
│ r  │                                                    │
│    │                                                    │
│ 19 │                                                    │
│ t  │                                                    │
│ o  │                                                    │
│ o  │                                                    │
│ l  │                                                    │
│ s  │                                                    │
├────┴────────────────────────────────────────────────────┤
│  Status Bar (zoom level, dimensions, unsaved indicator)  │
└─────────────────────────────────────────────────────────┘
```

### Sidebar Tools (left to right)

The sidebar contains 19 tool icons. Selecting a tool opens its configuration panel to the right of the sidebar.

---

## Tool Reference

### AI Tools (Inpaint)

**File**: `InpaintPanel.tsx`, `InpaintCanvas.tsx`

AI-powered object removal using Stable Diffusion 1.5 inpainting.

#### How It Works

1. Draw a mask over the object to remove using a brush
2. The mask + original image is sent to the backend
3. Stable Diffusion 1.5 inpaints the masked region
4. The result is returned and displayed

#### Controls

- **Brush size**: Adjustable brush for mask painting
- **Inpaint button**: Triggers the AI inpainting process
- **Result**: Preview the inpainted result

#### Backend API

- **Endpoint**: Inpaint API router in `backend/app/api/photos/inpaint.py`
- **Service**: `backend/app/services/inference/sd_inpaint.py`
- **Feature flag**: `ENABLE_AI_INPAINTING`

---

### Clone & Heal

**File**: `HealingPanel.tsx`, `HealingCanvas.tsx`

Clone Stamp and Healing Brush tools for manual retouching.

#### Clone Stamp

- **Alt+Click**: Set source point
- **Paint**: Clone pixels from source to target area
- **Brush size**: Adjustable via `[` / `]` keys

#### Healing Brush

- Automatically blends cloned pixels with target area texture
- Preserves lighting and texture of the target area
- Ideal for skin retouching, spot removal, and blemish correction

---

### Lasso Studio

**File**: `LassoPanel.tsx`, `LassoCanvas.tsx`, `lassoEngine.ts`

Freehand, Polygonal, and Magnetic Edge-Snapping Lasso Selection.

#### Selection Modes

| Mode | Description |
|------|-------------|
| **Freehand** | Draw a freeform selection path |
| **Polygonal** | Click to create straight-edged selection segments |
| **Magnetic** | Edge-snapping: automatically snaps to object edges as you draw |

#### Operations

- Create new selections
- Add to existing selection (Shift+click)
- Subtract from selection (Alt+click)
- Intersect with selection
- Invert selection

#### Output

Selections can be used as input for:
- Regional adjustments (selective editing)
- Inpainting masks
- Layer masks

---

### Layer Stack

**File**: `LayersPanel.tsx`, `layersEngine.ts`

Non-destructive Layer Stack with Fill Layers and 27 Blend Modes.

#### Layer Types

| Type | Description |
|------|-------------|
| **Image layer** | Original photo or imported image |
| **Adjustment layer** | Applies adjustments non-destructively |
| **Fill layer** | Solid color, gradient, or pattern fill |
| **Text layer** | Text overlay |
| **Shape layer** | Vector shapes |

#### Blend Modes (27 total)

| Category | Modes |
|----------|-------|
| **Normal** | Normal, Dissolve |
| **Darken** | Darken, Multiply, Color Burn, Linear Burn, Darker Color |
| **Lighten** | Lighten, Screen, Color Dodge, Linear Dodge, Lighter Color |
| **Contrast** | Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix |
| **Inversion** | Difference, Exclusion, Subtract, Divide |
| **Color** | Hue, Saturation, Color, Luminosity |

#### Layer Controls

- Add/remove/reorder layers
- Toggle visibility
- Adjust opacity
- Set blend mode
- Create clipping masks
- Rasterize layers

---

### Camera RAW

**File**: `RawEnginePanel.tsx`, `rawEngine.ts`

Sensor Demosaicing, Kelvin White Balance (2000K–50000K), and Highlight Recovery.

#### Demosaicing Algorithms
