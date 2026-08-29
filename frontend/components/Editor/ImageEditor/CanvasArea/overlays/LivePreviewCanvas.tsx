/**
 * LivePreviewCanvas.tsx
 * The high-quality canvas overlay that draws the filtered preview every tick.
 */
import React from 'react';
import { Adjustments } from '../../filterEngine';
import { ImageRect, overlayStyle } from '../imageRect';

export interface LivePreviewCanvasProps {
  rect: ImageRect;
  sourceWidth: number;
  sourceHeight: number;
  adjustments: Adjustments;
  hasDrawn: boolean;
  comparePercent: number | null;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

export const LivePreviewCanvas: React.FC<LivePreviewCanvasProps> = (p) => {
  const transform =
    p.adjustments.perspective !== 0 || p.adjustments.verticalPerspective !== 0
      ? `perspective(1000px) rotateY(${p.adjustments.perspective * 0.3}deg) rotateX(${p.adjustments.verticalPerspective * 0.3}deg)`
      : undefined;

  return (
    <canvas
      ref={p.canvasRef}
      width={p.sourceWidth || 1}
      height={p.sourceHeight || 1}
      className={`absolute pointer-events-none z-10 ${
        p.adjustments.background?.enabled && p.adjustments.background?.backdrop === 'transparent'
          ? 'transparency-checkerboard'
          : ''
      }`}
      style={overlayStyle(p.rect, {
        opacity: p.hasDrawn ? 1 : 0,
        transform,
        clipPath: p.comparePercent !== null
          ? `polygon(${p.comparePercent}% 0, 100% 0, 100% 100%, ${p.comparePercent}% 100%)`
          : undefined,
      })}
    />
  );
};
