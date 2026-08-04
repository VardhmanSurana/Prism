/**
 * hslEngine.ts
 * Pixel-level HSL per-band processing for the HSL Color Mixer tool.
 *
 * Architecture:
 *  - Each pixel is converted from RGB → HSL.
 *  - Its hue is classified into one of 8 bands (Reds, Oranges, …).
 *  - The per-band H/S/L deltas from the user's sliders are applied.
 *  - The pixel is converted back to RGB.
 *
 * This runs at export time for full quality. A tiny (200×150px) thumbnail
 * preview is also computed inside HslPanel for live feedback.
 */

import { HslAdjustments, HslBand } from './filterEngine';

// ── Band hue ranges (in degrees, 0-360) ─────────────────────────────────────
// Each band has a center hue and a soft-blend radius so edges blend smoothly.
interface BandDefinition {
  center: number; // degrees 0-360
  halfWidth: number; // degrees on each side at full influence
  blendWidth: number; // degrees of soft falloff on each side
}

const BAND_DEFS: Record<HslBand, BandDefinition> = {
  reds:    { center:   0, halfWidth: 20, blendWidth: 15 },
  oranges: { center:  30, halfWidth: 15, blendWidth: 15 },
  yellows: { center:  60, halfWidth: 20, blendWidth: 15 },
  greens:  { center: 120, halfWidth: 35, blendWidth: 20 },
  aquas:   { center: 180, halfWidth: 20, blendWidth: 20 },
  blues:   { center: 240, halfWidth: 30, blendWidth: 20 },
  purples: { center: 280, halfWidth: 25, blendWidth: 20 },
  pinks:   { center: 330, halfWidth: 25, blendWidth: 20 },
};

// ── RGB ↔ HSL conversion ─────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  h = (h / 6) * 360;
  return [h, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hn) * 255),
    Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  ];
}

// ── Band influence weight ────────────────────────────────────────────────────
// Returns 0–1: how much influence the given band has on a pixel with hue `hue`.

function getBandWeight(hue: number, def: BandDefinition): number {
  // Handle wraparound (reds straddle 0°/360°)
  let diff = Math.abs(hue - def.center);
  if (diff > 180) diff = 360 - diff;

  const inner = def.halfWidth;
  const outer = def.halfWidth + def.blendWidth;

  if (diff <= inner) return 1;
  if (diff >= outer) return 0;
  // Smooth cosine falloff in the blend zone
  return 0.5 + 0.5 * Math.cos(((diff - inner) / (outer - inner)) * Math.PI);
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Applies per-band HSL adjustments to every pixel in the given ImageData in-place.
 * Skips bands whose H/S/L values are all zero (perf shortcut).
 */
export function applyHslToImageData(
  imageData: ImageData,
  hsl: HslAdjustments,
): void {
  // Pre-filter bands that have any non-zero adjustment
  const activeBands = (Object.keys(hsl) as HslBand[]).filter(band => {
    const b = hsl[band];
    return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
  });

  if (activeBands.length === 0) return;

  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Skip near-greys — they have negligible saturation so HSL barely helps
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 8) continue;

    const [h, s, l] = rgbToHsl(r, g, b);

    let dh = 0, ds = 0, dl = 0;

    for (const band of activeBands) {
      const weight = getBandWeight(h, BAND_DEFS[band]);
      if (weight === 0) continue;
      const adj = hsl[band];
      dh += adj.hue * weight;
      ds += (adj.saturation / 100) * weight;
      dl += (adj.luminance / 100) * weight;
    }

    if (dh === 0 && ds === 0 && dl === 0) continue;

    const newH = ((h + dh) % 360 + 360) % 360;
    const newS = Math.max(0, Math.min(1, s + ds));
    const newL = Math.max(0, Math.min(1, l + dl * 0.5)); // scale dl to avoid clipping

    const [nr, ng, nb] = hslToRgb(newH, newS, newL);
    data[i]     = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/**
 * Draws a small HSL-adjusted preview of `imageSrc` into `canvas`.
 * Used by HslPanel for the live thumbnail.
 */
export async function renderHslPreview(
  imageSrc: string,
  hsl: HslAdjustments,
  canvas: HTMLCanvasElement,
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = canvas.width;
      const H = canvas.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(); return; }
      ctx.drawImage(img, 0, 0, W, H);
      const imageData = ctx.getImageData(0, 0, W, H);
      applyHslToImageData(imageData, hsl);
      ctx.putImageData(imageData, 0, 0);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = imageSrc;
  });
}

export { rgbToHsl, hslToRgb };

import { SpecializedCurvesState, isIdentitySpecializedCurves } from './curves';
import { createMonotoneCubicSpline, generateLUT } from './spline';

export function applySpecializedCurvesToImageData(
  imageData: ImageData,
  curves: SpecializedCurvesState
): void {
  if (!curves || isIdentitySpecializedCurves(curves)) return;

  // Build LUTs for each curve
  const buildLut = (pts: { x: number; y: number }[], xDomain: number, yDomain: number, samples: number = 360) => {
    const scaled = pts.map(p => ({ x: p.x / xDomain, y: p.y / yDomain }));
    const fn = createMonotoneCubicSpline(scaled);
    const rawLut = generateLUT(fn, samples);
    return rawLut.map(v => Math.max(0, Math.min(1, v)) * yDomain);
  };

  const hueVsHueLut = buildLut(curves.hueVsHue, 360, 360, 360);
  const hueVsSatLut = buildLut(curves.hueVsSat, 360, 200, 360);
  const hueVsLumLut = buildLut(curves.hueVsLum, 360, 200, 360);
  const lumVsSatLut = buildLut(curves.lumVsSat, 255, 255, 256);
  const satVsSatLut = buildLut(curves.satVsSat, 255, 255, 256);

  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgbToHsl(r, g, b);

    const hIdx = Math.round(Math.max(0, Math.min(359, h)));
    const lIdx = Math.round(Math.max(0, Math.min(255, l * 255)));
    const sIdx = Math.round(Math.max(0, Math.min(255, s * 255)));

    // 1. Hue vs Hue shift
    let newH = (h + (hueVsHueLut[hIdx] - 180)) % 360;
    if (newH < 0) newH += 360;

    // 2. Hue vs Saturation multiplier
    let newS = s * (hueVsSatLut[hIdx] / 100);

    // 3. Hue vs Luminance multiplier
    let newL = l * (hueVsLumLut[hIdx] / 100);

    // 4. Lum vs Saturation multiplier
    newS = newS * (lumVsSatLut[lIdx] / 128);

    // 5. Sat vs Saturation mapping
    newS = (satVsSatLut[Math.round(Math.max(0, Math.min(255, newS * 255)))] / 255);

    newS = Math.max(0, Math.min(1, newS));
    newL = Math.max(0, Math.min(1, newL));

    const [nr, ng, nb] = hslToRgb(newH, newS, newL);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/**
 * Applies HSL adjustments to a full-size canvas at export time.
 * Returns the same canvas (mutated in-place).
 */
export function applyHslToCanvas(
  canvas: HTMLCanvasElement,
  hsl: HslAdjustments,
): HTMLCanvasElement {
  const activeBands = (Object.keys(hsl) as HslBand[]).filter(band => {
    const b = hsl[band];
    return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
  });
  if (activeBands.length === 0) return canvas;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyHslToImageData(imageData, hsl);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
