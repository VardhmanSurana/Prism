/**
 * filterStages.ts
 * Core filter stages: blur, unsharp mask, vignette, curve LUTs, and base filter rendering.
 */

import { Adjustments } from '../../filterEngine';
import { getCompositeCurveLuts, isIdentityCurve } from '../../curves';
import { isCtxFilterSupported, applyBlurFallback, applyBaseFiltersToImageData } from '../../filterFallback';
import { clamp, cloneCanvas } from '../helpers';

export const applyBlur = (canvas: HTMLCanvasElement, radius: number) => {
  if (radius <= 0) {
    return canvas;
  }

  if (!isCtxFilterSupported()) {
    applyBlurFallback(canvas, radius);
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

export const applyUnsharpMask = (
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

  if (!isCtxFilterSupported()) {
    applyBlurFallback(blurredCanvas, blurRadius);
  } else {
    blurredCtx.filter = `blur(${blurRadius}px)`;
    blurredCtx.drawImage(canvas, 0, 0);
    blurredCtx.filter = 'none';
  }

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

export const applyVignette = (canvas: HTMLCanvasElement, vignette: number) => {
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

  if (!isCtxFilterSupported()) {
    applyBlurFallback(blurredOverlay, 2);
  } else {
    blurredCtx.filter = 'blur(2px)';
    blurredCtx.drawImage(overlay, 0, 0);
    blurredCtx.filter = 'none';
  }

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

export const applyCurveLutsToCanvas = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
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

export const renderCanvasWithFilter = (sourceCanvas: HTMLCanvasElement, filter: string, adjustments: Adjustments) => {
  const { canvas, ctx } = cloneCanvas(sourceCanvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isCtxFilterSupported()) {
    ctx.filter = filter || 'none';
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyBaseFiltersToImageData(imgData, adjustments);
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
};
