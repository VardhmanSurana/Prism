/**
 * filterFallback.ts
 * CPU-based fallback implementation of CSS canvas filters for environments
 * that do not support CanvasRenderingContext2D.filter (like WebKit / Tauri on Linux).
 */

import { Adjustments } from './filterEngine';

let isFilterSupportedCache: boolean | null = null;

/**
 * Checks if the browser's 2D canvas context supports the `.filter` property.
 */
export function isCtxFilterSupported(): boolean {
  if (isFilterSupportedCache !== null) return isFilterSupportedCache;
  if (typeof document === 'undefined') {
    isFilterSupportedCache = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isFilterSupportedCache = false;
      return false;
    }
    isFilterSupportedCache = 'filter' in ctx;
    return isFilterSupportedCache;
  } catch {
    isFilterSupportedCache = false;
    return false;
  }
}

/**
 * Helper to clamp values between 0 and 255.
 */
function clamp(val: number): number {
  return Math.min(255, Math.max(0, val));
}

/**
 * Applies CSS-equivalent filters (brightness, contrast, saturate, hue-rotate)
 * directly to the pixel data of an ImageData object.
 */
export function applyBaseFiltersToImageData(
  imageData: ImageData,
  adj: Adjustments
): void {
  const { data } = imageData;
  const len = data.length;

  // 1. Calculate factors (matching filterEngine.ts)
  const br = Math.max(0.05,
    1
    + adj.brightness  / 100 * 0.55
    + adj.exposure    / 100 * 0.50
    + adj.whites      / 100 * 0.15
    + adj.blacks      / 100 * 0.13
  );

  const ct = Math.max(0.05,
    1
    + adj.contrast  / 100 * 0.65
    - adj.blacks    / 100 * 0.22
    + adj.ambiance  / 100 * 0.42
    + (adj.clarity || 0)   / 100 * 0.38
  );

  const sat = Math.max(0,
    1
    + adj.saturation / 100 * 0.60
    + adj.vibrance   / 100 * 0.38
    + adj.ambiance   / 100 * 0.24
  );

  const hueRotDeg = adj.hue + adj.temperature * 0.65;
  const hasHueRot = Math.abs(hueRotDeg % 360) > 0.01;

  // 2. Precompute hue-rotate matrix coefficients if needed
  let m00 = 1, m01 = 0, m02 = 0;
  let m10 = 0, m11 = 1, m12 = 0;
  let m20 = 0, m21 = 0, m22 = 1;

  if (hasHueRot) {
    const angle = (hueRotDeg % 360) * Math.PI / 180;
    const cosVal = Math.cos(angle);
    const sinVal = Math.sin(angle);

    m00 = 0.213 + cosVal * 0.787 - sinVal * 0.213;
    m01 = 0.715 - cosVal * 0.715 - sinVal * 0.715;
    m02 = 0.072 - cosVal * 0.072 + sinVal * 0.928;

    m10 = 0.213 - cosVal * 0.213 + sinVal * 0.143;
    m11 = 0.715 + cosVal * 0.285 + sinVal * 0.140;
    m12 = 0.072 - cosVal * 0.072 - sinVal * 0.283;

    m20 = 0.213 - cosVal * 0.213 - sinVal * 0.787;
    m21 = 0.715 - cosVal * 0.715 + sinVal * 0.715;
    m22 = 0.072 + cosVal * 0.928 + sinVal * 0.072;
  }

  // 3. Fast pixel-processing loop
  // Order of operations matching CSS: Brightness -> Contrast -> Saturate -> HueRotate
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // A. Brightness
    r = r * br;
    g = g * br;
    b = b * br;

    // B. Contrast (centered at 128)
    r = (r - 128) * ct + 128;
    g = (g - 128) * ct + 128;
    b = (b - 128) * ct + 128;

    // C. Saturate (luminance weights: 0.2126, 0.7152, 0.0722)
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * sat;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat;

    // D. HueRotate
    if (hasHueRot) {
      const rx = r * m00 + g * m01 + b * m02;
      const gx = r * m10 + g * m11 + b * m12;
      const bx = r * m20 + g * m21 + b * m22;
      r = rx;
      g = gx;
      b = bx;
    }

    data[i]     = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
}

/**
 * Applies a 1-pass horizontal box blur from src to dest.
 */
