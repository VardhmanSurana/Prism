import {
  ImageMagick,
  MagickFormat,
  initializeImageMagick,
} from '@imagemagick/magick-wasm';
import magickWasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

import { getCompositeCurveLuts, isIdentityCurve } from './curves';
import { Adjustments } from './filterEngine';

const DEFAULT_EXPORT_MIME = 'image/jpeg';
const DEFAULT_EXPORT_QUALITY = 0.95;

let magickInitPromise: Promise<void> | null = null;

interface ExportEditedCanvasOptions {
  sourceCanvas: HTMLCanvasElement;
  adjustments: Adjustments;
  mimeType?: string;
  quality?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Canvas export returned an empty blob.'));
    }, mimeType, quality);
  });

const ensureImageMagick = () => {
  if (!magickInitPromise) {
    magickInitPromise = initializeImageMagick(new URL(magickWasmUrl, window.location.href));
  }

  return magickInitPromise;
};

const getPreviewBaseFilter = (adj: Adjustments) => {
  const brightnessFactor = Math.max(
    0.05,
    1
      + adj.brightness / 100 * 0.55
      + adj.exposure / 100 * 0.5
      + adj.highlights / 100 * 0.18
      + adj.shadows / 100 * 0.14
      + adj.whites / 100 * 0.15
      - adj.blacks / 100 * 0.13,
  );

  const contrastFactor = Math.max(
    0.05,
    1
      + adj.contrast / 100 * 0.65
      + adj.blacks / 100 * 0.22
      + adj.ambiance / 100 * 0.42
      + adj.clarity / 100 * 0.38,
  );

  const saturationFactor = Math.max(
    0,
    1
      + adj.saturation / 100 * 0.6
      + adj.vibrance / 100 * 0.38
      + adj.ambiance / 100 * 0.24,
  );

  const hueRotation = adj.hue + adj.temperature * 0.65;

  return [
    `brightness(${brightnessFactor.toFixed(4)})`,
    `contrast(${contrastFactor.toFixed(4)})`,
    `saturate(${saturationFactor.toFixed(4)})`,
    `hue-rotate(${hueRotation.toFixed(2)}deg)`,
  ].join(' ');
};

const hasGlobalPreviewAdjustments = (adj: Adjustments) =>
  adj.brightness !== 0 ||
  adj.contrast !== 0 ||
  adj.exposure !== 0 ||
  adj.highlights !== 0 ||
  adj.shadows !== 0 ||
  adj.whites !== 0 ||
  adj.blacks !== 0 ||
  adj.vibrance !== 0 ||
  adj.saturation !== 0 ||
  adj.hue !== 0 ||
  adj.temperature !== 0 ||
  adj.clarity !== 0 ||
  adj.ambiance !== 0;

const getExportFormat = (mimeType: string): MagickFormat => {
  switch (mimeType) {
    case 'image/png':
      return MagickFormat.Png;
    case 'image/webp':
      return MagickFormat.WebP;
    case 'image/jpeg':
    default:
      return MagickFormat.Jpeg;
  }
};

const hasRegionAdjustments = (adjustments: Adjustments) =>
  adjustments.regions.some((region) =>
    Object.values(region.adjustments).some((value) => (value || 0) !== 0),
  );

const cloneCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;

  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get a 2D context for export preparation.');
  }

  ctx.drawImage(sourceCanvas, 0, 0);
  return { canvas: out, ctx };
};

const loadMaskBitmap = async (maskUrl: string) => {
  const response = await fetch(maskUrl);
  if (!response.ok) {
    throw new Error(`Failed to load mask: ${maskUrl}`);
  }

  const blob = await response.blob();
  return createImageBitmap(blob);
};

const createFeatheredMaskCanvas = async (maskUrl: string, width: number, height: number) => {
  const bitmap = await loadMaskBitmap(maskUrl);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;

  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) {
    bitmap.close();
    throw new Error('Failed to get a 2D context for mask compositing.');
  }

  maskCtx.filter = 'blur(3px)';
  maskCtx.drawImage(bitmap, 0, 0, width, height);
  maskCtx.filter = 'none';
  bitmap.close();

  return maskCanvas;
};

