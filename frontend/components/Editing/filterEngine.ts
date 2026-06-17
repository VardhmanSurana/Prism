/**
 * filterEngine.ts
 * Central state shape + cross-panel filter logic for the image editor.
 *
 * Per-panel data (UI group defs, defaults, item types) lives in each panel's
 * own file:
 *   - AdjustPanel.tsx   → ADJUSTMENT_GROUPS, AdjItem, AdjGroup
 *   - DetailPanel.tsx   → DETAIL_GROUPS, DetailItem, DetailGroup, DEFAULT_DETAIL
 *   - EffectsPanel.tsx  → EFFECTS_GROUPS, EffectsItem, EffectsGroup, DEFAULT_EFFECTS_SLIDERS
 *   - curves.ts         → CurveState, DEFAULT_CURVE, getCurvesTableValues
 */

import { CurveState, DEFAULT_CURVE, isIdentityCurve } from './curves';

// ── HSL Per-Band Types ───────────────────────────────────────────────────────

export type HslBand =
  | 'reds' | 'oranges' | 'yellows' | 'greens'
  | 'aquas' | 'blues'  | 'purples' | 'pinks';

export interface HslChannelAdjustment {
  hue:        number; // -180 → +180
  saturation: number; // -100 → +100
  luminance:  number; // -100 → +100
}

export type HslAdjustments = Record<HslBand, HslChannelAdjustment>;

export const HSL_BAND_DEFAULTS: HslAdjustments = {
  reds:    { hue: 0, saturation: 0, luminance: 0 },
  oranges: { hue: 0, saturation: 0, luminance: 0 },
  yellows: { hue: 0, saturation: 0, luminance: 0 },
  greens:  { hue: 0, saturation: 0, luminance: 0 },
  aquas:   { hue: 0, saturation: 0, luminance: 0 },
  blues:   { hue: 0, saturation: 0, luminance: 0 },
  purples: { hue: 0, saturation: 0, luminance: 0 },
  pinks:   { hue: 0, saturation: 0, luminance: 0 },
};

export interface RegionalAdjustment {
  id: string;
  type: 'face' | 'background' | 'subject' | 'custom';
  maskUrl: string;
  adjustments: {
    brightness?: number;
    contrast?:   number;
    saturation?: number;
    warmth?:     number;
    blur?:       number;
    sharpness?:  number;
  };
}

// ── Combined State Type ──────────────────────────────────────────────────────

export interface Adjustments {
  // Tone
  brightness:  number; // -100 → 100
  contrast:    number; // -100 → 100
  exposure:    number; // -100 → 100
  highlights:  number; // -100 → 100
  shadows:     number; // -100 → 100
  whites:      number; // -100 → 100  (white point)
  blacks:      number; // -100 → 100  (black point)

  // Color
  vibrance:    number; // -100 → 100
  saturation:  number; // -100 → 100
  hue:         number; // -180 → 180
  temperature: number; // -100 → 100  (cool ← 0 → warm)

  // Detail
  clarity:        number; // -100 → 100
  sharpness:      number; // 0 → 100
  noiseReduction: number; // 0 → 100

  // Effects
  ambiance:    number; // -100 → 100  (Snapseed-style local contrast + colour)
  curves:      CurveState;
  vignette:    number; // -100 → 100

  // AI Regions
  regions:     RegionalAdjustment[];

  // HSL per-band
  hsl:         HslAdjustments;

  // New adjustments
  splitToning: SplitToningAdjustments;
  grain:       GrainAdjustments;
  lightLeak:   LightLeakAdjustments;
  frame:       FrameAdjustments;
  blend:       BlendAdjustments;
  tiltShift:   TiltShiftAdjustments;
}

export interface SplitToningAdjustments {
  shadows:    { hue: number; saturation: number };
  highlights: { hue: number; saturation: number };
  balance:    number;
}

export interface GrainAdjustments {
  amount:  number;
  size:    'fine' | 'medium' | 'coarse';
  colored: boolean;
}

export interface LightLeakAdjustments {
  preset:  string | null;
  opacity: number;
}

export interface FrameAdjustments {
  style:     'none' | 'polaroid' | 'filmstrip' | 'matte' | 'rounded' | 'thinline' | 'shadowbox';
  color:     string;
  thickness: number;
}

export interface BlendAdjustments {
  photoId:       number | null;
  blendImageSrc: string | null;
  mode:          GlobalCompositeOperation;
  opacity:       number;
  fit:           'cover' | 'contain' | 'center';
}

export interface TiltShiftAdjustments {
  enabled:       boolean;
  mode:          'linear' | 'radial';
  blurStrength:  number;
  focusPosition: number;
  focusWidth:    number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness:  0,
  contrast:    0,
  exposure:    0,
  highlights:  0,
  shadows:     0,
  whites:      0,
  blacks:      0,
  vibrance:    0,
  saturation:  0,
  hue:         0,
  temperature: 0,
  clarity:        0,
  sharpness:      0,
  noiseReduction: 0,
  ambiance:    0,
  curves:      DEFAULT_CURVE,
  vignette:    0,
  regions:     [],
  hsl:         { ...HSL_BAND_DEFAULTS },
  splitToning: {
    shadows:    { hue: 0, saturation: 0 },
    highlights: { hue: 0, saturation: 0 },
    balance:    0,
  },
  grain: {
    amount:  0,
    size:    'medium',
    colored: false,
  },
  lightLeak: {
    preset:  null,
    opacity: 50,
  },
  frame: {
    style:     'none',
    color:     '#ffffff',
    thickness: 5,
  },
  blend: {
    photoId:       null,
    blendImageSrc: null,
    mode:          'screen',
    opacity:       50,
    fit:           'cover',
  },
  tiltShift: {
    enabled:       false,
    mode:          'linear',
    blurStrength:  30,
    focusPosition: 50,
    focusWidth:    30,
  },
};
// ── CSS Filter Conversion ────────────────────────────────────────────────────

