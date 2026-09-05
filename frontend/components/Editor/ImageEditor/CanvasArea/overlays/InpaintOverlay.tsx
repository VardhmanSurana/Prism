/**
 * InpaintOverlay.tsx
 */
import React from 'react';
import { InpaintCanvas } from '@plugins/ai-vision-studio';
import type { InpaintCanvasHandle, InpaintMode } from '@plugins/ai-vision-studio';
import { ImageRect, overlayStyle } from '../imageRect';

export interface InpaintOverlayProps {
  rect: ImageRect;
  imageUrl: string;
  mode: InpaintMode;
  brushSize: number;
  brushHardness?: number;
  canvasRef: React.Ref<InpaintCanvasHandle>;
  onMaskChange: (mask: string) => void;
  onStrokeComplete?: (mask: string) => void;
  onInteractivePointsChange?: (pts: Array<{ x: number; y: number; positive: boolean }>) => void;
  showMaskPreview: boolean;
  maskOpacity: number;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const InpaintOverlay: React.FC<InpaintOverlayProps> = (p) => (
  <div ref={p.containerRef} className="absolute z-30" style={overlayStyle(p.rect, { pointerEvents: 'auto' })}>
    <InpaintCanvas
      ref={p.canvasRef}
      imageUrl={p.imageUrl}
      mode={p.mode}
      brushSize={p.brushSize}
      brushHardness={p.brushHardness}
      onMaskChange={p.onMaskChange}
      onStrokeComplete={p.onStrokeComplete}
      onInteractivePointsChange={p.onInteractivePointsChange}
      showMaskPreview={p.showMaskPreview}
      maskOpacity={p.maskOpacity}
    />
  </div>
);
