import { ImageMagick } from '@imagemagick/magick-wasm';
import { Adjustments } from './filterEngine';
import { Annotation } from './AnnotationsPanel';
import { applyHslToCanvas } from './hslEngine';
import { applyNonLinearHighlightsAndShadows } from './filterFallback';
import { applyLutToImageData, getBuiltinLutData } from './lutEngine';
import { canvasToBlob, ensureImageMagick } from './exportPipeline/canvas';
import { injectC2paHeader } from './c2paEngine';
import {
  clamp,
  getPreviewBaseFilter,
  hasGlobalPreviewAdjustments,
  getExportFormat,
  cloneCanvas,
} from './exportPipeline/helpers';
import { applyColorWheelsToImageData } from './colorWheelsEngine';
import { applySpecializedCurvesToImageData } from './hslEngine';
import {
  applyRegionalAdjustments,
  applyBlur,
  applyUnsharpMask,
  applyVignette,
  applyCurveLutsToCanvas,
  applySplitToning,
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
  onProgress?: (step: string, current: number, total: number) => void;
}

export {
  applySplitToning,
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
  onProgress,
}: ExportEditedCanvasOptions): Promise<Blob> => {
  const report = (step: string, current: number, total: number) => onProgress?.(step, current, total);
  const TOTAL_STEPS = 18;

  let preparedCanvas = cloneCanvas(sourceCanvas).canvas;
  report('Preparing canvas', 1, TOTAL_STEPS);

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

  report('Applying regional adjustments', 10, TOTAL_STEPS);
  await applyRegionalAdjustments(preparedCanvas, effectiveAdj);

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

  let rawBlob: Blob;
  try {
    await ensureImageMagick();
    const exportFormat = getExportFormat(mimeType);

    rawBlob = await ImageMagick.readFromCanvas(preparedCanvas, async (image) => {
      image.quality = Math.round(clamp(quality, 0, 1) * 100);
      return image.write(exportFormat, (data) => new Blob([new Uint8Array(data)], { type: mimeType }));
    });
  } catch (error) {
    console.error('ImageMagick encoding failed, falling back to canvas export.', error);
    rawBlob = await canvasToBlob(preparedCanvas, mimeType, quality);
  }

  // Inject C2PA Content Authenticity Manifest Header
  return await injectC2paHeader(rawBlob);
};
