/**
 * magnetic.ts
 * Snap-to-edge heuristics: find the highest-gradient-magnitude point within a radius.
 */
import { Point2D } from './types';

export function findMagneticEdgePoint(
  imgData: ImageData,
  cx: number,
  cy: number,
  searchRadius = 15,
): Point2D {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  let maxScore = -1;
  let bestX = Math.round(cx);
  let bestY = Math.round(cy);

  const startX = Math.max(1, Math.min(w - 2, Math.round(cx - searchRadius)));
  const endX = Math.max(1, Math.min(w - 2, Math.round(cx + searchRadius)));
  const startY = Math.max(1, Math.min(h - 2, Math.round(cy - searchRadius)));
  const endY = Math.max(1, Math.min(h - 2, Math.round(cy + searchRadius)));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const idxR = (y * w + (x + 1)) * 4;
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];

      const idxD = ((y + 1) * w + x) * 4;
      const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];

      const gx = lumR - lum;
      const gy = lumD - lum;
      const gradMag = Math.hypot(gx, gy);

      const dist = Math.hypot(x - cx, y - cy);
      const score = gradMag / (1 + dist * 0.25);

      if (score > maxScore) {
        maxScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY };
}

export function isPointNearPoint(p1: Point2D, p2: Point2D, threshold: number): boolean {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= threshold;
}