const applyRegionToneAdjustments = (
  imageData: ImageData,
  regionAdjustments: Adjustments['regions'][number]['adjustments'],
) => {
  const sat = 1 + (regionAdjustments.saturation || 0) / 100;
  const rw = 0.213 + 0.787 * sat;
  const rg = 0.715 - 0.715 * sat;
  const rb = 0.072 - 0.072 * sat;
  const gw = 0.213 - 0.213 * sat;
  const gg = 0.715 + 0.285 * sat;
  const gb = 0.072 - 0.072 * sat;
  const bw = 0.213 - 0.213 * sat;
  const bg = 0.715 - 0.715 * sat;
  const bb = 0.072 + 0.928 * sat;

  const brightness = (regionAdjustments.brightness || 0) / 100 * 0.5;
  const contrast = 1 + (regionAdjustments.contrast || 0) / 100;
  const warmth = (regionAdjustments.warmth || 0) / 100 * 0.15;
  const offset = 0.5 * (1 - contrast) + brightness;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const r0 = imageData.data[index] / 255;
    const g0 = imageData.data[index + 1] / 255;
    const b0 = imageData.data[index + 2] / 255;

    const sr = r0 * rw + g0 * rg + b0 * rb;
    const sg = r0 * gw + g0 * gg + b0 * gb;
    const sb = r0 * bw + g0 * bg + b0 * bb;

    const outR = Math.max(0, Math.min(1, sr * contrast + offset + warmth));
    const outG = Math.max(0, Math.min(1, sg * contrast + offset));
    const outB = Math.max(0, Math.min(1, sb * contrast + offset - warmth));

    imageData.data[index] = Math.round(outR * 255);
    imageData.data[index + 1] = Math.round(outG * 255);
    imageData.data[index + 2] = Math.round(outB * 255);
  }

  return imageData;
};

