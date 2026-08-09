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
- **Error Red** (#ef4444): Destructive actions, critical failures, trash states.

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

## 5. Motion & Animation

**Animation Engine:** GSAP (GreenSock Animation Platform) with `@gsap/react` for React integration.

**Motion Philosophy:** Every animation in Prism serves a functional purpose. Motion conveys state change, spatial relationships, and system feedback. There is no decorative motion. The animation system is split between GSAP (for performance-critical paths) and Framer Motion (for declarative React patterns).

### GSAP Configuration

**Default Easing:** `power3.out` (0.3s) — premium, weighty feel with immediate response.
**Overwrite Mode:** `auto` — prevents tween stacking on rapid interactions.
**Transform Aliases:** Always use GSAP's `x`, `y`, `scale`, `rotation` over raw `transform` strings.

```typescript
// motion-tokens.ts — GSAP easing map
export const gsapEase = {
  smooth: 'power3.out',        // General UI transitions
  snappy: 'back.out(1.7)',     // Overshoot for playful elements
  press: 'power2.inOut',       // Button press feedback
  entry: 'power3.out',         // Elements entering viewport
  exit: 'power2.in',           // Elements leaving (faster exit)
  spring: 'elastic.out(1, 0.3)', // Playful bounce
};
```

### Animation Timing

| Element | Duration | Easing | Purpose |
|---------|----------|--------|---------|
| Button press | 100ms | power2.inOut | Immediate tactile feedback |
| Tab indicator slide | 300ms | power3.out | Spatial navigation cue |
| Dropdown entry | 150ms | power3.out | Quick reveal |
| Modal/drawer | 200-300ms | power3.out | Significant state change |
| Progress bar | 800ms | power2.out | Smooth value interpolation |
| Mouse tracking (glass) | 300ms | power2.out | Fluid pointer follow |

### GSAP Patterns

**QuickTo for High-Frequency Updates:**
```typescript
// GlassMaterial pointer tracking — 60fps without React re-renders
const quickX = gsap.quickTo(highlightRef, 'x', { duration: 0.3, ease: 'power2.out' });
const quickY = gsap.quickTo(highlightRef, 'y', { duration: 0.3, ease: 'power2.out' });
onPointerMove: (e) => { quickX(x); quickY(y); }
```

**Overwrite Auto for Rapid Interactions:**
```typescript
// Progress bar — prevents tween stacking on rapid updates
gsap.to(barRef, { width: `${progress}%`, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
```

**AutoAlpha for Enter/Exit:**
```typescript
// Uses opacity + visibility — no pointer events on hidden elements
gsap.fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3 });
```

### Framer Motion Patterns (Retained)

Framer Motion remains for:
- **AnimatePresence** — Portal-mounted modals, toasts, drawers (React conditional rendering)
- **layout/layoutId** — Shared element transitions between routes
- **Declarative hover/tap** — Simple `whileHover`/`whileTap` on interactive elements

### Reduced Motion

**`prefers-reduced-motion: reduce`** preserves opacity and color transitions for comprehension while killing transform-based motion. This is surgical, not nuclear — users with vestibular disorders still see state changes through color and opacity shifts.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
  /* Only kill transform-based transitions */
  [style*="transform"], [style*="translate"], [style*="scale"] {
    transition-duration: 0.01ms !important;
  }
}
```

### Hardware Acceleration

- Animate exclusively via `transform` and `opacity` — skip layout and paint
- Use `will-change: transform` on elements with frequent animations
- GSAP's `quickTo` runs in the browser's animation frame, not React's render cycle
- Framer Motion shorthand props (`x`, `y`, `scale`) use `requestAnimationFrame` — prefer full `transform` strings for GPU acceleration under load

## 6. Components

### Buttons
- **Shape:** Gently curved (6px radius). Never pill-shaped except for chips/tags.
- **Primary:** Electric blue background, white text, 8px 16px padding. Used for the single most important action on any screen.
- **Ghost:** Transparent background, muted gray text, 8px 12px padding. Used for secondary actions, navigation, toolbars.
- **Hover:** Ghost buttons gain a subtle background tint (white at 5% opacity). Primary buttons shift to a slightly darker blue.
- **Active:** `scale(0.97)` via GSAP `power2.inOut` at 100ms. Immediate tactile push feedback.
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
- **Style:** Fixed left sidebar, GlassMaterial (prominent intensity), 256px width.
- **Typography:** Label role (12px, 500 weight, 0.02em tracking).
- **Active State:** Electric blue text, left border accent (2px), background tint (blue at 6% opacity). Animated via GSAP `power3.out` at 200ms.
- **Hover State:** White text, subtle background tint (white at 5%).
- **Icon Language:** Lucide React icons, 18px, consistent stroke weight.

### Chips / Tags
- **Style:** Surface Raised background, muted gray text, full pill radius (9999px).
- **Selected:** Electric blue background, white text.
- **Filter Variant:** Used for search filters, tag selectors. Compact padding (6px 12px).

### Photo Grid Items
- **Shape:** Configurable radius (0px for Google theme, 4px for Apple theme, 0px default).
- **Hover:** Ring effect (1px white at 20% opacity), subtle scale (1.02x).
- **Selected:** Electric blue ring (2px), checkmark overlay.
- **Transition:** `transition-colors 200ms ease, border-color 200ms ease` — specific properties only.

### GlassMaterial (Signature Component)
- **Purpose:** Sidebar, modal containers, keyboard shortcut overlays, overlay panels.
- **Treatment:** Backdrop blur (12px regular, 16px prominent), surface at 5% white opacity, 1px border at 5% white opacity.
- **Interactive Mode:** Pointer-following specular highlight using GSAP `quickTo` — 60fps without React re-renders.
- **Press Feedback:** GSAP `scale(0.98)` at 100ms via `power2.inOut`.
- **Usage:** Sidebar (prominent), floating overlays (regular), decorative panels (subtle).

### Adjustment Sliders
- **Track:** 2px height, white at 12% opacity, 99px radius.
- **Thumb:** 14px circle, white fill, subtle shadow (0 1px 6px rgba(0,0,0,0.6)).
- **Hover:** Thumb scales to 125%, gains electric blue glow ring.
- **Active:** Thumb scales to 115%, cursor becomes grabbing.
- **Transition:** `transition-transform 150ms cubic-bezier(0.23, 1, 0.32, 1)` — specific properties only.

### Tab Indicator (SmoothTab)
- **Animation:** GSAP `power3.out` at 300ms slides a 2px indicator to the active tab position.
- **Implementation:** Single DOM element animated via `gsap.to()` — zero React re-renders on tab switch.
- **Visual:** Electric blue (#5e6ad2) with 10px glow shadow.

### Toggle Switch
- **Track:** 34×20px, rounded full. Off: #0c0c0c. On: #4b5563.
- **Thumb:** 15px white circle, slides via GSAP `power3.out` at 150ms.
- **Implementation:** GSAP `gsap.to()` for hardware-accelerated thumb position.

## 7. Layout Principles

- **Grid-First:** CSS Grid for multi-column layouts. Flexbox for single-axis alignment only.
- **Max-Width Containment:** Content areas capped at 1400px centered.
- **Full-Height:** Use `min-h-[100dvh]` — never `h-screen` (iOS Safari catastrophic jump).
- **Sidebar + Content:** Fixed 256px sidebar + fluid content area. No horizontal scroll.
- **Photo Grid:** Virtualized rendering via `@tanstack/react-virtual` for 10k+ items.
- **No Overlapping Elements:** Every element occupies its own clear spatial zone.

## 8. Anti-Patterns (Banned)

### AI Design Clichés
- No gradient text (`background-clip: text` with gradients)
- No over-rounded cards (radius > 12px)
- No decorative glassmorphism on resting surfaces
- No neon/outer glow shadows
- No purple button glows or "AI purple" aesthetic
- No custom mouse cursors
- No emojis in UI
- No filler text: "Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons

### Animation Anti-Patterns
- No `transition: all` — specify exact properties (`transition-colors`, `transition-transform`)
- No `ease-in` for UI elements — starts slow, feels sluggish. Use `ease-out` or custom curves
- No animations on keyboard-initiated actions (100+ times/day)
- No `scale(0)` entry — start from `scale(0.95)` with opacity
- No `transform-origin: center` on popovers (modals are exempt)
- No keyframe animations on rapidly-triggered elements — use CSS transitions

### Typography Anti-Patterns
- No `Inter` font in premium/creative contexts
- No generic serif fonts (`Times New Roman`, `Georgia`, `Garamond`) — only `Instrument Serif`
- No Instrument Serif in labels, buttons, data tables, or form inputs
- No font sizes below 11px for body text

### Color Anti-Patterns
- No pure black (#000000) — use Void Black (#050505) or Zinc-950
- No oversaturated accents — keep saturation below 80%
- No accent color on decorative elements or card backgrounds
- No warm/cool gray fluctuation — stick to one neutral palette

### Layout Anti-Patterns
- No centered Hero sections (variance exceeds 4)
- No 3-column equal card grids — use 2-column zig-zag or asymmetric layouts
- No `calc()` percentage hacks — use CSS Grid
- No horizontal scroll on mobile
- No `h-screen` — always `min-h-[100dvh]`

### Content Anti-Patterns
- No generic placeholder names ("John Doe", "Acme", "Nexus")
- No fake round numbers ("99.99%", "50%")
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No broken Unsplash links — use `picsum.photos` or SVG avatars

## 9. Do's and Don'ts

### Do:
- **Do** use the darkroom aesthetic — deep blacks, minimal surface contrast, photographs as the only color.
- **Do** reserve the electric blue accent for interactive states only: buttons, active tabs, selection rings, focus indicators.
- **Do** use tonal layering (Void → Surface → Raised) for depth, never drop shadows on resting elements.
- **Do** use JetBrains Mono for all numeric data (durations, timestamps, dimensions) with tabular-nums.
- **Do** use Lucide React icons consistently across all surfaces — same weight, same size, same style.
- **Do** support `prefers-reduced-motion` with surgical reduction — preserve opacity/color transitions, kill transform motion.
- **Do** maintain 4.5:1 contrast ratio minimum for body text on any surface.
- **Do** use the grain overlay for atmosphere on the default theme; disable it for Google and Apple themes.
- **Do** specify exact CSS transition properties — never `transition-all`.
- **Do** use GSAP `quickTo` for high-frequency updates (mouse tracking, progress bars).
- **Do** use GSAP `overwrite: 'auto'` for interactive elements that may receive rapid updates.

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
- **Don't** use `transition-all` — always specify exact properties.
- **Don't** animate `width`, `height`, `top`, `left` when `transform` can achieve the same effect.
