/**
 * HealingOverlay.tsx
 */
import React from 'react';
import { HealingCanvas, HealingCanvasRef } from '../../HealingCanvas';
import { HealingSettings } from '../../healingEngine';
import { ImageRect, overlayStyle } from '../imageRect';

export interface HealingOverlayProps {
  rect: ImageRect;
  sourceImage: HTMLImageElement | null;
  imageSrc: string;
  settings: HealingSettings | undefined;
  canvasRef: React.Ref<HealingCanvasRef>;
  onStrokeComplete?: () => void;
  readOnly: boolean;
  pointerActive: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const HealingOverlay: React.FC<HealingOverlayProps> = (p) => (
  <div
    ref={p.containerRef}
    className={`absolute z-20 ${p.pointerActive ? '' : 'pointer-events-none'}`}
    style={overlayStyle(p.rect, { pointerEvents: p.pointerActive ? 'auto' : 'none' })}
  >
    <HealingCanvas
      ref={p.canvasRef}
      width={Math.round(p.rect.width)}
      height={Math.round(p.rect.height)}
      sourceImage={p.sourceImage}
      imageSrc={p.imageSrc}
      mode={p.settings?.mode || 'clone-stamp'}
      brushSize={p.settings?.brushSize || 30}
      hardness={p.settings?.hardness || 50}
      opacity={p.settings?.opacity || 100}
      onStrokeComplete={p.onStrokeComplete}
      readOnly={p.readOnly}
    />
  </div>
);
