/**
 * filterEngine.ts
 * Central state shape + cross-panel filter logic for the image editor.
 *
 * Per-panel data (UI group defs, defaults, item types) lives in each panel's
 * own file:
 *   - AdjustPanel.tsx   → ADJUSTMENT_GROUPS, AdjItem, AdjGroup
 *   - DetailPanel.tsx   → DETAIL_GROUPS, DetailItem, DetailGroup, DEFAULT_DETAIL
 *   - EffectsPanel.tsx  → EFFECTS_GROUPS, EffectsItem, EffectsGroup, DEFAULT_EFFECTS_SLIDERS
 *   - CurveEditor.tsx   → CurveState, DEFAULT_CURVE, getCurvesTableValues
 */

import { CurveState, DEFAULT_CURVE } from './CurveEditor';
// ── Regional Edits (AI Masks) ─────────────────────────────────────────────

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
    + adj.highlights  / 100 * 0.18
    + adj.shadows     / 100 * 0.14
    + adj.whites      / 100 * 0.15
    - adj.blacks      / 100 * 0.13,   // +blacks → crush → darker overall
  );

  const ct = Math.max(0.05,
    1
    + adj.contrast  / 100 * 0.65
    + adj.blacks    / 100 * 0.22      // crushed blacks tighten contrast
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



  if (adj.curves !== DEFAULT_CURVE) {
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
  const isBaseDefault = (Object.keys(adj) as (keyof Adjustments)[]).every(k => {
    if (k === 'curves') {
      return adj.curves === DEFAULT_CURVE;
    }
    if (k === 'regions') {
      return !adj.regions || adj.regions.length === 0;
    }
    return adj[k] === 0;
  });

  return isBaseDefault;
};
