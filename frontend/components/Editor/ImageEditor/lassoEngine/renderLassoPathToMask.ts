/**
 * renderLassoPathToMask.ts
 * Legacy single-path-with-feather helper preserved for backwards compatibility.
 */
import { Point2D } from './types';
import { DEFAULT_REFINE_SETTINGS } from './types';
import { renderPolygonToMask } from './mask';
import { applyRefineEdgeToMask } from './refineEdge';

export function renderLassoPathToMask(
  points: Point2D[],
  width: number,
  height: number,
  feather = 0,
): HTMLCanvasElement {
  const base = renderPolygonToMask(points, width, height);
  if (feather > 0) {
    return applyRefineEdgeToMask(base, { ...DEFAULT_REFINE_SETTINGS, feather });
  }
  return base;
}
