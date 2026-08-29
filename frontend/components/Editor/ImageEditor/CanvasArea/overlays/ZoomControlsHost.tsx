/**
 * ZoomControlsHost.tsx
 */
import React from 'react';
import { ZoomControls } from '../../ZoomControls';

export interface ZoomControlsHostProps {
  visible: boolean;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomTo: (pct: number) => void;
}

export const ZoomControlsHost: React.FC<ZoomControlsHostProps> = (p) =>
  p.visible ? (
    <ZoomControls
      zoomPercent={p.zoomPercent}
      onZoomIn={p.onZoomIn}
      onZoomOut={p.onZoomOut}
      onReset={p.onReset}
      onZoomTo={p.onZoomTo}
      minZoom={10}
      maxZoom={500}
    />
  ) : null;
