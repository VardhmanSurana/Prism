/**
 * facialRetouch.ts
 * Single face pixel retouching operations (Skin, Eyes, Teeth, Lips, Eyebrows).
 */

import { SingleFaceAdjustments } from '../filterEngine';
import { rgbToHsl, hslToRgb } from '../utils/colorUtils';
import { SingleFaceMasks } from './types';
import { sampleMask } from './maskBuffer';
import { createMaskBoundedLowFrequencyBuffer } from './frequencySeparation';

/**
 * Applies retouching operations for a single face to the target ImageData.
 */
export function applySingleFaceToImageData(
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
            newH = newH - (newH - 24) * 0.65 * rtWeight;
          } else if (newH >= 180 && newH < 330) {
            newH = (newH + (360 - newH + 22) * 0.5 * rtWeight) % 360;
          } else if (newH < 12) {
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

        if (eyeWhitening > 0 && l > 0.4) {
          const w = eMask * (eyeWhitening / 100);
          newS = Math.max(0, s * (1 - 0.75 * w));
          newL = Math.min(1, l + 0.18 * w * (1 - l));
        }

        if (eyeEnhance > 0) {
          const ew = eMask * (eyeEnhance / 100);
          if (newL > 0.45) {
            newL = Math.min(1, newL + 0.16 * ew);
          } else {
            newL = Math.max(0, newL - 0.12 * ew);
          }
          newS = Math.min(1, newS * (1 + 0.28 * ew));
        }

        if (eyeCatchlight > 0 && l > 0.65) {
          const cw = eMask * (eyeCatchlight / 100);
          const sparkleBoost = (l - 0.65) / 0.35;
          newL = Math.min(1, newL + 0.3 * cw * sparkleBoost);
          newS = Math.max(0, newS * (1 - 0.5 * cw));
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

        let newS = s;
        if (h >= 20 && h <= 65) {
          newS = Math.max(0, s * (1 - 0.85 * tw));
        } else {
          newS = Math.max(0, s * (1 - 0.4 * tw));
        }

        const newL = Math.min(1, l + 0.22 * tw * (1 - l));
        const [nr, ng, nb] = hslToRgb(h, newS, newL);

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

