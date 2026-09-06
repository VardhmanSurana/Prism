/**
 * FaceBBoxOverlayHost.tsx
 */
import React from 'react';
import { FaceBoundingBoxOverlay } from '@plugins/retouch-metadata-studio';
import type { FaceBBox } from '@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay';
import { ImageRect, overlayStyle } from '../imageRect';

export interface FaceBBoxOverlayHostProps {
  rect: ImageRect;
  faces: FaceBBox[];
  naturalWidth: number;
  naturalHeight: number;
  selectedFaceIndex: number | null;
  onSelectFace?: (i: number) => void;
  showLandmarks: boolean;
  active: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const FaceBBoxOverlayHost: React.FC<FaceBBoxOverlayHostProps> = (p) => (
  <div
    ref={p.containerRef}
    className="absolute z-20 pointer-events-none"
    style={overlayStyle(p.rect, { pointerEvents: 'none' })}
  >
    <FaceBoundingBoxOverlay
      faces={p.faces}
      naturalWidth={p.naturalWidth}
      naturalHeight={p.naturalHeight}
      containerWidth={Math.round(p.rect.width)}
      containerHeight={Math.round(p.rect.height)}
      selectedFaceIndex={p.selectedFaceIndex}
      onSelectFace={p.onSelectFace}
      showLandmarks={p.showLandmarks}
      active={p.active}
    />
  </div>
);