const createRegionAdjustedCanvas = async (
  baseCanvas: HTMLCanvasElement,
  regionAdjustments: Adjustments['regions'][number]['adjustments'],
) => {
  const { canvas, ctx } = cloneCanvas(baseCanvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const adjusted = applyRegionToneAdjustments(imageData, regionAdjustments);
  ctx.putImageData(adjusted, 0, 0);

  applyBlur(canvas, Math.min(20, (regionAdjustments.blur || 0) / 2.5));
  applyUnsharpMask(canvas, Math.max(0, regionAdjustments.sharpness || 0), 1.2, 2.5);
  if ((regionAdjustments.sharpness || 0) < 0) {
    applyBlur(canvas, Math.abs(regionAdjustments.sharpness || 0) / 100 * 1.5);
  }

  return canvas;
};

const applyRegionalAdjustments = async (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  if (!hasRegionAdjustments(adjustments)) {
    return canvas;
  }

  for (const region of adjustments.regions) {
    const hasAdjustments = Object.values(region.adjustments).some((value) => (value || 0) !== 0);
    if (!hasAdjustments) {
      continue;
    }

    const adjustedCanvas = await createRegionAdjustedCanvas(canvas, region.adjustments);
    const maskCanvas = await createFeatheredMaskCanvas(region.maskUrl, canvas.width, canvas.height);

    const maskedEffect = document.createElement('canvas');
    maskedEffect.width = canvas.width;
    maskedEffect.height = canvas.height;
    const maskedCtx = maskedEffect.getContext('2d');
    if (!maskedCtx) {
      throw new Error('Failed to get a 2D context for masked region compositing.');
    }

    maskedCtx.drawImage(adjustedCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(maskCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'source-over';

    const finalCtx = canvas.getContext('2d');
    if (!finalCtx) {
      throw new Error('Failed to get a 2D context for final regional compositing.');
    }

    finalCtx.drawImage(maskedEffect, 0, 0);
  }

  return canvas;
};

const renderCanvasWithFilter = (sourceCanvas: HTMLCanvasElement, filter: string) => {
  const { canvas, ctx } = cloneCanvas(sourceCanvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = filter || 'none';
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';
  return canvas;
};

const applyBlur = (canvas: HTMLCanvasElement, radius: number) => {
  if (radius <= 0) {
    return canvas;
  }

  const blurred = document.createElement('canvas');
  blurred.width = canvas.width;
  blurred.height = canvas.height;
  const ctx = blurred.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get a 2D context for blur.');
  }

  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  const targetCtx = canvas.getContext('2d');
  if (!targetCtx) {
    throw new Error('Failed to get a 2D context for blur application.');
  }

  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  targetCtx.drawImage(blurred, 0, 0);
  return canvas;
};

const applyUnsharpMask = (
  canvas: HTMLCanvasElement,
  sharpness: number,
  blurRadius: number,
  boostMultiplier: number,
) => {
  if (sharpness <= 0) {
    return canvas;
  }

  const amount = sharpness / 100 * boostMultiplier;
  if (amount <= 0) {
    return canvas;
  }

  const originalCtx = canvas.getContext('2d', { willReadFrequently: true });
  if (!originalCtx) {
    throw new Error('Failed to get a 2D context for unsharp mask.');
  }

  const blurredCanvas = document.createElement('canvas');
  blurredCanvas.width = canvas.width;
  blurredCanvas.height = canvas.height;
  const blurredCtx = blurredCanvas.getContext('2d', { willReadFrequently: true });
  if (!blurredCtx) {
    throw new Error('Failed to get a 2D context for unsharp blur.');
  }

  blurredCtx.filter = `blur(${blurRadius}px)`;
  blurredCtx.drawImage(canvas, 0, 0);
  blurredCtx.filter = 'none';

  const originalData = originalCtx.getImageData(0, 0, canvas.width, canvas.height);
  const blurredData = blurredCtx.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < originalData.data.length; index += 4) {
    originalData.data[index] = clamp(Math.round((1 + amount) * originalData.data[index] - amount * blurredData.data[index]), 0, 255);
    originalData.data[index + 1] = clamp(Math.round((1 + amount) * originalData.data[index + 1] - amount * blurredData.data[index + 1]), 0, 255);
    originalData.data[index + 2] = clamp(Math.round((1 + amount) * originalData.data[index + 2] - amount * blurredData.data[index + 2]), 0, 255);
  }

  originalCtx.putImageData(originalData, 0, 0);
  return canvas;
};

const applyVignette = (canvas: HTMLCanvasElement, vignette: number) => {
  if (!vignette) {
    return canvas;
  }

  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;

  const overlayCtx = overlay.getContext('2d');
  if (!overlayCtx) {
    throw new Error('Failed to get a 2D context for vignette.');
  }

  const gradient = overlayCtx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.6,
  );
  const opacity = Math.min(0.9, Math.abs(vignette / 100));
  const color = vignette < 0 ? '0, 0, 0' : '255, 255, 255';

  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(${color}, ${opacity})`);

  overlayCtx.fillStyle = gradient;
  overlayCtx.fillRect(0, 0, overlay.width, overlay.height);

  const blurredOverlay = document.createElement('canvas');
  blurredOverlay.width = canvas.width;
  blurredOverlay.height = canvas.height;
  const blurredCtx = blurredOverlay.getContext('2d');
  if (!blurredCtx) {
    throw new Error('Failed to get a 2D context for vignette blur.');
  }

  blurredCtx.filter = 'blur(2px)';
  blurredCtx.drawImage(overlay, 0, 0);
  blurredCtx.filter = 'none';

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get a 2D context for vignette application.');
  }

  ctx.save();
  ctx.globalCompositeOperation = vignette < 0 ? 'multiply' : 'source-over';
  ctx.drawImage(blurredOverlay, 0, 0);
  ctx.restore();
  return canvas;
};

const applyCurveLutsToCanvas = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  if (isIdentityCurve(adjustments.curves)) {
    return canvas;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get a 2D context for curve export.');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { r, g, b } = getCompositeCurveLuts(adjustments.curves, 256);

  for (let index = 0; index < imageData.data.length; index += 4) {
    imageData.data[index] = r[imageData.data[index]];
    imageData.data[index + 1] = g[imageData.data[index + 1]];
    imageData.data[index + 2] = b[imageData.data[index + 2]];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const exportEditedCanvas = async ({
  sourceCanvas,
  adjustments,
  mimeType = DEFAULT_EXPORT_MIME,
  quality = DEFAULT_EXPORT_QUALITY,
}: ExportEditedCanvasOptions): Promise<Blob> => {
  let preparedCanvas = cloneCanvas(sourceCanvas).canvas;

  if (hasGlobalPreviewAdjustments(adjustments)) {
    preparedCanvas = renderCanvasWithFilter(preparedCanvas, getPreviewBaseFilter(adjustments));
  }

  applyBlur(preparedCanvas, adjustments.noiseReduction / 100 * 1.2);
  if (adjustments.sharpness > 0) {
    applyUnsharpMask(preparedCanvas, adjustments.sharpness, 1.2, 2.5);
  } else if (adjustments.sharpness < 0) {
    applyBlur(preparedCanvas, Math.abs(adjustments.sharpness) / 100 * 1.5);
  }

  applyCurveLutsToCanvas(preparedCanvas, adjustments);
  await applyRegionalAdjustments(preparedCanvas, adjustments);
  applyVignette(preparedCanvas, adjustments.vignette);

  try {
    await ensureImageMagick();
    const exportFormat = getExportFormat(mimeType);

    return await ImageMagick.readFromCanvas(preparedCanvas, async (image) => {
      image.quality = Math.round(clamp(quality, 0, 1) * 100);
      return image.write(exportFormat, (data) => new Blob([data], { type: mimeType }));
    });
  } catch (error) {
    console.error('ImageMagick encoding failed, falling back to canvas export.', error);
    return canvasToBlob(preparedCanvas, mimeType, quality);
  }
};
