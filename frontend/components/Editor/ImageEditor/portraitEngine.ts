/**
 * portraitEngine.ts
 * High-performance, pixel-level AI portrait retouching engine:
 * - True Frequency Separation (Pore-Preserving Skin Smoothing & Texture Reconstruction)
 * - Google Pixel-style Real Tone Skin Calibration (Ambient Lighting & Undertone Neutralization)
 * - Specular Pupil Catchlight Sparkle & Iris Luminescence
 * - Yellow-Cast Enamel Teeth Whitening
 * - Natural Lip Hue Steering & Micro-Vibrance
 * - Eyebrow Arch Depth & Hair Toning
 * - Multi-face & Single-face Targeted Isolation
 */

import { PortraitAdjustments, SingleFaceAdjustments } from './filterEngine';
import { rgbToHsl, hslToRgb } from './hslEngine';

export interface MaskBuffer {
  width: number;
  height: number;
  data: Uint8Array;
}

// Global cache for loaded mask buffers by URL
const maskBufferCache = new Map<string, MaskBuffer>();

export function clearMaskBufferCache(): void {
  maskBufferCache.clear();
}

export async function loadMaskBuffer(maskUrl: string): Promise<MaskBuffer | null> {
  if (!maskUrl) return null;

  const cached = maskBufferCache.get(maskUrl);
  if (cached) {
    return cached;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 512;
        const h = img.naturalHeight || 512;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = new Uint8Array(w * h);

        // Extract grayscale mask intensity (0-255)
        for (let i = 0; i < data.length; i++) {
          const r = imgData.data[i * 4];
          const a = imgData.data[i * 4 + 3];
          data[i] = a === 0 ? 0 : r;
        }

        const buffer: MaskBuffer = { width: w, height: h, data };
        maskBufferCache.set(maskUrl, buffer);
        resolve(buffer);
      } catch (err) {
        console.warn('Failed to extract mask buffer:', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = maskUrl;
  });
}

export interface SingleFaceMasks {
  skin?: MaskBuffer | null;
  eyes?: MaskBuffer | null;
  lips?: MaskBuffer | null;
  teeth?: MaskBuffer | null;
  eyebrows?: MaskBuffer | null;
}

export type LoadedPortraitMasks = SingleFaceMasks & {
  faces?: Record<string, SingleFaceMasks>;
};

function sampleMask(mask: MaskBuffer | null | undefined, u: number, v: number): number {
  if (!mask) return 0;
  const mx = Math.max(0, Math.min(mask.width - 1, Math.floor(u * mask.width)));
  const my = Math.max(0, Math.min(mask.height - 1, Math.floor(v * mask.height)));
  return mask.data[my * mask.width + mx] || 0;
}

/**
 * Mask-bounded, edge-preserving separable blur for Low Frequency tone layer.
 * Weights samples by skin mask to completely prevent dark beard/hair bleeding into skin.
 */
function createMaskBoundedLowFrequencyBuffer(
  imageData: ImageData,
  skinBuf: MaskBuffer,
  radius: number
): Uint8ClampedArray {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const r = Math.max(2, Math.min(25, Math.round(radius)));

  const tempR = new Float32Array(width * height);
  const tempG = new Float32Array(width * height);
  const tempB = new Float32Array(width * height);

  // Fast horizontal pass
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const maskVal = sampleMask(skinBuf, u, v);
      const idx = rowOffset + x;
      const pIdx = idx * 4;

      if (maskVal === 0) {
        tempR[idx] = data[pIdx];
        tempG[idx] = data[pIdx + 1];
        tempB[idx] = data[pIdx + 2];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const startX = Math.max(0, x - r);
      const endX = Math.min(width - 1, x + r);

      for (let kx = startX; kx <= endX; kx++) {
        const ku = (kx + 0.5) / width;
        const kMask = sampleMask(skinBuf, ku, v);
        const weight = (kMask / 255) + 0.08;

        const kIdx = (rowOffset + kx) * 4;
        rSum += data[kIdx] * weight;
        gSum += data[kIdx + 1] * weight;
        bSum += data[kIdx + 2] * weight;
        wSum += weight;
      }

      tempR[idx] = wSum > 0 ? rSum / wSum : data[pIdx];
      tempG[idx] = wSum > 0 ? gSum / wSum : data[pIdx + 1];
      tempB[idx] = wSum > 0 ? bSum / wSum : data[pIdx + 2];
    }
  }

  // Fast vertical pass
  for (let x = 0; x < width; x++) {
    const u = (x + 0.5) / width;
    for (let y = 0; y < height; y++) {
      const v = (y + 0.5) / height;
      const maskVal = sampleMask(skinBuf, u, v);
      const idx = y * width + x;
      const pIdx = idx * 4;

      if (maskVal === 0) {
        output[pIdx] = data[pIdx];
        output[pIdx + 1] = data[pIdx + 1];
        output[pIdx + 2] = data[pIdx + 2];
        output[pIdx + 3] = data[pIdx + 3];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const startY = Math.max(0, y - r);
      const endY = Math.min(height - 1, y + r);

      for (let ky = startY; ky <= endY; ky++) {
        const kv = (ky + 0.5) / height;
        const kMask = sampleMask(skinBuf, u, kv);
        const weight = (kMask / 255) + 0.08;

        const kIdx = ky * width + x;
        rSum += tempR[kIdx] * weight;
        gSum += tempG[kIdx] * weight;
        bSum += tempB[kIdx] * weight;
        wSum += weight;
      }

      output[pIdx] = Math.round(wSum > 0 ? rSum / wSum : tempR[idx]);
      output[pIdx + 1] = Math.round(wSum > 0 ? gSum / wSum : tempG[idx]);
      output[pIdx + 2] = Math.round(wSum > 0 ? bSum / wSum : tempB[idx]);
      output[pIdx + 3] = data[pIdx + 3];
    }
  }

  return output;
}

