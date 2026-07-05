---
name: Prism
description: Privacy-first local photo library — warm, intimate, personal
colors:
  ink: "#ffffff"
  surface-deep: "#050505"
  surface: "#0c0c0c"
  surface-raised: "#161616"
  surface-overlay: "#1E232B"
  accent: "#2563eb"
  accent-dim: "rgba(11, 84, 230, 0.05)"
  muted: "#707070"
  glass-tint: "rgba(255, 255, 255, 0.05)"
  glass-border: "rgba(255, 255, 255, 0.03)"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontWeight: 400
    fontStyle: "italic"
  body:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.15em"
    textTransform: "uppercase"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  sidebar-nav:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  sidebar-nav-active:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  photo-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  stats-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px"
---

# Design System: Prism

## 1. Overview

**Creative North Star: "The Living Album"**

Prism should feel like opening a personal photo album in a dim, warm room — the kind of space where photos are the light source. The UI is a quiet envelope around the collection: dark enough that images glow, textured enough that the interface feels handcrafted rather than manufactured. The analog warmth of the grain overlay, the serif italic logo, and the glass panels evoke physical photo viewing — not a digital tool, but a personal museum at night.

This system explicitly rejects the generic SaaS dashboard: no cream backgrounds, no identical card grids, no gradient text, no numbered eyebrow scaffolding. Prism's dark OLED canvas is deliberate — it makes photos the brightest thing on screen. The grain texture and mesh atmosphere add organic warmth to what could otherwise feel sterile. The brand personality — warm, personal, intimate — lives in the details: the serif italic "Prism" wordmark, the careful glass luminance, the tactile hover responses.

**Key Characteristics:**
- OLED-black canvas where photos are the primary light source
- Grain texture and mesh atmosphere for analog warmth
- Glass luminance for depth, applied selectively — backdrop-filter only on interactive elements to avoid WebKitGTK compositing overhead
- Serif italic wordmark paired with geometric sans body
- Tactile interactions: glow, scale, and shadow response on hover/focus
- CSS transitions preferred over Framer Motion layout animations for sidebar navigation

## 2. Colors

The palette is intentionally minimal — OLED-dark neutrals with one cool-blue accent. Warmth comes from texture and typography, not color temperature.

