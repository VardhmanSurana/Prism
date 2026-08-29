/**
 * filterEngine.ts
 * Central state shape + cross-panel filter logic for the image editor.
 *
 * Sub-types are defined in adjustmentTypes.ts and re-exported here.
 *
 * Per-panel data (UI group defs, defaults, item types) lives in each panel's
 * own file:
 *   - AdjustPanel.tsx   → ADJUSTMENT_GROUPS, AdjItem, AdjGroup
 *   - DetailPanel.tsx   → DETAIL_GROUPS, DetailItem, DetailGroup, DEFAULT_DETAIL
 *   - EffectsPanel.tsx  → EFFECTS_GROUPS, EffectsItem, EffectsGroup, DEFAULT_EFFECTS_SLIDERS
 *   - curves.ts         → CurveState, DEFAULT_CURVE, getCurvesTableValues
 */

import {
  CurveState,
  DEFAULT_CURVE,
  isIdentityCurve,
  SpecializedCurvesState,
  DEFAULT_SPECIALIZED_CURVES,
  isIdentitySpecializedCurves,
} from './curves';
import { RawSettings, DEFAULT_RAW_SETTINGS } from './rawEngine';

export type {
  HslBand,
  HslChannelAdjustment,
  HslAdjustments,
  ColorWheelVal,
  ColorWheelsAdjustments,
  DefringeAdjustments,
  SingleFaceAdjustments,
  PortraitAdjustments,
  SplitToningAdjustments,
  GrainAdjustments,
  LightLeakAdjustments,
  FrameAdjustments,
  BlendAdjustments,
  TiltShiftAdjustments,
  LutAdjustments,
  BackgroundAdjustments,
} from './adjustmentTypes';
export type { DepthTextSettings, DepthTextPreset } from './depthTextEngine';
export { DEFAULT_DEPTH_TEXT_SETTINGS, DEPTH_TEXT_PRESETS } from './depthTextEngine';

export {
  HSL_BAND_DEFAULTS,
  DEFAULT_SINGLE_FACE_ADJUSTMENTS,
  DEFAULT_PORTRAIT_ADJUSTMENTS,
  DEFAULT_COLOR_WHEEL_VAL,
  DEFAULT_COLOR_WHEELS,
  DEFAULT_DEFRINGE,
  DEFAULT_GRAIN,
  DEFAULT_LIGHT_LEAK,
  DEFAULT_FRAME,
  DEFAULT_BLEND,
  DEFAULT_TILT_SHIFT,
  DEFAULT_SPLIT_TONING,
  DEFAULT_BACKGROUND_ADJUSTMENTS,
} from './adjustmentTypes';

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
  tint:        number; // -100 → 100  (green ← 0 → magenta)

  // Detail
  clarity:        number; // -100 → 100
  sharpness:      number; // 0 → 100
  noiseReduction: number; // 0 → 100
  dehaze:         number; // -100 → 100

  // Geometry
  perspective:         number; // -100 → 100
  verticalPerspective: number; // -100 → 100
  distortion:          number; // -100 → 100

  // Effects
  ambiance:    number; // -100 → 100  (Snapseed-style local contrast + colour)
  curves:      CurveState;
  specializedCurves: SpecializedCurvesState;
  vignette:    number; // -100 → 100

  // HSL per-band
  hsl:         import('./adjustmentTypes').HslAdjustments;

  // Professional Color Wheels
  colorWheels: import('./adjustmentTypes').ColorWheelsAdjustments;

  // Lens Defringe & Optical Vignetting
  defringe:    import('./adjustmentTypes').DefringeAdjustments;

  // Portrait Studio (AI Face & Skin Retouching)
  portrait?:   import('./adjustmentTypes').PortraitAdjustments;

  // New adjustments
  splitToning: import('./adjustmentTypes').SplitToningAdjustments;
  grain:       import('./adjustmentTypes').GrainAdjustments;
  lightLeak:   import('./adjustmentTypes').LightLeakAdjustments;
  frame:       import('./adjustmentTypes').FrameAdjustments;
  blend:       import('./adjustmentTypes').BlendAdjustments;
  tiltShift:   import('./adjustmentTypes').TiltShiftAdjustments;
  lut:         import('./adjustmentTypes').LutAdjustments;
  background?: import('./adjustmentTypes').BackgroundAdjustments;
  raw?:        RawSettings;
  depthText?:  import('./depthTextEngine').DepthTextSettings;

  // Non-destructive layer stack (index 0 = top of stack). Absent = base only.
  layers?:     import('./layersEngine').Layer[];
}

