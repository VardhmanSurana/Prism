import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LassoState, Point2D, findMagneticEdgePoint, renderLassoPathToMask } from './lassoEngine';

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
  const [sourceImgData, setSourceImgData] = useState<ImageData | null>(null);

  // Load source image data for magnetic edge detection
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const temp = document.createElement('canvas');
      temp.width = width;
      temp.height = height;
      const ctx = temp.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        setSourceImgData(ctx.getImageData(0, 0, width, height));
      }
    };
    img.src = imageSrc;
  }, [imageSrc, width, height]);

  // Animated Marching Ants loop
  useEffect(() => {
    const timer = setInterval(() => {
      setDashOffset(prev => (prev + 1) % 10);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (state.points.length === 0) return;

    // Draw selection polygon outline
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(state.points[0].x, state.points[0].y);
    for (let i = 1; i < state.points.length; i++) {
      ctx.lineTo(state.points[i].x, state.points[i].y);
    }
    if (state.isClosed) ctx.closePath();
    ctx.stroke();

    // Marching Ants overlay line
    ctx.strokeStyle = '#000000';
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = dashOffset;
    ctx.stroke();
    ctx.restore();

    // Draw vertex points for polygonal/magnetic lasso
    if (state.type !== 'freehand') {
      ctx.fillStyle = '#3b82f6';
      for (const p of state.points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [state, width, height, dashOffset]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getCanvasCoords(e);

    if (state.type === 'freehand') {
      setIsDrawing(true);
      onChange({ ...state, points: [p], isClosed: false });
    } else if (state.type === 'polygonal' || state.type === 'magnetic') {
      let nextPoint = p;
      if (state.type === 'magnetic' && sourceImgData) {
        nextPoint = findMagneticEdgePoint(sourceImgData, p.x, p.y);
      }

      // Check if clicking near start point to close polygon
      if (state.points.length > 2) {
        const startP = state.points[0];
        if (Math.hypot(p.x - startP.x, p.y - startP.y) < 12) {
          const closedState = { ...state, isClosed: true };
          onChange(closedState);
          const mask = renderLassoPathToMask(closedState.points, width, height, state.feather);
          onSelectionComplete?.(mask);
          return;
        }
      }

      onChange({ ...state, points: [...state.points, nextPoint] });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing && state.type === 'freehand') return;

    const p = getCanvasCoords(e);

    if (state.type === 'freehand' && isDrawing) {
      onChange({ ...state, points: [...state.points, p] });
    } else if (state.type === 'magnetic' && isDrawing && sourceImgData) {
      const edgeP = findMagneticEdgePoint(sourceImgData, p.x, p.y);
      const lastP = state.points[state.points.length - 1];
      if (!lastP || Math.hypot(edgeP.x - lastP.x, edgeP.y - lastP.y) > 15) {
        onChange({ ...state, points: [...state.points, edgeP] });
      }
    }
  };

  const handlePointerUp = () => {
    if (state.type === 'freehand' && isDrawing) {
      setIsDrawing(false);
      const closedState = { ...state, isClosed: true };
      onChange(closedState);
      const mask = renderLassoPathToMask(closedState.points, width, height, state.feather);
      onSelectionComplete?.(mask);
    }
  };

  const handleDoubleClick = () => {
    if (state.points.length > 2) {
      const closedState = { ...state, isClosed: true };
      onChange(closedState);
      const mask = renderLassoPathToMask(closedState.points, width, height, state.feather);
      onSelectionComplete?.(mask);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className="absolute inset-0 z-20 cursor-crosshair touch-none"
    />
  );
};
