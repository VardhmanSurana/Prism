import { Adjustments } from './filterEngine';
import { Annotation } from './AnnotationsPanel';
import { applyHslToCanvas } from './hslEngine';
import { applyNonLinearHighlightsAndShadows, applyTemperatureAndTintToImageData } from './filterFallback';
import { applyLutToImageData, getBuiltinLutData } from './lutEngine';
import { canvasToBlob } from './exportPipeline/canvas';
import { applyRawProcessingToImageData } from './rawEngine';
import {
  clamp,
  getPreviewBaseFilter,
  hasGlobalPreviewAdjustments,
  cloneCanvas,
  compositeCanvasLayer,
} from './exportPipeline/helpers';
import { applyColorWheelsToImageData } from './colorWheelsEngine';
import { applySpecializedCurvesToImageData } from './hslEngine';
import { applyPortraitToImageData, loadMaskBuffer } from './portraitEngine';
import {
  applyBlur,
  applyUnsharpMask,
  applyVignette,
  applyCurveLutsToCanvas,
  applySplitToning,
  applySplitToningToImageData,
  applyGrain,
  applyLightLeak,
  applyBlendOverlay,
  applyTiltShift,
  applyAnnotations,
  applyFrame,
  applyPerspective,
  renderCanvasWithFilter,
  applyLensCorrection,
  applyDefringeAndOpticalVignetting,
} from './exportPipeline/stages';

const DEFAULT_EXPORT_MIME = 'image/jpeg';
const DEFAULT_EXPORT_QUALITY = 0.95;

interface ExportEditedCanvasOptions {
  sourceCanvas: HTMLCanvasElement;
  adjustments: Adjustments;
  mimeType?: string;
  quality?: number;
  annotations?: Annotation[];
  healingCanvas?: HTMLCanvasElement | null;
  liquifyCanvas?: HTMLCanvasElement | null;
  onProgress?: (step: string, current: number, total: number) => void;
}

export {
  applySplitToning,
  applySplitToningToImageData,
  applyGrain,
  applyLightLeak,
  applyTiltShift,
  applyVignette,
  drawBlendOverlay,
  applyUnsharpMask,
  applyCurveLutsToCanvas,
  applyBlur,
  applyLensCorrection,
  applyDefringeAndOpticalVignetting,
} from './exportPipeline/stages';