### Primary
- **Ink White** (#ffffff): Primary text, icons, and active navigation. The brightest element on screen — used deliberately so text and chrome recede behind photo content.

### Accent
- **Prism Blue** (#2563eb): Primary action color — active nav indicators, selection highlights, import progress, interactive accents. Used sparingly (≤10% of any surface) to maintain its signal value.

### Neutral
- **OLED Black** (#050505): Body background. The deepest possible surface — photos appear to float above it.
- **Surface** (#0c0c0c): Card backgrounds, sidebar panel, content containers. Slightly lifted from the body.
- **Surface Raised** (#161616): Hover states, secondary surfaces, raised elements.
- **Surface Overlay** (#1E232B): Tertiary surface for overlays and depth layering.
- **Muted Gray** (#707070): Secondary text, labels, inactive states, metadata.
- **Glass Border** (rgba(255, 255, 255, 0.03)): Near-invisible borders for glass panel separation.

### Named Rules
**The Darkness Rule.** The background is OLED black (#050505). This is not a dark theme applied to a light-mode product — the darkness IS the product. Photos are the light source. Never lighten the body background to "feel warmer"; warmth comes from grain, serif typography, and imagery.

**The Accent Scarcity Rule.** Prism Blue is used on ≤10% of any given screen. Its rarity makes it a signal. Never use it for decoration, backgrounds, or large surface fills.

## 3. Typography

**Display Font:** Instrument Serif (with Georgia, serif fallback)
**Body Font:** Sora (with system-ui, sans-serif fallback)
**Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** The serif italic wordmark evokes a personal, analog feel — like signing a photo album. Sora is clean and geometric without being cold, carrying the functional UI with quiet competence. The pairing is contrast-axis: warm serif personality against precise sans function.

### Hierarchy
- **Display** (Instrument Serif, italic, 400, clamp(2rem, 5vw, 3.5rem), 1.1): The "Prism" wordmark and hero-level moments only. Not for section headings.
- **Title** (Sora, 600, 1.25rem, 1.3): Section headings, view titles ("Gallery", "Albums", "People").
- **Body** (Sora, 400, 0.875rem, 1.5): Photo metadata, descriptions, form text. Max line length 65–75ch for prose.
- **Label** (Sora, 600, 0.6875rem, uppercase, tracking 0.15em): Section dividers ("Library", "Utilities"), stat labels, eyebrow text.
- **Mono** (JetBrains Mono, 400, 0.8125rem): File paths, diagnostic output, code-like data.

### Named Rules
**The Receding Chrome Rule.** Typography exists to serve the photos, not to be admired. Headings are functional, not decorative. The display font appears only on the wordmark — never on section headers or stats.

## 4. Elevation

Depth is conveyed through soft ambient shadows and subtle tonal layering. Backdrop-filter blur is avoided on non-interactive surfaces due to WebKitGTK compositing costs in the Tauri desktop shell. Most surfaces are flat with tonal separation: body (#050505) → surface (#0c0c0c) → raised (#161616).

### Shadow Vocabulary
- **Ambient lift** (`box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5)`): Cards and containers at rest. Subtle enough to feel like natural light falloff.
- **Hover lift** (`box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7)`): Interactive elements on hover. Deepens the shadow to signal elevation change.
- **Glass panel** (`box-shadow: 10px 0 30px -15px rgba(0, 0, 0, 0.5)`): Sidebar and overlay panels. Directional shadow suggesting ambient room light.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus) or for structural separation (sidebar, modals). No decorative shadows.

## 5. Components

### Sidebar Navigation
- **Character:** Frosted glass panel with ambient shadow. Navigation is quiet until activated.
- **Shape:** Full-height panel, no border-radius on the outer edge.
- **Background:** Glass material (non-interactive mode) — translucent dark tint without backdrop-filter. Solid `bg-background/80` for the header.
- **Default state:** Muted gray text (#707070) on transparent background.
- **Hover state:** Slight text brightening, subtle background lift.
- **Active state:** White text (#ffffff) with inset glow (`box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.06)`), white/6% background. Active indicator uses CSS transition (opacity/scale) instead of Framer Motion layoutId for smoother navigation in WebKitGTK.
- **Typography:** 0.875rem, weight 500. Labels use 0.6875rem uppercase with 0.15em tracking.

### Photo Grid Cards
- **Character:** Clean, minimal containers that let images dominate.
- **Corner Style:** Gently curved (12px radius).
- **Background:** Surface (#0c0c0c) at rest, Surface Raised (#161616) on hover.
- **Shadow:** Ambient lift at rest, deepens on hover.
- **Border:** None. Tonal separation only.
- **Hover:** Subtle scale-up (1.02) with shadow deepening. Transition 200ms ease-out.

### Stats Cards
- **Character:** Dense data containers with gradient hover accent.
- **Corner Style:** Large radius (16px).
- **Background:** Surface (#0c0c0c) at rest. On hover: a gradient border accent sweeps in from the edge.
- **Internal Padding:** 28px.
- **Typography:** Label (uppercase, tracked) for the stat name; large numeric value for the stat.

### Buttons
- **Shape:** Rounded (6px radius for small, 8px for standard).
- **Primary:** Prism Blue (#2563eb) background, white text, 12px 24px padding.
- **Hover:** Brightens slightly, shadow lifts. Transition 150ms ease-out.
- **Focus:** 2px blue outline offset by 2px.
- **Ghost/Secondary:** Transparent background, white/10% border, white text. Hover fills with white/5%.

### Glass Material (Signature)
- **Character:** Liquid glass with pointer-following light reflection. Three intensity levels: subtle (8px blur), regular (20px), prominent (40px).
- **Background:** Translucent white tint (2–8% opacity depending on intensity). Backdrop-filter blur only applied when `interactive=true`.
- **Interactive:** Specular highlight follows mouse position via spring physics. Only active when `interactive` prop is true.
- **Non-interactive (default):** Plain translucent background with inset shadow — no motion values, no backdrop-filter. Used for sidebar, header, and most button wrappers to avoid compositing overhead in WebKitGTK.
- **Border:** rgba(255, 255, 255, 0.03–0.1 depending on intensity).
- **Use:** Sidebar panel (non-interactive), dialog overlays (regular), subtle containers (subtle). Not for general card surfaces.

### Inputs / Fields
- **Style:** Dark surface (#0c0c0c) background, 1px border in rgba(255, 255, 255, 0.1), 6px radius.
- **Focus:** Blue border (#2563eb) with subtle glow. Transition 150ms.
- **Placeholder:** Muted gray (#707070) at 4.5:1 contrast minimum.
- **Error:** Red border with error text below.

### Navigation (Sidebar)
- **Style:** Vertical list with section dividers. Sections: Main Nav (Gallery, Explore, Map, Prism AI), Library (Albums, People, Trash), Utilities (Settings, Locked Folder).
- **Default:** Muted gray text, no background.
- **Hover:** Slight brightening, transparent background lift.
- **Active:** White text, white/6% background, inset glow shadow.
- **Icon:** Lucide icons, 20px, current color inherited from text.

### Locked Folder Auth
- **Character:** Secure, trustworthy. A form that says "your secrets are safe."
- **Background:** OLED black with centered glass card.
- **Input:** Dark surface, password mask, blue focus glow.
- **Button:** Primary blue, full-width, confident.

## 6. Do's and Don'ts

### Do:
- **Do** keep the body background OLED black (#050505). This is the product's identity — photos are the light source.
- **Do** use grain texture and mesh atmosphere to add analog warmth. These are Prism's signature textures.
- **Do** keep the serif italic wordmark as the only display-font moment. Everything else is Sora.
- **Do** verify contrast: body text ≥ 4.5:1 against dark backgrounds, large text ≥ 3:1.
- **Do** use shadows sparingly — flat by default, shadow on hover/focus only.
- **Do** keep Prism Blue (accent) to ≤10% of any screen surface. Its rarity is its power.
- **Do** let photos be the brightest, most colorful element on every screen.

### Don't:
- **Don't** lighten the background to "feel warmer." Warmth comes from grain, serif type, and imagery — not from a lighter body.
- **Don't** use gradient text (`background-clip: text`). Use a single solid color. Emphasis via weight or size.
- **Don't** put glass morphism on every card or container. Glass is a signature treatment for the sidebar and key overlays, not a universal pattern.
- **Don't** add tiny uppercase tracked eyebrows above every section. One named kicker is voice; an eyebrow on every section is AI grammar.
- **Don't** use numbered section markers (01 / 02 / 03) as scaffolding. Numbers earn their place only when the section is a real ordered sequence.
- **Don't** use side-stripe borders (`border-left > 1px` colored accent) on cards or list items. Never intentional.
- **Don't** use the hero-metric template (big number, small label, gradient accent). It's a SaaS cliché.
- **Don't** use identical card grids with icon + heading + text repeated endlessly.
- **Don't** put display fonts in UI labels, buttons, or data.
- **Don't** use bounce or elastic easing curves. Ease out with exponential curves (ease-out-quart/quint/expo).
- **Don't** animate CSS layout properties unless truly needed.
- **Don't** gate content visibility on class-triggered transitions — they fire inconsistently on hidden tabs.
- **Don't** make Prism feel like a generic SaaS dashboard, a Google Photos clone, or a Lightroom competitor. It's a personal, intimate photo album — a private museum at night.
