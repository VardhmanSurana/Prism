/**
 * LiquifyOverlay.tsx
 */
import React from 'react';
import { LiquifyCanvas, LiquifyCanvasRef } from '../../LiquifyCanvas';
import { LiquifySettings } from '../../liquifyEngine';
import { ImageRect, overlayStyle } from '../imageRect';
import { FaceBBox } from '@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay';

export interface LiquifyOverlayProps {
  rect: ImageRect;
  sourceImage: HTMLImageElement | null;
  imageSrc: string;
  settings: LiquifySettings | undefined;
  faces?: FaceBBox[];
  selectedFaceIndex: number | null;
  canvasRef: React.Ref<LiquifyCanvasRef>;
  readOnly: boolean;
  visible: boolean;
  pointerActive: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const LiquifyOverlay: React.FC<LiquifyOverlayProps> = (p) => (
  <div
    ref={p.containerRef}
    className={`absolute z-30 ${p.pointerActive ? '' : 'pointer-events-none hidden'}`}
    style={overlayStyle(p.rect, {
      pointerEvents: p.pointerActive ? 'auto' : 'none',
      display: p.visible ? 'block' : 'none',
      zIndex: 30,
    })}
  >
    <LiquifyCanvas
      ref={p.canvasRef}
      width={Math.round(p.rect.width)}
      height={Math.round(p.rect.height)}
      sourceImage={p.sourceImage}
      imageSrc={p.imageSrc}
      settings={p.settings ?? { mode: 'warp', brushSize: 80, pressure: 50, face: { eyeSize: 0, eyeDistance: 0, noseWidth: 0, lipHeight: 0, chinShape: 0 } }}
      faces={p.faces ?? []}
      selectedFaceIndex={p.selectedFaceIndex}
      readOnly={p.readOnly}
    />
  </div>
);