export const exportEditedCanvas = async ({
  sourceCanvas,
  adjustments,
  mimeType = DEFAULT_EXPORT_MIME,
  quality = DEFAULT_EXPORT_QUALITY,
  annotations,
  healingCanvas,
  liquifyCanvas,
  onProgress,
}: ExportEditedCanvasOptions): Promise<Blob> => {
  const report = (step: string, current: number, total: number) => onProgress?.(step, current, total);
  const TOTAL_STEPS = 18;

  let preparedCanvas = cloneCanvas(sourceCanvas).canvas;
  report('Preparing canvas', 1, TOTAL_STEPS);

  // Composite liquify mesh deformation if present
  compositeCanvasLayer(preparedCanvas, liquifyCanvas, 'liquifyCanvas');

  // Composite healing & clone strokes if present
  compositeCanvasLayer(preparedCanvas, healingCanvas, 'healingCanvas');

  const noise = adjustments.noiseReduction || 0;
  const sharp = adjustments.sharpness || 0;
  const effectiveNoise = Math.max(0, noise - sharp * 0.5);
  const effectiveSharp = sharp > 0 ? Math.max(0, sharp - noise * 0.5) : sharp;

  const effectiveAdj = {
    ...adjustments,
    noiseReduction: effectiveNoise,
    sharpness: effectiveSharp,
  };

  if (hasGlobalPreviewAdjustments(effectiveAdj)) {
    report('Applying tone adjustments', 2, TOTAL_STEPS);
    preparedCanvas = renderCanvasWithFilter(preparedCanvas, getPreviewBaseFilter(effectiveAdj), effectiveAdj);
  }

  // Color Temperature & Tint (Chromatic Balance)
  if ((adjustments.temperature ?? 0) !== 0 || (adjustments.tint ?? 0) !== 0) {
    report('Applying color temperature & tint', 2.3, TOTAL_STEPS);
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      applyTemperatureAndTintToImageData(imgData, adjustments.temperature, adjustments.tint);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  // Camera RAW Development Stage
  if (adjustments.raw) {
    report('Developing Camera RAW parameters', 2.5, TOTAL_STEPS);
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      applyRawProcessingToImageData(imgData, adjustments.raw);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  report('Applying highlights & shadows', 3, TOTAL_STEPS);
  if (adjustments.highlights !== 0 || adjustments.shadows !== 0) {
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      applyNonLinearHighlightsAndShadows(imgData, adjustments.highlights, adjustments.shadows);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  report('Applying dehaze', 4, TOTAL_STEPS);
  if (adjustments.dehaze !== 0) {
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      const f = adjustments.dehaze / 100;
      for (let i = 0; i < imgData.data.length; i += 4) {
        let r = imgData.data[i] / 255;
        let g = imgData.data[i + 1] / 255;
        let b = imgData.data[i + 2] / 255;
        const avg = (r + g + b) / 3;
        r = r + (r - avg) * f * 0.5;
        g = g + (g - avg) * f * 0.5;
        b = b + (b - avg) * f * 0.5;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const satBoost = 1 + f * 0.3;
        const grayR = lum, grayG = lum, grayB = lum;
        r = grayR + (r - grayR) * satBoost;
        g = grayG + (g - grayG) * satBoost;
        b = grayB + (b - grayB) * satBoost;
        imgData.data[i] = clamp(Math.round(r * 255), 0, 255);
        imgData.data[i + 1] = clamp(Math.round(g * 255), 0, 255);
        imgData.data[i + 2] = clamp(Math.round(b * 255), 0, 255);
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  // AI Portrait Retouching
  if (adjustments.portrait && (adjustments.portrait.masks || adjustments.portrait.faces)) {
    report('Applying AI portrait retouching', 4.5, TOTAL_STEPS);
    const pW = preparedCanvas.width;
    const pH = preparedCanvas.height;
    const portrait = adjustments.portrait;
    const facesObj = portrait.faces || {};
    const faceKeys = Object.keys(facesObj);

    let loadedMasks: import('./portraitEngine').LoadedPortraitMasks = {};

    if (faceKeys.length > 0) {
      const loadedFaces: Record<string, import('./portraitEngine').SingleFaceMasks> = {};
      for (const fId of faceKeys) {
        const fm = facesObj[fId]?.masks;
        if (fm) {
          const [skin, eyes, lips, teeth, eyebrows] = await Promise.all([
            fm.skin ? loadMaskBuffer(fm.skin) : null,
            fm.eyes ? loadMaskBuffer(fm.eyes) : null,
            fm.lips ? loadMaskBuffer(fm.lips) : null,
            fm.teeth ? loadMaskBuffer(fm.teeth) : null,
            fm.eyebrows ? loadMaskBuffer(fm.eyebrows) : null,
          ]);
          loadedFaces[fId] = { skin, eyes, lips, teeth, eyebrows };
        }
      }
      loadedMasks = { faces: loadedFaces };
    } else if (portrait.masks) {
      const pMasks = portrait.masks;
      const [skinBuf, eyesBuf, lipsBuf, teethBuf, browBuf] = await Promise.all([
        pMasks.skin ? loadMaskBuffer(pMasks.skin) : null,
        pMasks.eyes ? loadMaskBuffer(pMasks.eyes) : null,
        pMasks.lips ? loadMaskBuffer(pMasks.lips) : null,
        pMasks.teeth ? loadMaskBuffer(pMasks.teeth) : null,
        pMasks.eyebrows ? loadMaskBuffer(pMasks.eyebrows) : null,
      ]);
      loadedMasks = {
        skin: skinBuf,
        eyes: eyesBuf,
        lips: lipsBuf,
        teeth: teethBuf,
        eyebrows: browBuf,
      };
    }

    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, pW, pH);
      applyPortraitToImageData(imgData, portrait, loadedMasks);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  report('Applying HSL adjustments', 5, TOTAL_STEPS);
  applyHslToCanvas(preparedCanvas, effectiveAdj.hsl);

  if (adjustments.specializedCurves) {
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      applySpecializedCurvesToImageData(imgData, adjustments.specializedCurves);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  if (adjustments.colorWheels) {
    const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
      applyColorWheelsToImageData(imgData, adjustments.colorWheels);
      ctx.putImageData(imgData, 0, 0);
    }
  }

  if (adjustments.defringe) {
    applyDefringeAndOpticalVignetting(preparedCanvas, adjustments.defringe);
  }

  report('Applying noise reduction', 6, TOTAL_STEPS);
  applyBlur(preparedCanvas, effectiveNoise / 100 * 1.2);

  report('Applying sharpening', 7, TOTAL_STEPS);
  if (effectiveSharp > 0) {
    applyUnsharpMask(preparedCanvas, effectiveSharp, 1.2, 2.5);
  } else if (effectiveSharp < 0) {
    applyBlur(preparedCanvas, Math.abs(effectiveSharp) / 100 * 1.5);
  }

  report('Applying curves', 8, TOTAL_STEPS);
  applyCurveLutsToCanvas(preparedCanvas, effectiveAdj);

  report('Applying LUT color grade', 9, TOTAL_STEPS);
  if (adjustments.lut && (adjustments.lut.builtinId || adjustments.lut.customData)) {
    const lutData = adjustments.lut.customData || getBuiltinLutData(adjustments.lut.builtinId!);
    if (lutData) {
      const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
        const opacity = (adjustments.lut.opacity ?? 100) / 100;
        const result = applyLutToImageData(imgData, lutData, opacity);
        ctx.putImageData(result, 0, 0);
      }
    }
  }

  report('Applying split toning', 11, TOTAL_STEPS);
  applySplitToning(preparedCanvas, effectiveAdj);

  report('Applying film grain', 12, TOTAL_STEPS);
  applyGrain(preparedCanvas, adjustments);

  report('Applying light leaks', 13, TOTAL_STEPS);
  applyLightLeak(preparedCanvas, adjustments);

  report('Applying double exposure', 14, TOTAL_STEPS);
  await applyBlendOverlay(preparedCanvas, adjustments);

  report('Applying tilt-shift', 15, TOTAL_STEPS);
  applyTiltShift(preparedCanvas, adjustments);

  report('Applying vignette & annotations', 16, TOTAL_STEPS);
  applyVignette(preparedCanvas, adjustments.vignette);
  await applyAnnotations(preparedCanvas, annotations);

  if (adjustments.perspective !== 0 || adjustments.verticalPerspective !== 0) {
    preparedCanvas = applyPerspective(preparedCanvas, adjustments.perspective, adjustments.verticalPerspective);
  }

  const distortion = (adjustments as any).distortion || 0;
  if (distortion !== 0) {
    preparedCanvas = applyLensCorrection(preparedCanvas, distortion, true);
  }

  preparedCanvas = applyFrame(preparedCanvas, adjustments);

  report('Encoding final image', TOTAL_STEPS, TOTAL_STEPS);

  const rawBlob = await canvasToBlob(preparedCanvas, mimeType, quality);
  return rawBlob;
};
