---
target: frontend/App.tsx
total_score: 22
p0_count: 0
p1_count: 2
p2_count: 2
p3_count: 1
timestamp: 2026-06-27T18-04-19Z
slug: frontend-app-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Import progress visible; lock/unlock state transitions lack feedback |
| 2 | Match System / Real World | 3 | Mostly natural; "Military-grade AES encryption active" is jargon-heavy |
| 3 | User Control and Freedom | 3 | Good selection/bulk ops; no undo for favorite toggle or album add |
| 4 | Consistency and Standards | 2 | Glass morphism inconsistent (prominent sidebar vs regular header vs none elsewhere); bounce easing everywhere |
| 5 | Error Prevention | 2 | Destructive actions (purge, reset) have basic confirm but no preview; no guardrails on library reset |
| 6 | Recognition Rather Than Recall | 3 | Nav labels present; lightbox filmstrip aids recognition; photo grid has no keyboard hints |
| 7 | Flexibility and Efficiency | 3 | Bulk actions, keyboard nav, gallery/list toggle; no keyboard shortcuts for common actions (favorite, delete) |
| 8 | Aesthetic and Minimalist Design | 2 | 11 Google Fonts loaded for 3 used; StatsCard is template-heavy; visual noise from unused font families |
| 9 | Error Recovery | 2 | Empty states teach; trash restore exists; but no undo for most actions; error messages not visible |
| 10 | Help and Documentation | 1 | No tooltips, no contextual help, no onboarding. Prism AI exists but is opt-in and requires setup |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Does this look AI-generated?**

**LLM assessment:** No — the OLED-black canvas, grain texture, serif italic wordmark, and MemoriesCarousel's rotating radial gradient give Prism genuine personality. The dark theme is deliberate, not a default. However, there are AI tells: 11 Google Fonts loaded for 3 used (font hoarding), bounce easing on 5+ interactive elements (dated feel), and the StatsCard follows the "big number + small label + gradient accent" template.

**Deterministic scan:** 16 findings across 2 files: 1 overused-font warning (Space Grotesk), 5 bounce-easing warnings (cubic-bezier(0.34, 1.56, 0.64, 1)), 11 design-system-font warnings (fonts imported but unused), 2 design-system-radius warnings (10px and 1.25rem outside scale).

**False positives:** The design-system-font warnings are correct — these fonts are loaded but never referenced. They're dead weight.

## Overall Impression

Prism has a strong visual identity. The OLED-dark canvas with grain texture and glass sidebar is genuinely distinctive. The MemoriesCarousel is the strongest component: personality, motion, and emotional resonance. The biggest opportunity: cleaning the noise. 11 unused fonts dragging down performance, bounce easing undermining the premium feel, and template-pattern stats cards diluting the craftsmanship.

## What's Working

1. **MemoriesCarousel** — Rotating radial gradient, staggered card reveals, story-format viewing. Best embodiment of "The Living Album."
2. **Sidebar navigation** — Clean hierarchy, labeled sections, active state with inset glow. Glass material at prominent intensity is the right signature treatment.
3. **OLED-black identity** — #050505 body with #0c0c0c surface layering makes photos genuinely glow. The darkness IS the product.

## Priority Issues

### [P1] Bounce easing on 5+ interactive elements
- **What:** cubic-bezier(0.34, 1.56, 0.64, 1) used on slider thumbs, agent pop animation, and NavItem active indicator
- **Why it matters:** Bounce easing feels dated and tacky — opposite of the premium, intimate tone
- **Fix:** Replace all bounce curves with exponential ease-out: cubic-bezier(0.16, 1, 0.3, 1)
- **Suggested command:** /impeccable polish

### [P1] 11 unused Google Fonts loaded in index.css
- **What:** Space Grotesk, Montserrat, Pacifico, Caveat, Satisfy, Bebas Neue, Inter, Playfair Display, Cinzel, Anton imported but never used
- **Why it matters:** ~500KB+ of font data downloaded, slowing initial render. Font hoarding is an AI signature.
- **Fix:** Remove all unused @import statements. Keep only Sora, Instrument Serif, JetBrains Mono.
- **Suggested command:** /impeccable optimize

### [P2] StatsCard follows hero-metric template
- **What:** Icon + uppercase label + large number + gradient hover accent. Absolute ban pattern.
- **Why it matters:** SaaS cliché that undermines Prism's intimate brand.
- **Fix:** Replace with denser, data-forward layout: number and label inline, no gradient hover, no icon.
- **Suggested command:** /impeccable polish

### [P2] Locked Folder copy reads as AI-generated
- **What:** "Military-grade AES encryption active" in LockedFolderView.tsx
- **Why it matters:** Users care that photos are safe, not the encryption algorithm. Tech spec, not reassurance.
- **Fix:** Replace with "Your private photos are locked" or "This folder is encrypted and session-locked."
- **Suggested command:** /impeccable clarify

### [P3] No visible focus indicators on photo grid
- **What:** Photo grid items have no :focus-visible style. Keyboard navigation invisible.
- **Why it matters:** Accessibility violation — keyboard-only users can't navigate the core feature.
- **Fix:** Add focus-visible:ring-2 focus-visible:ring-primary to photo grid items.
- **Suggested command:** /impeccable audit

## Persona Red Flags

### Alex (Power User)
- No keyboard shortcuts for favorite, delete, or lock in lightbox/grid
- Bulk selection requires individual clicks — no shift-click range select
- Lightbox zoom is mouse-wheel only; no keyboard zoom shortcuts documented

### Sam (Accessibility-Dependent User)
- Photo grid items have no visible focus indicator
- Lightbox filmstrip horizontal scroll has no keyboard alternative
- Color-only favorite indicator (red vs gray) without aria-label differentiation

### Jordan (First-Timer)
- Sidebar has section labels but no tooltips explaining what each view does
- MemoriesCarousel has no explanation of "On This Day" or "Places" until clicked
- Import button has no indication of what happens next

## Minor Observations

- glass-panel and glass-card CSS classes in index.css are dead code (GlassMaterial React component is used instead)
- Grain overlay opacity (0.4) is strong — may interfere with photo color accuracy. Consider 0.15-0.2.
- MemoriesCarousel uses rounded-[2.5rem] outside DESIGN.md scale — intentional and good, should be documented
- Active nav indicator layoutId spring has too much bounce — overshoots

## Questions to Consider

1. What if stats were inline text ("2,847 photos · 142 favorites") instead of cards? Less template, more intimacy.
2. Does the grain overlay need to be this strong? At 0.15 it's subtle warmth; at 0.4 it's a texture you feel.
3. What would a confident locked folder feel like? Just a lock icon and "Your photos are safe"? Confidence through restraint.
