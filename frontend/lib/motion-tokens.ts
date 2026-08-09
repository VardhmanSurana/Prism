/**
 * Prism Motion Design Tokens
 * Centralized configurations for consistent, premium animations across the app.
 */

export const motionTokens = {
  duration: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
    crawl: 1.2,
  },
  easing: {
    smooth: [0.16, 1, 0.3, 1], // easeOutExpo
    snappy: [0.175, 0.885, 0.32, 1.275], // easeOutBack
    linear: 'linear',
  },
  scale: {
    press: 0.96,
    hover: 1.04,
    pop: 1.08,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  }
};

export const springs = {
  // Ultra-fast, no bounce. Best for hover/press states.
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 1,
  },
  // Smooth, natural feel. Best for page transitions or modal entry.
  gentle: {
    type: 'spring' as const,
    stiffness: 100,
    damping: 20,
    mass: 1,
  },
  // Playful, slight bounce. Best for "pop" effects or list entries.
  bouncy: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
    mass: 1,
  },
  // Heavy, high damping. Best for dragging or items following a cursor.
  release: {
    type: 'spring' as const,
    stiffness: 50,
    damping: 10,
    mass: 1,
  },
  // For scrolling or continuous value smoothing.
  smooth: {
    type: 'spring' as const,
    stiffness: 1000,
    damping: 100,
  }
};

// ── GSAP Configuration ───────────────────────────────────────────────────────
// GSAP-native easing names that map to our motion tokens.
export const gsapEase = {
  smooth: 'power3.out',        // maps to motionTokens.easing.smooth
  snappy: 'back.out(1.7)',     // maps to motionTokens.easing.snappy
  press: 'power2.inOut',       // for button press feedback
  entry: 'power3.out',         // elements entering viewport
  exit: 'power2.in',           // elements leaving (faster)
  spring: 'elastic.out(1, 0.3)', // playful bounce
} as const;

/**
 * Initialize GSAP defaults for the entire app.
 * Call once at app startup.
 */
export function initGSAPDefaults() {
  // Lazy import to avoid circular deps — called once at startup
  return import('gsap').then(({ gsap }) => {
    gsap.defaults({
      duration: motionTokens.duration.normal,
      ease: gsapEase.smooth,
      overwrite: 'auto',
    });
  });
}
