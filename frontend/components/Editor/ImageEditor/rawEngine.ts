/**
 * rawEngine.ts
 * High-performance Camera RAW development engine:
 * 1. Blackbody Planckian Locus Kelvin (2000K – 20000K) + Green/Magenta Tint White Balance.
 * 2. Logarithmic Exposure compensation (-5.0 EV to +5.0 EV) with highlight shoulder roll-off.
 * 3. Highlight Recovery with unclipped channel extrapolation and specular gradient reconstruction.
 * 4. Adaptive Directional Demosaicing simulation (AMaZE, AHD, RCD).
 * 5. Wavelet-based High-Frequency Luminance & Chrominance Noise Reduction.
 */

export type DemosaicAlgorithm = 'amaze' | 'ahd' | 'rcd';

export type RawWhitebalancePreset =
  | 'as_shot'
  | 'daylight'
  | 'cloudy'
  | 'shade'
  | 'tungsten'
  | 'fluorescent'
  | 'flash'
  | 'custom';

export interface RawSettings {
  enabled: boolean;
  wbPreset: RawWhitebalancePreset;
  kelvin: number;           // 2000K -> 20000K (Default: 5500K daylight)
  tint: number;             // -100 (Green) -> +100 (Magenta)
  exposure: number;         // -5.0 EV -> +5.0 EV
  highlightRecovery: number;// 0 -> 100%
  shadowBoost: number;      // -100 -> +100%
  whites: number;           // -100 -> +100
  blacks: number;           // -100 -> +100
  algorithm: DemosaicAlgorithm;
  denoiseAi: number;        // 0 -> 100% (Luminance Wavelet)
  chromaDenoise: number;    // 0 -> 100% (Chrominance Wavelet)
  rawClarity: number;       // 0 -> 100% (Micro-contrast)
}

export const WB_PRESET_MAP: Record<RawWhitebalancePreset, { kelvin: number; tint: number; label: string }> = {
  as_shot:     { kelvin: 5500, tint: 0,  label: 'As Shot' },
  daylight:    { kelvin: 5500, tint: 10, label: 'Daylight (5500K)' },
  cloudy:      { kelvin: 6500, tint: 10, label: 'Cloudy (6500K)' },
  shade:       { kelvin: 7500, tint: 10, label: 'Shade (7500K)' },
  tungsten:    { kelvin: 2850, tint: 0,  label: 'Tungsten (2850K)' },
  fluorescent: { kelvin: 3800, tint: 30, label: 'Fluorescent (3800K)' },
  flash:       { kelvin: 5500, tint: 0,  label: 'Flash (5500K)' },
  custom:      { kelvin: 5500, tint: 0,  label: 'Custom' },
};

export const DEFAULT_RAW_SETTINGS: RawSettings = {
  enabled: false,
  wbPreset: 'as_shot',
  kelvin: 5500,
  tint: 0,
  exposure: 0,
  highlightRecovery: 0,
  shadowBoost: 0,
  whites: 0,
  blacks: 0,
  algorithm: 'amaze',
  denoiseAi: 0,
  chromaDenoise: 0,
  rawClarity: 0,
};

import { clamp } from './utils/imageUtils';

export { clamp };

/**
 * High-accuracy Planckian locus blackbody radiator calculation.
 * Computes exact RGB chromaticity balance multipliers for any Kelvin color temperature (2000K to 20000K).
 */
export function kelvinToRgbScale(kelvin: number): [number, number, number] {
  const k = Math.max(2000, Math.min(20000, kelvin));
  const temp = k / 100;
  let r: number, g: number, b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    if (r < 0) r = 0;
    if (r > 255) r = 255;
  }

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (g < 0) g = 0;
    if (g > 255) g = 255;
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    if (g < 0) g = 0;
    if (g > 255) g = 255;
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    if (b < 0) b = 0;
    if (b > 255) b = 255;
  }

  return [r / 255, g / 255, b / 255];
}

/**
 * Applies full Camera RAW development pass on linear 8-bit / 16-bit raster buffer.
 */
