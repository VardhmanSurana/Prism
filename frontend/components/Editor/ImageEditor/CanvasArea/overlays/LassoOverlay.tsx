/**
 * LassoOverlay.tsx
 */
import React from 'react';
import { LassoCanvas } from '../../LassoCanvas';
import { LassoState } from '../../lassoEngine';
import { ImageRect, overlayStyle } from '../imageRect';

export interface LassoOverlayProps {
  rect: ImageRect;
  imageSrc?: string;
  state: LassoState;
  onChange: (s: LassoState) => void;
  onSelectionComplete?: (mask: HTMLCanvasElement) => void;
  pointerActive: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const LassoOverlay: React.FC<LassoOverlayProps> = (p) => (
  <div
    ref={p.containerRef}
    className="absolute z-20"
    style={overlayStyle(p.rect, { pointerEvents: p.pointerActive ? 'auto' : 'none' })}
  >
    <LassoCanvas
      width={Math.round(p.rect.width)}
      height={Math.round(p.rect.height)}
      imageSrc={p.imageSrc}
      state={p.state}
      onChange={p.onChange}
      onSelectionComplete={p.onSelectionComplete}
    />
  </div>
);
