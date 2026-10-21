/**
 * useLassoKeyboard.ts
 * Global keyboard shortcuts: Space-pan, Alt, Enter (close), Escape (cancel),
 * Backspace (undo last anchor), Ctrl/Cmd+A (select all), Ctrl/Cmd+D (deselect),
 * Ctrl/Cmd+Shift+I (invert).
 */
import { useEffect, useState } from 'react';
import {
  LassoState,
  Point2D,
  applyRefineEdgeToMask,
  createSelectAllMask,
  extractMaskBoundary,
  invertMask,
} from '../lassoEngine';
import { LassoMasksApi } from './useLassoMasks';

export interface UseLassoKeyboardParams {
  state: LassoState;
  width: number;
  height: number;
  onChange: (s: LassoState) => void;
  masks: LassoMasksApi;
}

export interface UseLassoKeyboardApi {
  isSpacePressed: boolean;
  isAltPressed: boolean;
}

export function useLassoKeyboard(p: UseLassoKeyboardParams): UseLassoKeyboardApi {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (p.state.points.length >= 3) {
          p.masks.commitSelection(p.state.points);
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        p.onChange({ ...p.state, points: [], liveWirePath: [], isClosed: false });
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (p.state.points.length > 0) {
          p.onChange({
            ...p.state,
            points: p.state.points.slice(0, -1),
            liveWirePath: [],
          });
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allCanvas = createSelectAllMask(p.width, p.height);
        p.masks.activeMaskCanvasRef.current = allCanvas;
        const refined = applyRefineEdgeToMask(allCanvas, p.state.refine);
        p.masks.refinedMaskCanvasRef.current = refined;
        try {
          p.masks.maskBoundaryRef.current = extractMaskBoundary(refined);
        } catch {
          p.masks.maskBoundaryRef.current = null;
        }
        const allPoints: Point2D[] = [
          { x: 1, y: 1 },
          { x: p.width - 1, y: 1 },
          { x: p.width - 1, y: p.height - 1 },
          { x: 1, y: p.height - 1 },
        ];
        p.onChange({
          ...p.state,
          points: [],
          liveWirePath: [],
          closedPaths: [allPoints],
          hasActiveMask: true,
          activeMaskDataUrl: refined.toDataURL('image/png'),
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const emptyCanvas = document.createElement('canvas');
        emptyCanvas.width = p.width;
        emptyCanvas.height = p.height;
        const ctx = emptyCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, p.width, p.height);
        }
        p.masks.activeMaskCanvasRef.current = emptyCanvas;
        p.masks.refinedMaskCanvasRef.current = null;
        p.masks.maskBoundaryRef.current = null;
        p.onChange({
          ...p.state,
          points: [],
          liveWirePath: [],
          closedPaths: [],
          hasActiveMask: false,
          activeMaskDataUrl: null,
          isClosed: false,
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (p.masks.activeMaskCanvasRef.current) {
          const inv = invertMask(p.masks.activeMaskCanvasRef.current);
          p.masks.activeMaskCanvasRef.current = inv;
          const refined = applyRefineEdgeToMask(inv, p.state.refine);
          p.masks.refinedMaskCanvasRef.current = refined;
          try {
            p.masks.maskBoundaryRef.current = extractMaskBoundary(refined);
          } catch {
            p.masks.maskBoundaryRef.current = null;
          }
          p.onChange({
            ...p.state,
            hasActiveMask: true,
            activeMaskDataUrl: refined.toDataURL('image/png'),
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [p.state, p.width, p.height, p.onChange, p.masks]);

  return { isSpacePressed, isAltPressed };
}