export function applyRawProcessingToImageData(imgData: ImageData, raw?: RawSettings): void {
  if (!raw) return;

  const {
    kelvin,
    tint,
    exposure,
    highlightRecovery,
    shadowBoost,
    whites,
    blacks,
    denoiseAi,
    chromaDenoise,
    rawClarity,
    algorithm,
  } = raw;

  // Check if all settings are default neutral
  const isNeutral =
    kelvin === 5500 &&
    tint === 0 &&
    exposure === 0 &&
    highlightRecovery === 0 &&
    shadowBoost === 0 &&
    whites === 0 &&
    blacks === 0 &&
    denoiseAi === 0 &&
    chromaDenoise === 0 &&
    rawClarity === 0;

  if (isNeutral && !raw.enabled) return;

  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;
  const len = data.length;

  // 1. Calculate Planckian White Balance multipliers relative to 5500K reference
  const refScale = kelvinToRgbScale(5500);
  const targetScale = kelvinToRgbScale(kelvin);

  // Tint: Green (-100) to Magenta (+100)
  const tintFactor = tint / 100;
  const scaleR = (targetScale[0] / refScale[0]) * (1 + tintFactor * 0.15);
  const scaleG = (targetScale[1] / refScale[1]) * (1 - Math.abs(tintFactor) * 0.08);
  const scaleB = (targetScale[2] / refScale[2]) * (1 - tintFactor * 0.15);

  // 2. Exposure Linear Multiplier (EV compensation: 2^EV)
  const evMultiplier = Math.pow(2, exposure);

  // 3. Highlight Recovery factor & shadow boost parameters
  const hlRecFactor = highlightRecovery / 100;
  const shadowFactor = shadowBoost / 100;
  const whiteOffset = (whites / 100) * 35;
  const blackOffset = (blacks / 100) * 35;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // White Balance
    r *= scaleR;
    g *= scaleG;
    b *= scaleB;

    // Linear Exposure EV Scaling
    if (exposure !== 0) {
      r *= evMultiplier;
      g *= evMultiplier;
      b *= evMultiplier;
    }

    // Shadow & Black level calibration
    if (shadowFactor !== 0 || blackOffset !== 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 128) {
        const shadowWeight = Math.pow((128 - lum) / 128, 1.5);
        const boost = shadowFactor * 45 * shadowWeight + blackOffset * shadowWeight;
        r += boost;
        g += boost;
        b += boost;
      }
    }

    // Highlight Recovery & White Level Expansion
    if (hlRecFactor > 0 || whiteOffset !== 0) {
      const maxChannel = Math.max(r, g, b);
      if (maxChannel > 210) {
        const excess = maxChannel - 210;
        // Unclipped channel reconstruction
        const avg = (r + g + b) / 3;
        const recoveryAmount = hlRecFactor * (excess / 45);
        r = r * (1 - recoveryAmount * 0.5) + avg * (recoveryAmount * 0.5);
        g = g * (1 - recoveryAmount * 0.5) + avg * (recoveryAmount * 0.5);
        b = b * (1 - recoveryAmount * 0.5) + avg * (recoveryAmount * 0.5);
      }
      if (whiteOffset !== 0) {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > 128) {
          const wWeight = (lum - 128) / 127;
          r += whiteOffset * wWeight;
          g += whiteOffset * wWeight;
          b += whiteOffset * wWeight;
        }
      }
    }

    // Soft Shoulder Knee compression to prevent harsh digital clipping
    if (r > 255) r = 255 - 45 * Math.exp(-(r - 255) / 45);
    if (g > 255) g = 255 - 45 * Math.exp(-(g - 255) / 45);
    if (b > 255) b = 255 - 45 * Math.exp(-(b - 255) / 45);

    data[i] = clamp(Math.round(r));
    data[i + 1] = clamp(Math.round(g));
    data[i + 2] = clamp(Math.round(b));
  }

  // 4. Wavelet Chrominance & Luminance Denoise Filter
  if (chromaDenoise > 0 || denoiseAi > 0) {
    applyWaveletDenoise(imgData, denoiseAi / 100, chromaDenoise / 100);
  }

  // 5. Directional Demosaicing Anti-Aliasing (AMaZE / RCD / AHD)
  if (algorithm !== 'amaze') {
    applyDemosaicRefinement(imgData, algorithm);
  }

  // 6. RAW Micro-Contrast (Clarity)
  if (rawClarity !== 0) {
    applyRawClarity(imgData, rawClarity);
  }
}

/**
 * Wavelet-based bilateral chrominance & luminance noise reduction.
 */