/**
 * Applies retouching operations for a single face to the target ImageData.
 */
function applySingleFaceToImageData(
  imageData: ImageData,
  faceAdj: SingleFaceAdjustments,
  masks: SingleFaceMasks
): void {
  const { width, height, data } = imageData;

  const {
    skinSmoothing = 0,
    skinTexture = 75,
    skinBrightness = 0,
    skinWarmth = 0,
    skinTone = 0,
    realTone = 0,
    eyeWhitening = 0,
    eyeEnhance = 0,
    eyeCatchlight = 0,
    teethWhitening = 0,
    lipVibrance = 0,
    eyebrowEnhance = 0,
  } = faceAdj;

  const hasSkinAdj =
    (skinSmoothing > 0 ||
      skinTexture !== 75 ||
      skinBrightness !== 0 ||
      skinWarmth !== 0 ||
      skinTone !== 0 ||
      realTone > 0) &&
    !!masks.skin;

  const hasEyeAdj =
    (eyeWhitening > 0 || eyeEnhance > 0 || eyeCatchlight > 0) && !!masks.eyes;
  const hasTeethAdj = teethWhitening > 0 && !!masks.teeth;
  const hasLipAdj = lipVibrance !== 0 && !!masks.lips;
  const hasBrowAdj = eyebrowEnhance > 0 && !!masks.eyebrows;

  if (!hasSkinAdj && !hasEyeAdj && !hasTeethAdj && !hasLipAdj && !hasBrowAdj) {
    return;
  }

  const skinBuf = masks.skin;
  const eyeBuf = masks.eyes;
  const teethBuf = masks.teeth;
  const lipBuf = masks.lips;
  const browBuf = masks.eyebrows;

  // ── 1. Precompute Frequency Separation Low-Frequency Tone Layer ──
  let lowFreqData: Uint8ClampedArray | null = null;
  if ((skinSmoothing > 0 || skinTexture !== 75) && skinBuf) {
    // Dynamic radius scaled by smoothing amount
    const blurRadius = 3.0 + (skinSmoothing / 100) * 12.0;
    lowFreqData = createMaskBoundedLowFrequencyBuffer(imageData, skinBuf, blurRadius);
  }

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const offset = (y * width + x) * 4;

      let r = data[offset];
      let g = data[offset + 1];
      let b = data[offset + 2];

      const sVal = sampleMask(skinBuf, u, v);
      const eVal = sampleMask(eyeBuf, u, v);
      const tVal = sampleMask(teethBuf, u, v);
      const lVal = sampleMask(lipBuf, u, v);
      const bVal = sampleMask(browBuf, u, v);

      // ── A. Skin: Frequency Separation & Real Tone ──────────────────────────
      if (sVal > 0) {
        const sMask = sVal / 255;

        // 1. Frequency Separation (Tone Smoothing + Independent Pore Texture Control)
        if (lowFreqData && (skinSmoothing > 0 || skinTexture !== 75)) {
          const sWeight = sMask * (skinSmoothing / 100);

          const lfR = lowFreqData[offset];
          const lfG = lowFreqData[offset + 1];
          const lfB = lowFreqData[offset + 2];

          // High Frequency (Pore micro-texture & fine lines)
          const hfR = r - lfR;
          const hfG = g - lfG;
          const hfB = b - lfB;

          // Texture Gain:
          // 0% -> 0.0 (Pure porcelain airbrush blur / zero pores)
          // 75% -> 1.0 (Exact 100% natural authentic pores)
          // 100% -> 1.8 (High-pass micro-contrast clarity boost on pores)
          const texGain = skinTexture <= 75
            ? skinTexture / 75.0
            : 1.0 + ((skinTexture - 75) / 25.0) * 0.8;

          // Smoothed Low-Frequency Tone Base (diffuses blotchiness, redness, uneven tone)
          const toneR = r * (1 - sWeight) + lfR * sWeight;
          const toneG = g * (1 - sWeight) + lfG * sWeight;
          const toneB = b * (1 - sWeight) + lfB * sWeight;

          // Recombine tone base with modulated pore texture
          // When texGain = 1.0 (75%), retains 100% natural pores on top of smoothed tone
          // When texGain < 1.0 (<75%), smooths away pores towards airbrushed porcelain
          // When texGain > 1.0 (>75%), sharpens and enhances pore micro-contrast
          const finalR = toneR + hfR * (texGain - (1 - sWeight)) * sMask;
          const finalG = toneG + hfG * (texGain - (1 - sWeight)) * sMask;
          const finalB = toneB + hfB * (texGain - (1 - sWeight)) * sMask;

          r = Math.max(0, Math.min(255, Math.round(finalR)));
          g = Math.max(0, Math.min(255, Math.round(finalG)));
          b = Math.max(0, Math.min(255, Math.round(finalB)));
        }

        // 2. Real Tone Color & Lighting Calibration (Google Pixel Style)
        if (realTone > 0) {
          const rtWeight = sMask * (realTone / 100);
          const [h, s, l] = rgbToHsl(r, g, b);

          // Exposure lift for underexposed facial shadows
          let newL = l;
          if (l < 0.85) {
            newL = Math.min(1, l + 0.15 * rtWeight * (1 - l) * (l + 0.25));
          }

          // Chrominance balance: Steer towards healthy golden-peach skin locus (Hue ~ 22deg)
          let newH = h;
          let newS = s;

          if (newH > 35 && newH < 180) {
            // Cool greenish/sallow cast -> steer towards warm peach
            newH = newH - (newH - 24) * 0.65 * rtWeight;
          } else if (newH >= 180 && newH < 330) {
            // Cool purple/blue shadow cast -> warm up
            newH = (newH + (360 - newH + 22) * 0.5 * rtWeight) % 360;
          } else if (newH < 12) {
            // Harsh sunburn redness -> soothe towards natural peach
            newH = newH + (22 - newH) * 0.5 * rtWeight;
          }

          // Enrich pale/ashy skin with healthy warm vibrance
          if (newS < 0.55) {
            newS = Math.min(1, newS + 0.18 * rtWeight * (1 - newS));
          }

          const [nr, ng, nb] = hslToRgb(newH, newS, newL);
          r = Math.max(0, Math.min(255, Math.round(nr + rtWeight * 8)));
          g = Math.max(0, Math.min(255, Math.round(ng + rtWeight * 4)));
          b = Math.max(0, Math.min(255, Math.round(nb - rtWeight * 4)));
        }

        // 3. Skin Tone, Brightness & Golden Radiance Warmth
        if (skinBrightness !== 0 || skinWarmth !== 0 || skinTone !== 0) {
          const brDelta = (skinBrightness / 50) * 50 * sMask;
          const warmDelta = (skinWarmth / 50) * 38 * sMask;
          const toneDelta = (skinTone / 50) * 25 * sMask;

          // Warmth adds flattering golden warmth (boosts R, slight G, cools B)
          r = Math.max(0, Math.min(255, r + brDelta + warmDelta * 1.1 + toneDelta * 0.6));
          g = Math.max(0, Math.min(255, g + brDelta + warmDelta * 0.3 - toneDelta * 0.4));
          b = Math.max(0, Math.min(255, b + brDelta - warmDelta * 0.8));
        }
      }

      // ── B. Eyes: Whitening, Iris Clarity & Specular Catchlight ────────────
      if (eVal > 0 && (eyeWhitening > 0 || eyeEnhance > 0 || eyeCatchlight > 0)) {
        const eMask = eVal / 255;
        const [h, s, l] = rgbToHsl(r, g, b);

        let newS = s;
        let newL = l;

        // Eye Whitening (neutralize redness/vascular yellowness in sclera)
        if (eyeWhitening > 0 && l > 0.4) {
          const w = eMask * (eyeWhitening / 100);
          newS = Math.max(0, s * (1 - 0.75 * w));
          newL = Math.min(1, l + 0.18 * w * (1 - l));
        }

        // Eye Enhance (boost iris clarity, contrast, and depth)
        if (eyeEnhance > 0) {
          const ew = eMask * (eyeEnhance / 100);
          if (newL > 0.45) {
            newL = Math.min(1, newL + 0.16 * ew);
          } else {
            newL = Math.max(0, newL - 0.12 * ew);
          }
          newS = Math.min(1, newS * (1 + 0.28 * ew));
        }

        // Specular Catchlight Sparkle (boost highest pupil reflections)
        if (eyeCatchlight > 0 && l > 0.65) {
          const cw = eMask * (eyeCatchlight / 100);
          const sparkleBoost = (l - 0.65) / 0.35; // Exponential lift for specular highlights
          newL = Math.min(1, newL + 0.3 * cw * sparkleBoost);
          newS = Math.max(0, newS * (1 - 0.5 * cw)); // Clean white specular reflection
        }

        const [nr, ng, nb] = hslToRgb(h, newS, newL);
        r = nr;
        g = ng;
        b = nb;
      }

      // ── C. Teeth: Enamel Whitening & Yellow Cast Removal ──────────────────
      if (tVal > 0 && teethWhitening > 0) {
        const tMask = tVal / 255;
        const tw = tMask * (teethWhitening / 100);
        const [h, s, l] = rgbToHsl(r, g, b);

        // Desaturate warm yellow/orange tooth enamel cast
        let newS = s;
        if (h >= 20 && h <= 65) {
          newS = Math.max(0, s * (1 - 0.85 * tw));
        } else {
          newS = Math.max(0, s * (1 - 0.4 * tw));
        }

        const newL = Math.min(1, l + 0.22 * tw * (1 - l));
        const [nr, ng, nb] = hslToRgb(h, newS, newL);

        // Gentle subtle blue counter-balance for natural enamel pearl glow
        r = Math.max(0, Math.min(255, nr + tw * 12));
        g = Math.max(0, Math.min(255, ng + tw * 16));
        b = Math.max(0, Math.min(255, nb + tw * 24));
      }

      // ── D. Lips: Vibrance, Contour & Natural Color ────────────────────────
      if (lVal > 0 && lipVibrance !== 0) {
        const lMask = lVal / 255;
        const lw = lMask * (lipVibrance / 50);
        const [h, s, l] = rgbToHsl(r, g, b);

        let newH = h;
        // Steer lip hues towards flattering rose/ruby tones
        if (newH < 330 && newH > 30) {
          newH = newH > 180 ? 348 : 8;
        }

        const newS = Math.max(0, Math.min(1, lw > 0 ? s + lw * 0.35 * (1 - s) : s * (1 + lw * 0.5)));
        const newL = Math.max(0, Math.min(1, l + lw * 0.08 * (1 - l)));

        const [nr, ng, nb] = hslToRgb(newH, newS, newL);
        r = nr;
        g = ng;
        b = nb;
      }

      // ── E. Eyebrows: Arch Definition & Density ────────────────────────────
      if (bVal > 0 && eyebrowEnhance > 0) {
        const bMask = bVal / 255;
        const bw = bMask * (eyebrowEnhance / 100);
        r = Math.max(0, Math.round(r * (1 - 0.28 * bw)));
        g = Math.max(0, Math.round(g * (1 - 0.28 * bw)));
        b = Math.max(0, Math.round(b * (1 - 0.28 * bw)));
      }

      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
    }
  }
}

