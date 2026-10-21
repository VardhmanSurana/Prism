/**
 * refineEdge.ts
 * Morphological edge refinement: feather, smooth, shift edge (dilate/erode), contrast.
 */
import { RefineEdgeSettings } from './types';

export function applyRefineEdgeToMask(
  sourceMaskCanvas: HTMLCanvasElement,
  refine: RefineEdgeSettings,
): HTMLCanvasElement {
  const { feather, smooth, shiftEdge, contrast } = refine;
  const width = sourceMaskCanvas.width;
  const height = sourceMaskCanvas.height;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceMaskCanvas;

  // 1. Draw base mask
  ctx.drawImage(sourceMaskCanvas, 0, 0);

  // 2. Smooth / Box Pre-filter
  if (smooth > 0) {
    ctx.filter = `blur(${smooth * 0.6}px)`;
    ctx.drawImage(resultCanvas, 0, 0);
    ctx.filter = 'none';
  }

  // 3. Shift Edge (Dilation / Erosion) & Contrast in pixel buffer
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  if (shiftEdge !== 0) {
    const shiftRadius = Math.abs(shiftEdge);
    const isDilate = shiftEdge > 0;
    const tempBuffer = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      tempBuffer[i] = data[i * 4];
    }

    const r = Math.min(15, Math.round(shiftRadius));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let extreme = isDilate ? 0 : 255;
        const yStart = Math.max(0, y - r);
        const yEnd = Math.min(height - 1, y + r);
        const xStart = Math.max(0, x - r);
        const xEnd = Math.min(width - 1, x + r);

        for (let ny = yStart; ny <= yEnd; ny++) {
          for (let nx = xStart; nx <= xEnd; nx++) {
            const v = tempBuffer[ny * width + nx];
            if (isDilate) {
              if (v > extreme) extreme = v;
            } else {
              if (v < extreme) extreme = v;
            }
          }
        }
        const idx = (y * width + x) * 4;
        data[idx] = extreme;
        data[idx + 1] = extreme;
        data[idx + 2] = extreme;
      }
    }
  }

  // 4. Contrast & Threshold adjustment
  if (contrast > 0) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < len; i += 4) {
      const v = data[i];
      const adjusted = Math.max(0, Math.min(255, Math.round(factor * (v - 128) + 128)));
      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 5. Feathering via Gaussian Blur
  if (feather > 0) {
    const featheredCanvas = document.createElement('canvas');
    featheredCanvas.width = width;
    featheredCanvas.height = height;
    const fCtx = featheredCanvas.getContext('2d', { willReadFrequently: true });
    if (fCtx) {
      fCtx.filter = `blur(${feather}px)`;
      fCtx.drawImage(resultCanvas, 0, 0);
      fCtx.filter = 'none';
      return featheredCanvas;
    }
  }

  return resultCanvas;
}
