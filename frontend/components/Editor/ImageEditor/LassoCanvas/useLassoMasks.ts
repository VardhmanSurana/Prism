/**
 * useLassoMasks.ts
 * Owns the active + refined mask canvases, the boundary cache, and the
 * `commitSelection` pipeline that finalizes a freehand/polygonal/magnetic path
 * into a Boolean-combined, edge-refined mask.
 */
import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import {
  LassoState,
  Point2D,
  applyRefineEdgeToMask,
  combineMaskWithPolygon,
  extractMaskBoundary,
} from '../lassoEngine';

export interface UseLassoMasksParams {
  width: number;
  height: number;
  state: LassoState;
  onChange: (s: LassoState) => void;
  onSelectionComplete?: (maskCanvas: HTMLCanvasElement) => void;
}

export interface LassoMasksApi {
  activeMaskCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  refinedMaskCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  maskBoundaryRef: MutableRefObject<{ width: number; height: number; boundary: Uint8Array } | null>;
  commitSelection: (finalPoints: Point2D[]) => void;
}

export function useLassoMasks(p: UseLassoMasksParams): LassoMasksApi {
  const activeMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const refinedMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskBoundaryRef = useRef<{ width: number; height: number; boundary: Uint8Array } | null>(null);

  useEffect(() => {
    if (!activeMaskCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = p.width;
      c.height = p.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, p.width, p.height);
      }
      activeMaskCanvasRef.current = c;
    }
  }, [p.width, p.height]);

  const refreshBoundary = useCallback((mask: HTMLCanvasElement) => {
    try {
      maskBoundaryRef.current = extractMaskBoundary(mask);
    } catch {
      maskBoundaryRef.current = null;
    }
  }, []);

  const commitSelection = useCallback(
    (finalPoints: Point2D[]) => {
      if (finalPoints.length < 3) return;

      const combined = combineMaskWithPolygon(
        p.state.hasActiveMask ? activeMaskCanvasRef.current : null,
        finalPoints,
        p.state.operation,
        p.width,
        p.height,
      );
      activeMaskCanvasRef.current = combined;

      const refined = applyRefineEdgeToMask(combined, p.state.refine);
      refinedMaskCanvasRef.current = refined;
      refreshBoundary(refined);
      const maskDataUrl = refined.toDataURL('image/png');

      let updatedClosedPaths = [...(p.state.closedPaths || [])];
      if (p.state.operation === 'new') {
        updatedClosedPaths = [finalPoints];
      } else if (p.state.operation === 'add') {
        updatedClosedPaths.push(finalPoints);
      } else {
        updatedClosedPaths = [finalPoints];
      }

      p.onChange({
        ...p.state,
        points: [],
        liveWirePath: [],
        closedPaths: updatedClosedPaths,
        isClosed: true,
        hasActiveMask: true,
        activeMaskDataUrl: maskDataUrl,
      });
      p.onSelectionComplete?.(refined);
    },
    [p.state, p.width, p.height, p.onChange, p.onSelectionComplete, refreshBoundary],
  );

  return {
    activeMaskCanvasRef,
    refinedMaskCanvasRef,
    maskBoundaryRef,
    commitSelection,
  };
}