/**
 * Applies all AI portrait retouching operations to the target ImageData across all faces.
 */
export function applyPortraitToImageData(
  imageData: ImageData,
  portrait: PortraitAdjustments,
  masks: LoadedPortraitMasks
): void {
  // Multi-face processing
  if (masks.faces && Object.keys(masks.faces).length > 0) {
    const faceKeys = Object.keys(masks.faces);
    for (const fId of faceKeys) {
      const faceMasks = masks.faces[fId];
      if (!faceMasks) continue;

      const override = portrait.faces?.[fId];

      const effectiveAdj: SingleFaceAdjustments = {
        skinSmoothing: override?.skinSmoothing ?? portrait.skinSmoothing ?? 0,
        skinTexture: override?.skinTexture ?? portrait.skinTexture ?? 75,
        skinBrightness: override?.skinBrightness ?? portrait.skinBrightness ?? 0,
        skinWarmth: override?.skinWarmth ?? portrait.skinWarmth ?? 0,
        skinTone: override?.skinTone ?? portrait.skinTone ?? 0,
        realTone: override?.realTone ?? portrait.realTone ?? 0,
        eyeWhitening: override?.eyeWhitening ?? portrait.eyeWhitening ?? 0,
        eyeEnhance: override?.eyeEnhance ?? portrait.eyeEnhance ?? 0,
        eyeCatchlight: override?.eyeCatchlight ?? portrait.eyeCatchlight ?? 0,
        teethWhitening: override?.teethWhitening ?? portrait.teethWhitening ?? 0,
        lipVibrance: override?.lipVibrance ?? portrait.lipVibrance ?? 0,
        eyebrowEnhance: override?.eyebrowEnhance ?? portrait.eyebrowEnhance ?? 0,
      };

      applySingleFaceToImageData(imageData, effectiveAdj, faceMasks);
    }
    return;
  }

  // Single-face fallback
  applySingleFaceToImageData(imageData, portrait, masks);
}

