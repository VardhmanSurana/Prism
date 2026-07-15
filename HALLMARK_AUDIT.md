# Hallmark Audit — Prism Webapp

**Target:** `~/Work/Projects/Prism/frontend/`  
**Stack:** Tauri v2 + React/TypeScript + Tailwind CSS  
**Date:** 2025-07-15  
**No `design.md` found** — standard diversification rules apply.

---

## Structural fingerprint

Prism is a desktop photo/video editing app (sidebar + main content), not a marketing page. The AI template fingerprint (centered hero → 3 equal cards → CTA → footer) does **not** apply at the app-shell level. However, individual views — particularly **ExploreView** and **PhotographyInsights** — exhibit the 3-column feature grid pattern within their content areas.

---

## Critical (ships as slop)

### 1. The 3-column feature grid — PhotographyInsights.tsx:88

Three equal-width `GlassMaterial` cards in `lg:grid-cols-3`, each with an icon above a heading above content (Camera → "Most-used cameras", Aperture → "How you shoot", MapPin → "Places photographed"). This is the canonical AI template pattern: three equal columns, icon above heading, two-line body.

> **Fix.** Break the grid: make the "How you shoot" card span full width as a stats strip, keep the two ranking lists as unequal columns, or remove the icons from headings and lead with typography.

---

## Major (looks AI-generated)

### 2. Italic headers — ExploreHeader.tsx:26

`className="text-4xl font-serif italic text-white tracking-tight"` — every Explore section heading renders in italic serif. The italic-display-face-on-headings is one of the most reliable AI tells. This component is reused across PhotographyInsights, OnThisDay, AIThemeGrid, SeasonalGrid, and EventTimeline, so the tell is systematic.

> **Fix.** Remove `italic` from ExploreHeader. Use `font-serif font-bold` (weight for emphasis) or add an accent underline.

### 3. Italic headers — UtilitiesView.tsx:61

`className="font-serif italic text-white text-[32px] leading-tight"` on "System Utilities". Same tell.

> **Fix.** Remove `italic`. Use weight or accent colour for emphasis.

### 4. Italic headers — AISettings.tsx:215

`className="font-serif italic text-[#f7f8f8] text-lg leading-tight"` on "AI & Hardware Configuration". Same tell, third occurrence.

> **Fix.** Remove `italic`. Use `font-serif font-semibold` for emphasis.

### 5. Eyebrow on every section — ExploreHeader.tsx:22

`className="text-[10px] font-mono font-bold uppercase tracking-[0.4em]"` — mono uppercase eyebrow label rendered above every Explore section heading. The eyebrow is decorative (not genuinely numbered/ordinal), and it appears on every section, erasing hierarchy.

> **Fix.** Remove the eyebrow from ExploreHeader. If a label is needed, place it inline beside or below the heading, not above as a chapter marker.

### 6. Eyebrow on every section — UtilitiesView.tsx:64

`className="text-[10px] font-mono uppercase tracking-[0.3em] text-gray-500 mt-3"` — "Engine management & environment optimization" as a mono uppercase eyebrow above the section heading.

> **Fix.** Fold the description into the heading or remove the eyebrow entirely. The heading alone communicates intent.

### 7. Mid-render token improvisation — Switch.tsx:58–62

```js
style={{
  backgroundColor: checked ? (isHovered ? '#828fff' : '#5e6ad2')
    : isHovered ? '#1a1c1e' : '#0c0c0c',
}}
```

Inline hex values for the switch track background, bypassing the Tailwind token system. Four hardcoded colours in one inline style.

> **Fix.** Move these into Tailwind utility classes with CSS custom properties, or define `--switch-track-on`, `--switch-track-off` tokens and reference them.

### 8. Mid-render token improvisation — AISettings.tsx:193–207

`statusBadgeStyle` and `statusDotStyle` use hardcoded hex values (`#5e6ad2`, `#828fff`) mixed with Tailwind named colors (`red-500`, `emerald-500`). The token system is partially bypassed.

> **Fix.** Define `--color-status-processing` and `--color-status-idle` tokens, then reference them via Tailwind's `rgb(var(--color-status-processing) / <alpha-value>)` pattern.

### 9. Bounce and elastic easing — Switch.tsx:26–31

```js
const springTransition = {
  type: 'spring' as const,
  stiffness: 700,
  damping: 35,
  mass: 0.8,
};
```

Framer Motion spring animation on a UI toggle switch. Elastic bounce on a non-physical interactive element is a microinteraction tell.

> **Fix.** Replace with `transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1)` (exponential ease-out). Reserve spring physics for genuine physical interactions (drag-and-drop).

---

## Minor (small taste issues)

### 10. Universal hover:scale-105 — Filmstrip.tsx:52–55

`hover:scale-105` on every filmstrip thumbnail button. Every thumbnail scales identically on hover with no shadow or colour change as an alternative signal.

> **Fix.** Pick one hover signal per element: a 1px translate-y or a border colour shift, not a scale transform.

### 11. `transition-all` — UtilitiesView.tsx:75, ProjectsDashboard.tsx:258, Filmstrip.tsx:52

`transition-all duration-500` on tab buttons (UtilitiesView), `transition-all duration-200` on play overlay (ProjectsDashboard), `transition-all duration-200` on filmstrip thumbnails. Animates every CSS property including ones that should be instant.

> **Fix.** Specify properties: `transition-colors duration-150` for background changes, `transition-opacity duration-200` for visibility toggles.

### 12. Centred everything — UtilitiesView.tsx:60

Section header and content are centred (`text-center`, `flex justify-center`). This view is the only centred-heavy layout in the app; biasing left would better match the sidebar-aligned pattern used elsewhere.

> **Fix.** Left-align the section header and let the tab bar remain centred, or bias the layout to match the sidebar's left-aligned rhythm.

### 13. Glassmorphism without purpose — PhotographyInsights.tsx:89–104

`<GlassMaterial intensity="regular">` on content cards where there is no meaningful background content behind the cards to blur. The frosted-glass effect is decorative here, not communicating depth.

> **Fix.** Use a solid `bg-[#0c0c0c]` surface with a hairline border instead. Reserve GlassMaterial for actual overlays (modals, popovers).

### 14. Near-pure-black surfaces — tailwind.config.js:13–14

`background: "#050505"` and `surface: "#0c0c0c"` — technically not `#000000` but so close they read as flat synthetic black. The anti-pattern warns against pure black surfaces.

> **Fix.** Tint toward the anchor hue: `#06080c` (cool navy-black) or `#080605` (warm charcoal-black) instead of neutral near-black.

### 15. Arbitrary high z-index — FileFolderBrowserDialog.tsx:199

`z-[1050]` — an arbitrary z-value outside any named scale.

> **Fix.** Define a z-index scale in `tailwind.config.js` (`z-overlay: 1000`, `z-modal: 1100`) and reference the token.

---

## Summary

```
1 critical · 8 major · 6 minor
```

**Verdict — reads as AI-generated.** The italic serif headings (systematic across all Explore and Utilities views), the 3-column feature grid in PhotographyInsights, and the mid-render hex improvisation in Switch and AISettings are the highest-priority fixes. The italic headers alone are enough to trigger the AI-pattern recognition — they appear in every section heading across the app's two largest view surfaces.
