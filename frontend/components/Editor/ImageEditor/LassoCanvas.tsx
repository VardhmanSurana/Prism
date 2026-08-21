/**
 * LassoCanvas.tsx
 * High-performance interactive canvas overlay for Lasso & Intelligent Scissors selections.
 * Guarantees persistent, animated marching ants selection edges upon completion across all 3 tools.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  LassoState,
  Point2D,
  LiveWireCostMap,
  buildLiveWireCostMap,
  findIntelligentScissorsPath,
  findMagneticEdgePoint,
  combineMaskWithPolygon,
  applyRefineEdgeToMask,
  invertMask,
  createSelectAllMask,
  isPointNearPoint,
  extractMaskBoundary,
} from './lassoEngine';

interface LassoCanvasProps {
  width: number;
  height: number;
  imageSrc?: string;
  state: LassoState;
  onChange: (s: LassoState) => void;
  onSelectionComplete?: (maskCanvas: HTMLCanvasElement) => void;
}

export const LassoCanvas: React.FC<LassoCanvasProps> = ({
  width,
  height,
  imageSrc,
  state,
  onChange,
  onSelectionComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dashOffset, setDashOffset] = useState(0);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [isNearStart, setIsNearStart] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Cached ImageData and Intelligent Scissors Cost Map
  const [sourceImgData, setSourceImgData] = useState<ImageData | null>(null);
  const [costMap, setCostMap] = useState<LiveWireCostMap | null>(null);

  // Cumulative mask canvas and refined mask canvas
  const activeMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const refinedMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskBoundaryRef = useRef<{ width: number; height: number; boundary: Uint8Array } | null>(null);

  // Animation frame request ID for live-wire pathfinder throttling
  const pathCalcRafRef = useRef<number | null>(null);

  // Initialize or resize active mask canvas
  useEffect(() => {
    if (!activeMaskCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      }
      activeMaskCanvasRef.current = c;
    }
  }, [width, height]);

  // Load source image data and precompute Live-Wire Cost Map
  useEffect(() => {
    if (!imageSrc || width <= 0 || height <= 0) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const temp = document.createElement('canvas');
      temp.width = width;
      temp.height = height;
      const ctx = temp.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        setSourceImgData(imgData);
        try {
          const map = buildLiveWireCostMap(imgData, 480);
          setCostMap(map);
        } catch (e) {
          console.warn('Could not build live-wire cost map:', e);
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc, width, height]);

  // Animated Marching Ants 60fps loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (time - lastTime >= 65) {
        setDashOffset(prev => (prev + 1) % 12);
        lastTime = time;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Update mask boundary whenever mask changes
  const refreshBoundary = useCallback((mask: HTMLCanvasElement) => {
    try {
      maskBoundaryRef.current = extractMaskBoundary(mask);
    } catch {
      maskBoundaryRef.current = null;
    }
  }, []);

  // Commit and close a polygon/contour selection
  const commitSelection = useCallback(
    (finalPoints: Point2D[]) => {
      if (finalPoints.length < 3) return;

      const combined = combineMaskWithPolygon(
        state.hasActiveMask ? activeMaskCanvasRef.current : null,
        finalPoints,
        state.operation,
        width,
        height
      );
      activeMaskCanvasRef.current = combined;

      const refined = applyRefineEdgeToMask(combined, state.refine);
      refinedMaskCanvasRef.current = refined;
      refreshBoundary(refined);
      const maskDataUrl = refined.toDataURL('image/png');

      // Update closedPaths list based on operation
      let updatedClosedPaths = [...(state.closedPaths || [])];
      if (state.operation === 'new') {
        updatedClosedPaths = [finalPoints];
      } else if (state.operation === 'add') {
        updatedClosedPaths.push(finalPoints);
      } else {
        // For subtract/intersect, boundary is derived from composite mask
        updatedClosedPaths = [finalPoints];
      }

      setIsDrawing(false);
      onChange({
        ...state,
        points: [],
        liveWirePath: [],
        closedPaths: updatedClosedPaths,
        isClosed: true,
        hasActiveMask: true,
        activeMaskDataUrl: maskDataUrl,
      });
      onSelectionComplete?.(refined);
    },
    [state, width, height, onChange, onSelectionComplete, refreshBoundary]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }

      // Enter -> Close selection
      if (e.key === 'Enter') {
        e.preventDefault();
        if (state.points.length >= 3) {
          commitSelection(state.points);
        }
      }

      // Escape -> Cancel current drawing in progress
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsDrawing(false);
        onChange({ ...state, points: [], liveWirePath: [], isClosed: false });
      }

      // Backspace / Delete -> Remove last anchor point
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (state.points.length > 0) {
          onChange({
            ...state,
            points: state.points.slice(0, -1),
            liveWirePath: [],
          });
        }
      }

      // Ctrl/Cmd + A -> Select All
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allCanvas = createSelectAllMask(width, height);
        activeMaskCanvasRef.current = allCanvas;
        const refined = applyRefineEdgeToMask(allCanvas, state.refine);
        refinedMaskCanvasRef.current = refined;
        refreshBoundary(refined);
        const allPoints: Point2D[] = [
          { x: 1, y: 1 },
          { x: width - 1, y: 1 },
          { x: width - 1, y: height - 1 },
          { x: 1, y: height - 1 },
        ];
        onChange({
          ...state,
          points: [],
          liveWirePath: [],
          closedPaths: [allPoints],
          hasActiveMask: true,
          activeMaskDataUrl: refined.toDataURL('image/png'),
        });
      }

      // Ctrl/Cmd + D -> Deselect
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const emptyCanvas = document.createElement('canvas');
        emptyCanvas.width = width;
        emptyCanvas.height = height;
        const ctx = emptyCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        }
        activeMaskCanvasRef.current = emptyCanvas;
        refinedMaskCanvasRef.current = null;
        maskBoundaryRef.current = null;
        onChange({
          ...state,
          points: [],
          liveWirePath: [],
          closedPaths: [],
          hasActiveMask: false,
          activeMaskDataUrl: null,
          isClosed: false,
        });
      }

      // Ctrl/Cmd + Shift + I -> Invert
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (activeMaskCanvasRef.current) {
          const inv = invertMask(activeMaskCanvasRef.current);
          activeMaskCanvasRef.current = inv;
          const refined = applyRefineEdgeToMask(inv, state.refine);
          refinedMaskCanvasRef.current = refined;
          refreshBoundary(refined);
          onChange({
            ...state,
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
  }, [state, width, height, commitSelection, onChange, refreshBoundary]);

  // Coordinate mapping from screen pointer to image canvas
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: Math.max(0, Math.min(width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(height, (e.clientY - rect.top) * scaleY)),
    };
  };

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isSpacePressed) return;
    const p = getCanvasCoords(e);

    // Freehand Lasso
    if (state.type === 'freehand') {
      setIsDrawing(true);
      onChange({ ...state, points: [p], liveWirePath: [], isClosed: false });
      return;
    }

    // Polygonal & Magnetic Lasso
    let anchorPoint = p;
    if (state.type === 'magnetic' && sourceImgData) {
      anchorPoint = findMagneticEdgePoint(sourceImgData, p.x, p.y, state.magnetic.snapRadius);
    }

    // Check if clicking close to start vertex to close path
    if (state.points.length >= 3 && isPointNearPoint(p, state.points[0], 14)) {
      commitSelection(state.points);
      return;
    }

    // If magnetic and we have a live-wire path, append the full live-wire contour
    if (state.type === 'magnetic' && state.points.length > 0 && state.liveWirePath.length > 0) {
      const fullPath = [...state.points, ...state.liveWirePath.slice(1)];
      onChange({
        ...state,
        points: fullPath,
        liveWirePath: [],
      });
      setIsDrawing(true);
      return;
    }

    onChange({
      ...state,
      points: [...state.points, anchorPoint],
      liveWirePath: [],
    });
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getCanvasCoords(e);
    setCursorPos(p);

    // Check snapping to start point
    if (state.points.length >= 3 && isPointNearPoint(p, state.points[0], 14)) {
      setIsNearStart(true);
    } else {
      setIsNearStart(false);
    }

    // 1. Freehand drawing
    if (state.type === 'freehand' && isDrawing) {
      const lastP = state.points[state.points.length - 1];
      if (!lastP || Math.hypot(p.x - lastP.x, p.y - lastP.y) >= 2) {
        onChange({ ...state, points: [...state.points, p] });
      }
      return;
    }

    // 2. Intelligent Scissors / Magnetic Live-Wire Pathfinding
    if (state.type === 'magnetic' && state.points.length > 0 && costMap && !isSpacePressed) {
      if (pathCalcRafRef.current) cancelAnimationFrame(pathCalcRafRef.current);
      pathCalcRafRef.current = requestAnimationFrame(() => {
        const lastAnchor = state.points[state.points.length - 1];
        let targetP = p;
        if (sourceImgData) {
          targetP = findMagneticEdgePoint(sourceImgData, p.x, p.y, state.magnetic.snapRadius);
        }
        const wire = findIntelligentScissorsPath(costMap, lastAnchor, targetP);

        // Auto-anchor drop if enabled
        if (
          state.magnetic.autoAnchor &&
          wire.length > 4 &&
          Math.hypot(targetP.x - lastAnchor.x, targetP.y - lastAnchor.y) > state.magnetic.autoAnchorDistance
        ) {
          onChange({
            ...state,
            points: [...state.points, ...wire.slice(1)],
            liveWirePath: [],
          });
        } else {
          onChange({
            ...state,
            liveWirePath: wire,
          });
        }
      });
    }
  };

  const handlePointerUp = () => {
    if (state.type === 'freehand' && isDrawing) {
      if (state.points.length >= 3) {
        commitSelection(state.points);
      } else {
        setIsDrawing(false);
      }
    }
  };

  const handleDoubleClick = () => {
    if (state.points.length >= 3) {
      commitSelection(state.points);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (state.points.length > 0) {
      onChange({
        ...state,
        points: state.points.slice(0, -1),
        liveWirePath: [],
      });
    }
  };

  // Render Canvas Viewport & Marching Ants
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Render Active Mask Overlays (Rubylith Red, B&W)
    if (state.hasActiveMask && activeMaskCanvasRef.current) {
      const maskCanvas = refinedMaskCanvasRef.current || activeMaskCanvasRef.current;

      if (state.previewMode === 'overlay') {
        ctx.save();
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (state.previewMode === 'bw') {
        ctx.save();
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();
      }
    }

    // 2. Render Completed Closed Selection Contours (PERSISTENT MARCHING ANTS)
    if (state.closedPaths && state.closedPaths.length > 0 && state.hasActiveMask) {
      for (const closedPath of state.closedPaths) {
        if (closedPath.length < 3) continue;

        ctx.save();
        // Pass 1: Solid black contrasting underlayer
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(closedPath[0].x, closedPath[0].y);
        for (let i = 1; i < closedPath.length; i++) {
          ctx.lineTo(closedPath[i].x, closedPath[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Pass 2: White animated marching ants
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = dashOffset;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Render In-Progress Active Drawing Line & Guide
    const currentDrawPoints = [...state.points];
    if (state.type === 'magnetic' && state.liveWirePath.length > 1) {
      currentDrawPoints.push(...state.liveWirePath.slice(1));
    } else if (state.type === 'polygonal' && state.points.length > 0 && cursorPos) {
      currentDrawPoints.push(cursorPos);
    }

    if (currentDrawPoints.length > 1) {
      ctx.save();
      // Pass 1: Black stroke underlayer
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(currentDrawPoints[0].x, currentDrawPoints[0].y);
      for (let i = 1; i < currentDrawPoints.length; i++) {
        ctx.lineTo(currentDrawPoints[i].x, currentDrawPoints[i].y);
      }
      ctx.stroke();

      // Pass 2: Colored animated guide stroke
      ctx.strokeStyle = state.type === 'magnetic' ? '#38bdf8' : '#ffffff';
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = dashOffset;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Vertices & Anchors for Active In-Progress Path
    if (state.points.length > 0) {
      ctx.save();
      // Start vertex (larger & snapping close indicator)
      const startP = state.points[0];
      ctx.fillStyle = isNearStart ? '#22c55e' : '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(startP.x, startP.y, isNearStart ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Subsequent placed vertices
      if (state.type !== 'freehand') {
        ctx.fillStyle = '#60a5fa';
        for (let i = 1; i < state.points.length; i++) {
          const p = state.points[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5. Snapping Circle Indicator near cursor in Magnetic mode
    if (state.type === 'magnetic' && cursorPos) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, state.magnetic.snapRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [state, width, height, dashOffset, cursorPos, isNearStart]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`absolute inset-0 z-20 ${
        isSpacePressed ? 'cursor-grab' : isNearStart ? 'cursor-pointer' : 'cursor-crosshair'
      } touch-none`}
    />
  );
};