// ── Defaults ─────────────────────────────────────────────────────────────────

import {
  HSL_BAND_DEFAULTS,
  DEFAULT_PORTRAIT_ADJUSTMENTS,
  DEFAULT_COLOR_WHEELS,
  DEFAULT_DEFRINGE,
  DEFAULT_GRAIN,
  DEFAULT_LIGHT_LEAK,
  DEFAULT_FRAME,
  DEFAULT_BLEND,
  DEFAULT_TILT_SHIFT,
  DEFAULT_SPLIT_TONING,
  DEFAULT_BACKGROUND_ADJUSTMENTS,
} from './adjustmentTypes';
import { DEFAULT_DEPTH_TEXT_SETTINGS } from './depthTextEngine';

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
  tint:        0,
  clarity:        0,
  sharpness:      0,
  noiseReduction: 0,
  dehaze:         0,
  perspective:         0,
  verticalPerspective: 0,
  distortion:          0,
  ambiance:    0,
  curves:      DEFAULT_CURVE,
  specializedCurves: DEFAULT_SPECIALIZED_CURVES,
  vignette:    0,
  hsl:         { ...HSL_BAND_DEFAULTS },
  colorWheels: { ...DEFAULT_COLOR_WHEELS },
  defringe:    { ...DEFAULT_DEFRINGE },
  portrait:    { ...DEFAULT_PORTRAIT_ADJUSTMENTS },
  splitToning: { ...DEFAULT_SPLIT_TONING },
  grain:       { ...DEFAULT_GRAIN },
  lightLeak:   { ...DEFAULT_LIGHT_LEAK },
  frame:       { ...DEFAULT_FRAME },
  blend:       { ...DEFAULT_BLEND },
  tiltShift:   { ...DEFAULT_TILT_SHIFT },
  lut: {
    builtinId:  null,
    customData: null,
    opacity:    100,
  },
  background: { ...DEFAULT_BACKGROUND_ADJUSTMENTS },
  raw: { ...DEFAULT_RAW_SETTINGS },
  depthText: { ...DEFAULT_DEPTH_TEXT_SETTINGS },
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

  // Hue shift (Temperature & Tint are handled accurately via RGB chromatic balance)
  const hueRot = adj.hue || 0;

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



  if (adj.dehaze && adj.dehaze !== 0) {
    const f = adj.dehaze / 100;
    filters.push(`contrast(${(1 + f * 0.5).toFixed(4)})`);
    filters.push(`saturate(${(1 + f * 0.3).toFixed(4)})`);
    filters.push(`brightness(${(1 + f * 0.1).toFixed(4)})`);
  }

  if (!isIdentityCurve(adj.curves)) {
    const curvesHash = getStringHash(JSON.stringify(adj.curves));
    filters.push(`url(#curves-filter-${curvesHash})`);
  }

  return filters.join(' ');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const isDefaultAdjustments = (adj: Adjustments): boolean => {
  const baseKeys: (keyof Adjustments)[] = [
    'brightness', 'contrast', 'exposure', 'highlights', 'shadows', 'whites', 'blacks',
    'vibrance', 'saturation', 'hue', 'temperature', 'tint', 'clarity', 'sharpness', 'noiseReduction',
    'ambiance', 'vignette', 'dehaze', 'perspective', 'verticalPerspective', 'distortion'
  ];
  const isBaseDefault = baseKeys.every(k => adj[k] === 0);
  if (!isBaseDefault) return false;

  if (!isIdentityCurve(adj.curves)) return false;

  // Portrait check
  if (adj.portrait) {
    const p = adj.portrait;
    if (
      p.skinSmoothing !== 0 ||
      p.skinBrightness !== 0 ||
      p.skinWarmth !== 0 ||
      p.skinTone !== 0 ||
      p.eyeWhitening !== 0 ||
      p.eyeEnhance !== 0 ||
      p.teethWhitening !== 0 ||
      p.lipVibrance !== 0 ||
      p.eyebrowEnhance !== 0
    ) {
      return false;
    }
  }

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

  // LUT check
  if (adj.lut && (adj.lut.builtinId !== null || adj.lut.customData !== null)) return false;

  return true;
};