/**
 * Simple DJB2-like hash function to generate a short unique string key
 * for dynamic SVG filter invalidation.
 */
export function getStringHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}


/**
 * Map the `Adjustments` object to a CSS `filter` string for real-time preview.
 *
 * Mapping rationale
 * ─────────────────
 * • brightness / exposure / whites / shadows: all affect perceived luminance,
 *   combined into a single `brightness()` value to avoid compounding artefacts.
 * • blacks (positive) crushes shadows → raises perceived contrast and darkens.
 * • contrast / ambiance: both add mid-tone contrast → combined into `contrast()`.
 * • saturation / vibrance / ambiance: all boost colour → `saturate()`.
 * • temperature shifts hue subtly toward warm (yellow/orange) or cool (blue).
 */
export function toFilterString(adj: Adjustments): string {
  const br = Math.max(0.05,
    1
    + adj.brightness  / 100 * 0.55
    + adj.exposure    / 100 * 0.50
    + adj.whites      / 100 * 0.15
    + adj.blacks      / 100 * 0.13,   // +blacks → raise black point → brighter overall
  );

  const ct = Math.max(0.05,
    1
    + adj.contrast  / 100 * 0.65
    - adj.blacks    / 100 * 0.22      // +blacks → softer contrast in shadows
    + adj.ambiance  / 100 * 0.42     // ambiance = clarity/local-contrast boost
    + (adj.clarity || 0)   / 100 * 0.38,   // Clarity adds mid-tone contrast
  );

  const sat = Math.max(0,
    1
    + adj.saturation / 100 * 0.60
    + adj.vibrance   / 100 * 0.38
    + adj.ambiance   / 100 * 0.24,
  );

  // Temperature: positive → warm (shift hue toward yellow/orange ≈ +hue-rotate)
  const hueRot = adj.hue + adj.temperature * 0.65;

  const filters = [
    `brightness(${br.toFixed(4)})`,
    `contrast(${ct.toFixed(4)})`,
    `saturate(${sat.toFixed(4)})`,
    `hue-rotate(${hueRot.toFixed(2)}deg)`,
  ];

  if (adj.noiseReduction && adj.noiseReduction > 0) {
    const blurRadius = adj.noiseReduction / 100 * 1.2;
    filters.push(`blur(${blurRadius.toFixed(2)}px)`);
  }

  if (adj.sharpness && adj.sharpness !== 0) {
    if (adj.sharpness > 0) {
      filters.push('url(#sharpness-filter)');
    } else {
      // Negative sharpness = "Soften" effect (subtle blur)
      // Scaled to the new -150 limit
      const softenBlur = Math.abs(adj.sharpness) / 100 * 1.5;
      filters.push(`blur(${softenBlur.toFixed(2)}px)`);
    }
  }



  if (!isIdentityCurve(adj.curves)) {
    const curvesHash = getStringHash(JSON.stringify(adj.curves));
    filters.push(`url(#curves-filter-${curvesHash})`);
  }

  if (adj.regions && adj.regions.length > 0) {
    adj.regions.forEach(region => {
      const regHash = getStringHash(JSON.stringify(region.adjustments));
      filters.push(`url(#region-filter-${region.id}-${regHash})`);
    });
  }

  return filters.join(' ');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const isDefaultAdjustments = (adj: Adjustments): boolean => {
  const baseKeys: (keyof Adjustments)[] = [
    'brightness', 'contrast', 'exposure', 'highlights', 'shadows', 'whites', 'blacks',
    'vibrance', 'saturation', 'hue', 'temperature', 'clarity', 'sharpness', 'noiseReduction',
    'ambiance', 'vignette'
  ];
  const isBaseDefault = baseKeys.every(k => adj[k] === 0);
  if (!isBaseDefault) return false;

  if (!isIdentityCurve(adj.curves)) return false;
  if (adj.regions && adj.regions.length > 0) return false;

  // HSL check
  const hasHsl = Object.values(adj.hsl).some(
    ch => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0
  );
  if (hasHsl) return false;

  // Split Toning check
  if (adj.splitToning && (adj.splitToning.shadows.saturation !== 0 || adj.splitToning.highlights.saturation !== 0)) {
    return false;
  }

  // Grain check
  if (adj.grain && adj.grain.amount !== 0) return false;

  // Light leak check
  if (adj.lightLeak && adj.lightLeak.preset !== null) return false;

  // Frame check
  if (adj.frame && adj.frame.style !== 'none') return false;

  // Blend check
  if (adj.blend && adj.blend.photoId !== null) return false;

  // Tilt Shift check
  if (adj.tiltShift && adj.tiltShift.enabled) return false;

  return true;
};