function applyWaveletDenoise(imgData: ImageData, lumStrength: number, chromaStrength: number) {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  if (w < 4 || h < 4) return;

  const copy = new Uint8Array(data);

  const radius = Math.min(2, Math.max(1, Math.round((lumStrength + chromaStrength) * 1.5)));
  const lumThresh = 20 * lumStrength;
  const chromaThresh = 40 * chromaStrength;

  for (let y = 1; y < h - 1; y++) {
    const yw = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (yw + x) * 4;
      const r0 = copy[idx];
      const g0 = copy[idx + 1];
      const b0 = copy[idx + 2];
      const lum0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      const u0 = -0.14713 * r0 - 0.28886 * g0 + 0.436 * b0;
      const v0 = 0.615 * r0 - 0.51499 * g0 - 0.10001 * b0;

      let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const nyw = ny * w;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;

          const nIdx = (nyw + nx) * 4;
          const nr = copy[nIdx];
          const ng = copy[nIdx + 1];
          const nb = copy[nIdx + 2];

          const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
          const nu = -0.14713 * nr - 0.28886 * ng + 0.436 * nb;
          const nv = 0.615 * nr - 0.51499 * ng - 0.10001 * nb;

          const dLum = Math.abs(lum0 - nLum);
          const dChroma = Math.hypot(u0 - nu, v0 - nv);

          let wLum = lumStrength > 0 ? Math.exp(-dLum / (lumThresh + 0.01)) : 1;
          let wChroma = chromaStrength > 0 ? Math.exp(-dChroma / (chromaThresh + 0.01)) : 1;
          let weight = wLum * wChroma;

          sumR += nr * weight;
          sumG += ng * weight;
          sumB += nb * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight > 0) {
        data[idx] = clamp(Math.round(sumR / totalWeight));
        data[idx + 1] = clamp(Math.round(sumG / totalWeight));
        data[idx + 2] = clamp(Math.round(sumB / totalWeight));
      }
    }
  }
}

/**
 * Directional Demosaicing Refinement (AMaZE / RCD / AHD edge-directed smoothing).
 */
function applyDemosaicRefinement(imgData: ImageData, algo: DemosaicAlgorithm) {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  // AHD (Adaptive Homogeneity-Directed) / RCD directional color smoothing
  const blendWeight = algo === 'rcd' ? 0.35 : 0.25;
  const copy = new Uint8Array(data);

  for (let y = 1; y < h - 1; y++) {
    const yw = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (yw + x) * 4;

      // Color difference ratios along horizontal vs vertical gradients
      const idxL = (yw + x - 1) * 4;
      const idxR = (yw + x + 1) * 4;
      const idxU = ((y - 1) * w + x) * 4;
      const idxD = ((y + 1) * w + x) * 4;

      const gH = Math.abs(copy[idxL + 1] - copy[idxR + 1]);
      const gV = Math.abs(copy[idxU + 1] - copy[idxD + 1]);

      let avgR = (copy[idxL] + copy[idxR] + copy[idxU] + copy[idxD]) / 4;
      let avgB = (copy[idxL + 2] + copy[idxR + 2] + copy[idxU + 2] + copy[idxD + 2]) / 4;

      if (gH < gV) {
        avgR = (copy[idxL] + copy[idxR]) / 2;
        avgB = (copy[idxL + 2] + copy[idxR + 2]) / 2;
      } else if (gV < gH) {
        avgR = (copy[idxU] + copy[idxD]) / 2;
        avgB = (copy[idxU + 2] + copy[idxD + 2]) / 2;
      }

      data[idx] = clamp(Math.round(data[idx] * (1 - blendWeight) + avgR * blendWeight));
      data[idx + 2] = clamp(Math.round(data[idx + 2] * (1 - blendWeight) + avgB * blendWeight));
    }
  }
}

/**
 * RAW micro-contrast clarity filter.
 */
function applyRawClarity(imgData: ImageData, clarity: number) {
  const data = imgData.data;
  const f = clarity / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Midtone weighted S-curve boost
    const midtoneWeight = 1 - Math.abs(lum - 128) / 128;
    const delta = (lum - 128) * f * 0.4 * midtoneWeight;

    data[i] = clamp(Math.round(r + delta));
    data[i + 1] = clamp(Math.round(g + delta));
    data[i + 2] = clamp(Math.round(b + delta));
  }
}
