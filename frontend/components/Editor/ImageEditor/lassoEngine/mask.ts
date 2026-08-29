/**
 * mask.ts
 * Binary mask rendering, Boolean combine, and boundary extraction.
 */
import { LassoOperation, Point2D } from './types';

export function createEmptyMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

export function renderPolygonToMask(
  points: Point2D[],
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = createEmptyMaskCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || points.length < 3) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  return canvas;
}

export function combineMaskWithPolygon(
  existingMask: HTMLCanvasElement | null,
  points: Point2D[],
  operation: LassoOperation,
  width: number,
  height: number,
): HTMLCanvasElement {
  const newPathMask = renderPolygonToMask(points, width, height);

  if (operation === 'new' || !existingMask) {
    return newPathMask;
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return newPathMask;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (operation === 'add') {
    ctx.drawImage(existingMask, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(newPathMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else if (operation === 'subtract') {
    const eCtx = existingMask.getContext('2d', { willReadFrequently: true });
    const nCtx = newPathMask.getContext('2d', { willReadFrequently: true });
    if (eCtx && nCtx) {
      const eData = eCtx.getImageData(0, 0, width, height);
      const nData = nCtx.getImageData(0, 0, width, height);
      const outData = ctx.createImageData(width, height);

      const d = outData.data;
      const ed = eData.data;
      const nd = nData.data;

      for (let i = 0; i < d.length; i += 4) {
        const val = Math.max(0, ed[i] - nd[i]);
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
        d[i + 3] = 255;
      }
      ctx.putImageData(outData, 0, 0);
      return resultCanvas;
    }
  } else if (operation === 'intersect') {
    const eCtx = existingMask.getContext('2d', { willReadFrequently: true });
    const nCtx = newPathMask.getContext('2d', { willReadFrequently: true });
    if (eCtx && nCtx) {
      const eData = eCtx.getImageData(0, 0, width, height);
      const nData = nCtx.getImageData(0, 0, width, height);
      const outData = ctx.createImageData(width, height);

      const d = outData.data;
      const ed = eData.data;
      const nd = nData.data;

      for (let i = 0; i < d.length; i += 4) {
        const val = Math.min(ed[i], nd[i]);
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
        d[i + 3] = 255;
      }
      ctx.putImageData(outData, 0, 0);
      return resultCanvas;
    }
  }

  return resultCanvas;
}

export function extractMaskBoundary(
  maskCanvas: HTMLCanvasElement,
): { width: number; height: number; boundary: Uint8Array } {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { width: w, height: h, boundary: new Uint8Array(0) };

  const data = ctx.getImageData(0, 0, w, h).data;
  const boundary = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const yw = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (yw + x) * 4;
      if (data[idx] > 128) {
        if (
          x === 0 ||
          x === w - 1 ||
          y === 0 ||
          y === h - 1 ||
          data[(yw + x - 1) * 4] <= 128 ||
          data[(yw + x + 1) * 4] <= 128 ||
          data[((y - 1) * w + x) * 4] <= 128 ||
          data[((y + 1) * w + x) * 4] <= 128
        ) {
          boundary[yw + x] = 1;
        }
      }
    }
  }

  return { width: w, height: h, boundary };
}

export function renderBoundaryMarchingAnts(
  targetCtx: CanvasRenderingContext2D,
  boundaryData: { width: number; height: number; boundary: Uint8Array },
  dashOffset: number,
) {
  const { width: w, height: h, boundary } = boundaryData;
  if (boundary.length === 0) return;

  const imgData = targetCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const period = 8;
  for (let y = 0; y < h; y++) {
    const yw = y * w;
    for (let x = 0; x < w; x++) {
      const bIdx = yw + x;
      if (boundary[bIdx]) {
        const patternPos = (x + y + dashOffset) % period;
        const isWhite = patternPos < 4;
        const pIdx = bIdx * 4;

        d[pIdx] = isWhite ? 255 : 0;
        d[pIdx + 1] = isWhite ? 255 : 0;
        d[pIdx + 2] = isWhite ? 255 : 0;
        d[pIdx + 3] = 255;
      }
    }
  }
  targetCtx.putImageData(imgData, 0, 0);
}

export function invertMask(maskCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const inverted = document.createElement('canvas');
  inverted.width = maskCanvas.width;
  inverted.height = maskCanvas.height;

  const ctx = inverted.getContext('2d', { willReadFrequently: true });
  if (!ctx) return maskCanvas;

  ctx.drawImage(maskCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return inverted;
}

export function createSelectAllMask(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}
