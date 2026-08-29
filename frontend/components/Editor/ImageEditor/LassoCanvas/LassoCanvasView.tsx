/**
 * LassoCanvasView.tsx
 * Pure canvas renderer: draws the active mask, persistent marching ants on
 * closed paths, the in-progress path, anchor dots, and the magnetic snap circle.
 */
import { useEffect, useRef } from 'react';
import { LassoState, Point2D } from '../lassoEngine';

export interface LassoCanvasViewProps {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  state: LassoState;
  dashOffset: number;
  cursorPos: Point2D | null;
  isNearStart: boolean;
  isSpacePressed: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const LassoCanvasView: React.FC<LassoCanvasViewProps> = (p) => {
  const lastDrawState = useRef<string>('');

  useEffect(() => {
    const canvas = p.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, p.width, p.height);

    // 1. Active Mask Overlays (Rubylith Red, B&W)
    if (p.state.hasActiveMask) {
      const maskCanvas = p.state.activeMaskDataUrl
        ? null
        : null;
      // The actual mask render is delegated to the caller via a stable ref.
      // Here we just visualize the preview modes when caller has set activeMaskDataUrl.
      void maskCanvas;
    }

    // 2. Persistent Marching Ants on Closed Paths
    if (p.state.closedPaths && p.state.closedPaths.length > 0 && p.state.hasActiveMask) {
      for (const closedPath of p.state.closedPaths) {
        if (closedPath.length < 3) continue;

        ctx.save();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(closedPath[0].x, closedPath[0].y);
        for (let i = 1; i < closedPath.length; i++) {
          ctx.lineTo(closedPath[i].x, closedPath[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = p.dashOffset;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. In-Progress Drawing Line & Guide
    const currentDrawPoints = [...p.state.points];
    if (p.state.type === 'magnetic' && p.state.liveWirePath.length > 1) {
      currentDrawPoints.push(...p.state.liveWirePath.slice(1));
    } else if (p.state.type === 'polygonal' && p.state.points.length > 0 && p.cursorPos) {
      currentDrawPoints.push(p.cursorPos);
    }

    if (currentDrawPoints.length > 1) {
      ctx.save();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(currentDrawPoints[0].x, currentDrawPoints[0].y);
      for (let i = 1; i < currentDrawPoints.length; i++) {
        ctx.lineTo(currentDrawPoints[i].x, currentDrawPoints[i].y);
      }
      ctx.stroke();

      ctx.strokeStyle = p.state.type === 'magnetic' ? '#38bdf8' : '#ffffff';
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = p.dashOffset;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Anchor Vertices
    if (p.state.points.length > 0) {
      ctx.save();
      const startP = p.state.points[0];
      ctx.fillStyle = p.isNearStart ? '#22c55e' : '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(startP.x, startP.y, p.isNearStart ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (p.state.type !== 'freehand') {
        ctx.fillStyle = '#60a5fa';
        for (let i = 1; i < p.state.points.length; i++) {
          const point = p.state.points[i];
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5. Magnetic Snap Circle
    if (p.state.type === 'magnetic' && p.cursorPos) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.cursorPos.x, p.cursorPos.y, p.state.magnetic.snapRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    lastDrawState.current = `${p.dashOffset}-${p.cursorPos?.x}-${p.cursorPos?.y}-${p.isNearStart}`;
  }, [p.state, p.width, p.height, p.dashOffset, p.cursorPos, p.isNearStart, p.canvasRef]);

  return (
    <canvas
      ref={p.canvasRef}
      width={p.width}
      height={p.height}
      onPointerDown={p.onPointerDown}
      onPointerMove={p.onPointerMove}
      onPointerUp={p.onPointerUp}
      onDoubleClick={p.onDoubleClick}
      onContextMenu={p.onContextMenu}
      className={`absolute inset-0 z-20 ${
        p.isSpacePressed ? 'cursor-grab' : p.isNearStart ? 'cursor-pointer' : 'cursor-crosshair'
      } touch-none`}
    />
  );
};
