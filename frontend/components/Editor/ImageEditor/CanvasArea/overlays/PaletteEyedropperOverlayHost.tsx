/**
 * PaletteEyedropperOverlayHost.tsx
 */
import React from 'react';
import { PaletteEyedropperOverlay } from '../../PaletteEyedropperOverlay';
import { ImageRect, overlayStyle } from '../imageRect';

export interface PaletteEyedropperOverlayHostProps {
  rect: ImageRect;
  sourceImage: HTMLImageElement | null;
  imageSrc: string;
  targetSwatchIndex: number;
  onColorPicked: (hex: string, idx: number) => void;
  onCancel: () => void;
  pointerActive: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const PaletteEyedropperOverlayHost: React.FC<PaletteEyedropperOverlayHostProps> = (p) => (
  <div
    ref={p.containerRef}
    className="absolute z-30"
    style={overlayStyle(p.rect, { pointerEvents: p.pointerActive ? 'auto' : 'none' })}
  >
    <PaletteEyedropperOverlay
      width={Math.round(p.rect.width)}
      height={Math.round(p.rect.height)}
      sourceImage={p.sourceImage}
      imageSrc={p.imageSrc}
      targetSwatchIndex={p.targetSwatchIndex}
      onColorPicked={p.onColorPicked}
      onCancel={p.onCancel}
    />
  </div>
);
