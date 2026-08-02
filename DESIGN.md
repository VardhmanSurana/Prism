---
name: Prism
description: Privacy-first local photo & video library with AI-powered organization and professional editing suite
colors:
  primary: "#ffffff"
  accent: "#2563eb"
  background: "#06080c"
  surface: "#0a0c10"
  surface-raised: "#161A20"
  surface-sunken: "#050505"
  surface-popover: "#0c0c0c"
  border: "rgba(11, 84, 230, 0.05)"
  border-subtle: "rgba(255, 255, 255, 0.05)"
  text-primary: "#ffffff"
  text-secondary: "#999999"
  text-muted: "#666666"
  status-processing: "#5e6ad2"
  status-success: "#22c55e"
  status-warning: "#eab308"
  status-error: "#ef4444"
  google-primary: "#A8C7FA"
  apple-primary: "#007AFF"
  cr-accent: "oklch(75% 0.18 145)"
  cr-secondary: "oklch(65% 0.15 250)"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
    fontFeatureSettings: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
    typography: "{typography.body}"
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.body}"
  chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
    typography: "{typography.label}"
---

# Design System: Prism

## 1. Overview

**Creative North Star: "The Darkroom Instrument"**

Prism's design language draws from professional photography darkrooms and precision instruments — a space where every control has purpose, every surface recedes to let the work breathe, and the tool disappears into the craft. The interface is a deep, near-black canvas that lets photographs and videos become the only source of color and light. This is not a dashboard or a social feed; it is a working environment for visual media, built with the restraint of a Leica and the clarity of a darkroom safelight.

The system explicitly rejects decorative AI patterns: no gradient text, no over-rounded cards, no gratuitous glassmorphism, no SaaS landing-page clichés. Every surface earns its presence through function. The palette is intentionally monochromatic — blacks, near-blacks, and grays — with a single electric blue accent that appears only where the user's eye must land: active states, primary actions, and selection indicators.

**Key Characteristics:**
- Near-black canvas with absolute minimal surface variation
- Single accent color (electric blue) used sparingly for interactive states
- Instrument-grade typography: Sora for body, Instrument Serif for display moments
- Tonal layering over shadow-based elevation
- Consistent 4–6px micro-radius across all interactive elements
- Zero decorative motion; all animation conveys state change

## 2. Colors

The palette is restrained to near-monochrome with a single accent, reinforcing that photographs are the only color that matters.

