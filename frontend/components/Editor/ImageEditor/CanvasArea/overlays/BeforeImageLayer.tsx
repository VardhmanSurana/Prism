/**
 * BeforeImageLayer.tsx
 * Static (non-canvas) image shown behind the live canvas during compare mode.
 */
import React from 'react';
import { Adjustments } from '../../filterEngine';
import { ImageRect, overlayStyle } from '../imageRect';

export interface BeforeImageLayerProps {
  rect: ImageRect;
  src: string;
  adjustments: Adjustments;
  beforeImageRef: React.MutableRefObject<HTMLImageElement | null>;
}

export const BeforeImageLayer: React.FC<BeforeImageLayerProps> = (p) => {
  const transform =
    p.adjustments.perspective !== 0 || p.adjustments.verticalPerspective !== 0
      ? `perspective(1000px) rotateY(${p.adjustments.perspective * 0.3}deg) rotateX(${p.adjustments.verticalPerspective * 0.3}deg)`
      : undefined;

  return (
    <img
      ref={p.beforeImageRef}
      src={p.src}
      alt="Original"
      className="absolute pointer-events-none z-0 object-contain select-none"
      style={overlayStyle(p.rect, { transform })}
      crossOrigin="anonymous"
    />
  );
};