function boxBlurH(
  src: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  w: number,
  h: number,
  r: number
): void {
  const arr = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    // Init window
    for (let x = -r; x <= r; x++) {
      const ix = Math.min(w - 1, Math.max(0, x));
      const idx = rowOffset + ix * 4;
      sumR += src[idx];
      sumG += src[idx + 1];
      sumB += src[idx + 2];
      sumA += src[idx + 3];
    }

    for (let x = 0; x < w; x++) {
      const destIdx = rowOffset + x * 4;
      dest[destIdx]     = sumR / arr;
      dest[destIdx + 1] = sumG / arr;
      dest[destIdx + 2] = sumB / arr;
      dest[destIdx + 3] = sumA / arr;

      // Slide window
      const nextX = Math.min(w - 1, x + r + 1);
      const prevX = Math.max(0, x - r);
      const nextIdx = rowOffset + nextX * 4;
      const prevIdx = rowOffset + prevX * 4;

      sumR += src[nextIdx]     - src[prevIdx];
      sumG += src[nextIdx + 1] - src[prevIdx + 1];
      sumB += src[nextIdx + 2] - src[prevIdx + 2];
      sumA += src[nextIdx + 3] - src[prevIdx + 3];
    }
  }
}

/**
 * Applies a 1-pass vertical box blur from src to dest.
 */
function boxBlurV(
  src: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  w: number,
  h: number,
  r: number
): void {
  const arr = 2 * r + 1;
  const stride = w * 4;

  for (let x = 0; x < w; x++) {
    const colOffset = x * 4;
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    // Init window
    for (let y = -r; y <= r; y++) {
      const iy = Math.min(h - 1, Math.max(0, y));
      const idx = iy * stride + colOffset;
      sumR += src[idx];
      sumG += src[idx + 1];
      sumB += src[idx + 2];
      sumA += src[idx + 3];
    }

    for (let y = 0; y < h; y++) {
      const destIdx = y * stride + colOffset;
      dest[destIdx]     = sumR / arr;
      dest[destIdx + 1] = sumG / arr;
      dest[destIdx + 2] = sumB / arr;
      dest[destIdx + 3] = sumA / arr;

      // Slide window
      const nextY = Math.min(h - 1, y + r + 1);
      const prevY = Math.max(0, y - r);
      const nextIdx = nextY * stride + colOffset;
      const prevIdx = prevY * stride + colOffset;

      sumR += src[nextIdx]     - src[prevIdx];
      sumG += src[nextIdx + 1] - src[prevIdx + 1];
      sumB += src[nextIdx + 2] - src[prevIdx + 2];
      sumA += src[nextIdx + 3] - src[prevIdx + 3];
    }
  }
}

/**
 * JS/CPU Fallback Box Blur implementation.
 * Runs 2 passes for a smoother result.
 */
export function applyBlurFallback(canvas: HTMLCanvasElement, radius: number): void {
  const rad = Math.round(radius);
  if (rad <= 0) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const temp = new Uint8ClampedArray(data.length);

  // Pass 1: blur horizontally and vertically
  boxBlurH(data, temp, w, h, rad);
  boxBlurV(temp, data, w, h, rad);

  // Pass 2: additional pass for smoother blur
  boxBlurH(data, temp, w, h, rad);
  boxBlurV(temp, data, w, h, rad);

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Applies non-linear highlights recovery and shadows boost to ImageData in-place.
 */
export function applyNonLinearHighlightsAndShadows(
  imageData: ImageData,
  highlightsVal: number, // -100 to 100
  shadowsVal: number    // -100 to 100
): void {
  if (highlightsVal === 0 && shadowsVal === 0) return;

  const { data } = imageData;
  const len = data.length;

  const h = highlightsVal / 100;
  const s = shadowsVal / 100;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Compute relative luminance (standard sRGB weights)
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Highlight weight is proportional to luminance squared (targeting bright areas)
    const wh = y * y;
    // Shadow weight is proportional to inverted luminance squared (targeting dark areas)
    const ws = (1 - y) * (1 - y);

    // Apply adjustments channel-by-channel
    for (let c = 0; c < 3; c++) {
      const val = data[i + c] / 255;
      let newVal = val;

      // Highlights
      if (h !== 0) {
        if (h > 0) {
          // Brighten highlights: interpolate towards 1 (white)
          newVal = newVal + (1 - newVal) * h * wh * 0.45;
        } else {
          // Recover highlights: interpolate towards 0 (darker)
          newVal = newVal + newVal * h * wh * 0.45;
        }
      }

      // Shadows
      if (s !== 0) {
        if (s > 0) {
          // Boost shadows: interpolate towards 1 (lighter)
          newVal = newVal + (1 - newVal) * s * ws * 0.45;
        } else {
          // Crush shadows: interpolate towards 0 (darker)
          newVal = newVal + newVal * s * ws * 0.45;
        }
      }

      data[i + c] = clamp(newVal * 255);
    }
  }
}
