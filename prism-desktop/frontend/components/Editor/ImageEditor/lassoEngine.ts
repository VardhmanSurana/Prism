export type LassoType = 'freehand' | 'polygonal' | 'magnetic';
export type LassoOperation = 'new' | 'add' | 'subtract' | 'intersect';

export interface Point2D {
  x: number;
  y: number;
}

export interface LassoState {
  type: LassoType;
  operation: LassoOperation;
  points: Point2D[];
  isClosed: boolean;
  feather: number; // 0 -> 100px
}

export const DEFAULT_LASSO_STATE: LassoState = {
  type: 'freehand',
  operation: 'new',
  points: [],
  isClosed: false,
  feather: 0,
};

/**
 * Magnetic Edge Snapping:
 * Finds the highest contrast edge pixel near candidate point (cx, cy) using Sobel gradient magnitude.
 */
export function findMagneticEdgePoint(
  imgData: ImageData,
  cx: number,
  cy: number,
  searchRadius: number = 10
): Point2D {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  let maxGrad = -1;
  let bestX = Math.round(cx);
  let bestY = Math.round(cy);

  const startX = Math.max(1, Math.min(w - 2, Math.round(cx - searchRadius)));
  const endX = Math.max(1, Math.min(w - 2, Math.round(cx + searchRadius)));
  const startY = Math.max(1, Math.min(h - 2, Math.round(cy - searchRadius)));
  const endY = Math.max(1, Math.min(h - 2, Math.round(cy + searchRadius)));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      // Sobel operator
      const idx = (y * w + x) * 4;
      const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];

      const idxR = (y * w + (x + 1)) * 4;
      const lumR = 0.2126 * data[idxR] + 0.7152 * data[idxR + 1] + 0.0722 * data[idxR + 2];

      const idxD = ((y + 1) * w + x) * 4;
      const lumD = 0.2126 * data[idxD] + 0.7152 * data[idxD + 1] + 0.0722 * data[idxD + 2];

      const gx = lumR - lum;
      const gy = lumD - lum;
      const gradMag = Math.sqrt(gx * gx + gy * gy);

      // Distance weighting: prefer edges closer to cursor
      const dist = Math.hypot(x - cx, y - cy);
      const score = gradMag / (1 + dist * 0.2);

      if (score > maxGrad) {
        maxGrad = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY };
}

/**
 * Renders polygon path onto binary mask canvas (255 inside, 0 outside)
 */
export function renderLassoPathToMask(
  points: Point2D[],
  width: number,
  height: number,
  feather: number = 0
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx || points.length < 3) return canvas;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  if (feather > 0) {
    ctx.filter = `blur(${feather}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  return canvas;
}

/**
 * Inverts selection mask
 */
export function invertMask(maskCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const inverted = document.createElement('canvas');
  inverted.width = maskCanvas.width;
  inverted.height = maskCanvas.height;

  const ctx = inverted.getContext('2d');
  if (!ctx) return maskCanvas;

  ctx.drawImage(maskCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  ctx.putImageData(imgData, 0, 0);
  return inverted;
}
