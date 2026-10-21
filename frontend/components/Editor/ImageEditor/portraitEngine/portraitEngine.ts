/**
 * portraitEngine.ts
 * Multi-face AI portrait retouching pipeline orchestrator.
 */

import { PortraitAdjustments, SingleFaceAdjustments } from '../filterEngine';
import { LoadedPortraitMasks } from './types';
import { applySingleFaceToImageData } from './facialRetouch';

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