### Primary
- **Pure White** (#ffffff): Body text, primary labels, active navigation. The brightest element on screen — reserved for content that demands immediate attention.

### Accent
- **Electric Blue** (#2563eb): Primary actions, active tab indicators, selection rings, focus states. Used on ≤10% of any given screen. Its rarity is the point.

### Neutral
- **Void Black** (#050505): Deepest background layer, OLED-safe canvas. The foundation everything sits on.
- **Deep Charcoal** (#06080c): Primary background surface. Slightly lighter than void to create subtle depth without contrast.
- **Surface** (#0a0c10): Card backgrounds, sidebar panels, raised surfaces. The working layer above the canvas.
- **Surface Raised** (#161A20): Hover states, active panels, popover backgrounds. The highest resting elevation.
- **Muted Gray** (#666666): Secondary text, disabled states, placeholder content. Readable but deliberately recessive.
- **Medium Gray** (#999999): Secondary labels, timestamps, metadata. Functional hierarchy without competing with content.

### Semantic
- **Processing Indigo** (#5e6ad2): Background processing indicators, sync status, AI thinking states.
- **Success Green** (#22c55e): Completed actions, positive confirmations, health indicators.
- **Warning Amber** (#eab308): Caution states, low-storage warnings, non-critical alerts.
- **Error Red** (#ef4444): destructive actions, critical failures, trash states.

### Named Rules

**The Darkroom Rule.** The canvas is always darker than any surface above it. Depth is conveyed through tonal layering (progressively lighter surfaces) — never through drop shadows on resting elements.

**The Accent Restraint Rule.** The electric blue accent appears only on interactive elements: buttons, active tabs, selection rings, focus indicators. Never on decorative elements, never on cards, never as a background fill.

## 3. Typography

**Display Font:** Instrument Serif (with Georgia, serif fallback)
**Body Font:** Sora (with system-ui, sans-serif fallback)
**Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** The pairing contrasts editorial warmth (Instrument Serif's humanist curves) against technical precision (Sora's geometric clarity). This mirrors the product's dual identity: a creative tool with engineering rigor. Instrument Serif appears only in rare display moments — the logo, section headings in the explore view — while Sora carries the functional weight of labels, buttons, and data.

### Hierarchy
- **Display** (400 weight, clamp(2rem, 5vw, 4rem), line-height 1.1): Hero headlines, section openers in the explore view. Used sparingly — perhaps once per screen.
- **Headline** (500 weight, 18px, line-height 1.3): Panel titles, sidebar section headers. The structural voice of the interface.
- **Title** (500 weight, 14px, line-height 1.4): Card titles, album names, photo metadata headers.
- **Body** (400 weight, 14px, line-height 1.5): Descriptions, form inputs, general content. Max line length 65–75ch for prose.
- **Label** (500 weight, 12px, letter-spacing 0.02em): Button text, navigation items, chips, badges. The most-used role.
- **Caption** (400 weight, 11px, line-height 1.4): Timestamps, secondary metadata, helper text.

### Named Rules

**The Instrument Rule.** Instrument Serif is forbidden in labels, buttons, data tables, and form inputs. It exists only for display typography — moments where the interface speaks, not where it works.

**The Tabular Rule.** All numeric data (durations, timestamps, dimensions, file sizes) uses JetBrains Mono with font-feature-settings: "tnum" for aligned columns.

## 4. Elevation

Prism uses tonal layering exclusively. No drop shadows on resting surfaces. Depth is communicated through progressively lighter surface tones: Void Black → Deep Charcoal → Surface → Surface Raised. This creates a darkroom-like ambiance where content floats above a true black void.

### Tonal Vocabulary
- **Level 0 — Void** (#050505): The deepest background. Used for the canvas behind all content.
- **Level 1 — Canvas** (#06080c): The primary background surface. Sits just above void.
- **Level 2 — Surface** (#0a0c10): Cards, sidebars, panels. The working layer.
- **Level 3 — Raised** (#161A20): Hover states, active panels, popovers. The highest resting elevation.
- **Level 4 — Overlay** (#1a1a1a): Modal backdrops, lightbox backgrounds. Temporary elevation above all.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state: hover elevation, focus rings, or active drag operations. A resting card with a drop shadow is a bug, not a feature.

**The Grain Overlay Rule.** A subtle noise texture (opacity 0.4, overlay blend mode) sits fixed over the entire canvas. It adds film grain atmosphere without affecting readability. Disabled in theme variants (Google, Apple) that prioritize clean surfaces.

## 5. Components

### Buttons
- **Shape:** Gently curved (6px radius). Never pill-shaped except for chips/tags.
- **Primary:** Electric blue background, white text, 8px 16px padding. Used for the single most important action on any screen.
- **Ghost:** Transparent background, muted gray text, 8px 12px padding. Used for secondary actions, navigation, toolbars.
- **Hover:** Ghost buttons gain a subtle background tint (white at 5% opacity). Primary buttons shift to a slightly darker blue.
- **Focus:** 2px electric blue outline with 2px offset. Visible, unmissable, accessible.
- **Disabled:** 40% opacity, no pointer events, cursor not-allowed.

### Cards / Containers
- **Corner Style:** 10px radius. Consistent across all card types.
- **Background:** Surface (#0a0c10) at rest, Surface Raised (#161A20) on hover.
- **Shadow Strategy:** None at rest. Subtle border shift on hover (border becomes white at 8% opacity).
- **Internal Padding:** 16px standard, 12px compact, 24px spacious.

### Inputs / Fields
- **Style:** Surface Sunken (#050505) background, 1px border at white 10% opacity, 6px radius.
- **Focus:** Border shifts to electric blue, subtle 2px blue glow around the input.
- **Error:** Border shifts to error red, helper text appears below in red.
- **Placeholder:** Muted gray (#666666) at 4.5:1 contrast ratio minimum.

### Navigation (Sidebar)
- **Style:** Fixed left sidebar, Surface background, 200–240px width.
- **Typography:** Label role (12px, 500 weight, 0.02em tracking).
- **Active State:** Electric blue text, left border accent (2px), background tint (blue at 6% opacity).
- **Hover State:** White text, subtle background tint (white at 5%).
- **Icon Language:** Material Symbols Outlined, 20px, consistent stroke weight.

### Chips / Tags
- **Style:** Surface Raised background, muted gray text, full pill radius (9999px).
- **Selected:** Electric blue background, white text.
- **Filter Variant:** Used for search filters, tag selectors. Compact padding (6px 12px).

### Photo Grid Items
- **Shape:** Configurable radius (0px for Google theme, 4px for Apple theme, 0px default).
- **Hover:** Ring effect (1px white at 20% opacity), subtle scale (1.02x).
- **Selected:** Electric blue ring (2px), checkmark overlay.
- **Transition:** 120ms ease-out for hover states, 200ms for selection.

### GlassMaterial (Signature Component)
- **Purpose:** Modal containers, keyboard shortcut overlays, overlay panels.
- **Treatment:** Backdrop blur (12px regular, 16px prominent), surface at 5% white opacity, 1px border at 5% white opacity.
- **Interactive Mode:** Pointer-following specular highlight using Framer Motion springs.
- **Usage:** Reserved for floating overlays. Never used for cards, sidebars, or resting surfaces.

### Adjustment Sliders
- **Track:** 2px height, white at 12% opacity, 99px radius.
- **Thumb:** 14px circle, white fill, subtle shadow (0 1px 6px rgba(0,0,0,0.6)).
- **Hover:** Thumb scales to 125%, gains electric blue glow ring.
- **Active:** Thumb scales to 115%, cursor becomes grabbing.

## 6. Do's and Don'ts

### Do:
- **Do** use the darkroom aesthetic — deep blacks, minimal surface contrast, photographs as the only color.
- **Do** reserve the electric blue accent for interactive states only: buttons, active tabs, selection rings, focus indicators.
- **Do** use tonal layering (Void → Surface → Raised) for depth, never drop shadows on resting elements.
- **Do** use JetBrains Mono for all numeric data (durations, timestamps, dimensions) with tabular-nums.
- **Do** use Material Symbols Outlined consistently across all surfaces — same weight, same size, same style.
- **Do** support `prefers-reduced-motion` with instant transitions as fallback.
- **Do** maintain 4.5:1 contrast ratio minimum for body text on any surface.
- **Do** use the grain overlay for atmosphere on the default theme; disable it for Google and Apple themes.

### Don't:
- **Don't** use gradient text (background-clip: text with gradients). Use solid colors only.
- **Don't** use over-rounded cards (radius > 12px). Cards top out at 10px; full-pill is for chips/tags only.
- **Don't** use decorative glassmorphism on cards, sidebars, or resting surfaces. GlassMaterial is for floating overlays only.
- **Don't** use side-stripe borders (border-left > 1px as colored accent). Use full borders or background tints.
- **Don't** use drop shadows on resting elements. Shadows appear only on hover, focus, or drag.
- **Don't** use Instrument Serif in labels, buttons, data tables, or form inputs.
- **Don't** use the electric blue accent on decorative elements, card backgrounds, or section headers.
- **Don't** use generic SaaS patterns: hero-metric templates, identical card grids, numbered section markers (01/02/03).
- **Don't** animate layout properties unless truly needed. State changes use 150–250ms ease-out.
- **Don't** use bounce, elastic, or spring animations for UI feedback. Use exponential ease-out curves.
