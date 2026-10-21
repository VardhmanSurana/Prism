/**
 * useLassoPointer.ts
 * Pointer down/move/up handlers for freehand, polygonal, and magnetic lasso
 * with rAF-throttled live-wire pathfinding.
 */
import { useCallback, useRef, useState } from 'react';
import { LassoState, Point2D, findIntelligentScissorsPath, findMagneticEdgePoint, isPointNearPoint, LiveWireCostMap } from '../lassoEngine';

export interface UseLassoPointerParams {
  width: number;
  height: number;
  state: LassoState;
  onChange: (s: LassoState) => void;
  isSpacePressed: boolean;
  sourceImgData: ImageData | null;
  costMap: LiveWireCostMap | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  commitSelection: (points: Point2D[]) => void;
}

export interface UseLassoPointerApi {
  isDrawing: boolean;
  setIsDrawing: (v: boolean) => void;
  cursorPos: Point2D | null;
  isNearStart: boolean;
  setIsNearStart: (v: boolean) => void;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: () => void;
  handleDoubleClick: () => void;
  handleContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export function useLassoPointer(p: UseLassoPointerParams): UseLassoPointerApi {
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [isNearStart, setIsNearStart] = useState(false);
  const pathCalcRafRef = useRef<number | null>(null);

  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
      const canvas = p.canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = p.width / rect.width;
      const scaleY = p.height / rect.height;
      return {
        x: Math.max(0, Math.min(p.width, (e.clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(p.height, (e.clientY - rect.top) * scaleY)),
      };
    },
    [p.canvasRef, p.width, p.height],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (p.isSpacePressed) return;
      const point = getCanvasCoords(e);

      if (p.state.type === 'freehand') {
        setIsDrawing(true);
        p.onChange({ ...p.state, points: [point], liveWirePath: [], isClosed: false });
        return;
      }

      let anchorPoint = point;
      if (p.state.type === 'magnetic' && p.sourceImgData) {
        anchorPoint = findMagneticEdgePoint(
          p.sourceImgData,
          point.x,
          point.y,
          p.state.magnetic.snapRadius,
        );
      }

      if (p.state.points.length >= 3 && isPointNearPoint(point, p.state.points[0], 14)) {
        p.commitSelection(p.state.points);
        return;
      }

      if (p.state.type === 'magnetic' && p.state.points.length > 0 && p.state.liveWirePath.length > 0) {
        const fullPath = [...p.state.points, ...p.state.liveWirePath.slice(1)];
        p.onChange({
          ...p.state,
          points: fullPath,
          liveWirePath: [],
        });
        setIsDrawing(true);
        return;
      }

      p.onChange({
        ...p.state,
        points: [...p.state.points, anchorPoint],
        liveWirePath: [],
      });
      setIsDrawing(true);
    },
    [p, getCanvasCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = getCanvasCoords(e);
      setCursorPos(point);

      if (p.state.points.length >= 3 && isPointNearPoint(point, p.state.points[0], 14)) {
        setIsNearStart(true);
      } else {
        setIsNearStart(false);
      }

      if (p.state.type === 'freehand' && isDrawing) {
        const lastP = p.state.points[p.state.points.length - 1];
        if (!lastP || Math.hypot(point.x - lastP.x, point.y - lastP.y) >= 2) {
          p.onChange({ ...p.state, points: [...p.state.points, point] });
        }
        return;
      }

      if (p.state.type === 'magnetic' && p.state.points.length > 0 && p.costMap && !p.isSpacePressed) {
        if (pathCalcRafRef.current) cancelAnimationFrame(pathCalcRafRef.current);
        const costMap = p.costMap;
        pathCalcRafRef.current = requestAnimationFrame(() => {
          const lastAnchor = p.state.points[p.state.points.length - 1];
          let target = point;
          if (p.sourceImgData) {
            target = findMagneticEdgePoint(p.sourceImgData, point.x, point.y, p.state.magnetic.snapRadius);
          }
          const wire = findIntelligentScissorsPath(costMap, lastAnchor, target);

          if (
            p.state.magnetic.autoAnchor &&
            wire.length > 4 &&
            Math.hypot(target.x - lastAnchor.x, target.y - lastAnchor.y) > p.state.magnetic.autoAnchorDistance
          ) {
            p.onChange({
              ...p.state,
              points: [...p.state.points, ...wire.slice(1)],
              liveWirePath: [],
            });
          } else {
            p.onChange({
              ...p.state,
              liveWirePath: wire,
            });
          }
        });
      }
    },
    [p, isDrawing, getCanvasCoords],
  );

  const handlePointerUp = useCallback(() => {
    if (p.state.type === 'freehand' && isDrawing) {
      if (p.state.points.length >= 3) {
        p.commitSelection(p.state.points);
      } else {
        setIsDrawing(false);
      }
    }
  }, [p, isDrawing]);

  const handleDoubleClick = useCallback(() => {
    if (p.state.points.length >= 3) {
      p.commitSelection(p.state.points);
    }
  }, [p]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (p.state.points.length > 0) {
        p.onChange({
          ...p.state,
          points: p.state.points.slice(0, -1),
          liveWirePath: [],
        });
      }
    },
    [p],
  );

  return {
    isDrawing,
    setIsDrawing,
    cursorPos,
    isNearStart,
    setIsNearStart,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleContextMenu,
  };
}
