import { Adjustments } from '../filterEngine';
import { isCtxFilterSupported, applyBlurFallback } from '../filterFallback';
import { clamp, loadCanvasImage } from '../utils/imageUtils';

export { clamp };

/**
 * getPreviewBaseFilter - Retrieves get preview base filter.
 */
export const getPreviewBaseFilter = (adj: Adjustments) => {
  const brightnessFactor = Math.max(
    0.05,
    1
      + adj.brightness / 100 * 0.55
      + adj.exposure / 100 * 0.5
      + adj.whites / 100 * 0.15
      + adj.blacks / 100 * 0.13,
  );

  const contrastFactor = Math.max(
    0.05,
    1
      + adj.contrast / 100 * 0.65
      - adj.blacks / 100 * 0.22
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

  const hueRotation = adj.hue || 0;

  return [
    `brightness(${brightnessFactor.toFixed(4)})`,
    `contrast(${contrastFactor.toFixed(4)})`,
    `saturate(${saturationFactor.toFixed(4)})`,
    `hue-rotate(${hueRotation.toFixed(2)}deg)`,
  ].join(' ');
};

/**
 * hasGlobalPreviewAdjustments - Performs has global preview adjustments.
 */
export const hasGlobalPreviewAdjustments = (adj: Adjustments) =>
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
  adj.tint !== 0 ||
  adj.clarity !== 0 ||
  adj.ambiance !== 0;

export const cloneCanvas = (sourceCanvas: HTMLCanvasElement) => {
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

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return loadCanvasImage(src);
};

/**
 * Composites an overlay canvas onto a target canvas if both have valid dimensions.
 */
export const compositeCanvasLayer = (
  targetCanvas: HTMLCanvasElement,
  overlayCanvas?: HTMLCanvasElement | null,
  layerName = 'layer',
): void => {
  if (
    !overlayCanvas ||
    overlayCanvas.width <= 0 ||
    overlayCanvas.height <= 0 ||
    targetCanvas.width <= 0 ||
    targetCanvas.height <= 0
  ) {
    return;
  }

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  try {
    ctx.drawImage(overlayCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  } catch (err) {
    console.warn(`Failed to composite ${layerName}:`, err);
  }
};

/**
 * hexToRgbString - Performs hex to rgb string.
 */
export const hexToRgbString = (hex: string): string => {
  const cleaned = hex.replace('#', '');
  let r = 251, g = 146, b = 60; // default warm-left color
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  }
  return `${r}, ${g}, ${b}`;
};
