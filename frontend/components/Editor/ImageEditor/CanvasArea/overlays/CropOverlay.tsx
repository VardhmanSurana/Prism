/**
 * CropOverlay.tsx
 * Native in-app crop overlay with 8 interactive resize handles, rule-of-thirds grid,
 * aspect-ratio locking, and darkened backdrop scrim. Replaces legacy Cropper.js.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ImageRect } from '../imageRect';

export interface CropNormalizedRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

export interface CropOverlayProps {
  rect: ImageRect;
  cropRect: CropNormalizedRect;
  onCropChange: (crop: CropNormalizedRect) => void;
  aspectRatio?: number; // ratio (w/h) or NaN for freeform
  visible: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | null;

const MIN_PIXELS = 24;

export const CropOverlay: React.FC<CropOverlayProps> = ({
  rect,
  cropRect,
  onCropChange,
  aspectRatio = NaN,
  visible,
  naturalWidth = 1000,
  naturalHeight = 1000,
}) => {
  const [activeDrag, setActiveDrag] = useState<DragMode>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialBox: { left: number; top: number; width: number; height: number };
  } | null>(null);

  const isValid = visible && !!rect && rect.width > 0 && rect.height > 0;
  const safeWidth = isValid ? rect.width : 1;
  const safeHeight = isValid ? rect.height : 1;

  // Convert normalized crop coordinates to pixel coordinates within the image rect
  const boxLeft = isValid ? Math.max(0, Math.min(safeWidth, cropRect.x * safeWidth)) : 0;
  const boxTop = isValid ? Math.max(0, Math.min(safeHeight, cropRect.y * safeHeight)) : 0;
  const boxWidth = isValid ? Math.max(MIN_PIXELS, Math.min(safeWidth - boxLeft, cropRect.width * safeWidth)) : 0;
  const boxHeight = isValid ? Math.max(MIN_PIXELS, Math.min(safeHeight - boxTop, cropRect.height * safeHeight)) : 0;

  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setActiveDrag(mode);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialBox: { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight },
    };
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const { pointerX, pointerY, initialBox } = dragStartRef.current;
      const dx = e.clientX - pointerX;
      const dy = e.clientY - pointerY;

      let newLeft = initialBox.left;
      let newTop = initialBox.top;
      let newWidth = initialBox.width;
      let newHeight = initialBox.height;

      if (activeDrag === 'move') {
        newLeft = Math.max(0, Math.min(rect.width - initialBox.width, initialBox.left + dx));
        newTop = Math.max(0, Math.min(rect.height - initialBox.height, initialBox.top + dy));
      } else {
        // Horizontal adjustment
        if (activeDrag === 'nw' || activeDrag === 'w' || activeDrag === 'sw') {
          const maxLeftShift = initialBox.left;
          const clampedDx = Math.min(maxLeftShift, Math.max(-initialBox.left, dx));
          newLeft = initialBox.left + clampedDx;
          newWidth = initialBox.width - clampedDx;
        } else if (activeDrag === 'ne' || activeDrag === 'e' || activeDrag === 'se') {
          newWidth = Math.min(rect.width - initialBox.left, initialBox.width + dx);
        }

        // Vertical adjustment
        if (activeDrag === 'nw' || activeDrag === 'n' || activeDrag === 'ne') {
          const maxTopShift = initialBox.top;
          const clampedDy = Math.min(maxTopShift, Math.max(-initialBox.top, dy));
          newTop = initialBox.top + clampedDy;
          newHeight = initialBox.height - clampedDy;
        } else if (activeDrag === 'sw' || activeDrag === 's' || activeDrag === 'se') {
          newHeight = Math.min(rect.height - initialBox.top, initialBox.height + dy);
        }

        // Aspect ratio enforcement
        if (!isNaN(aspectRatio) && aspectRatio > 0) {
          const targetAspect = aspectRatio; // (w / h) in natural dimensions
          const pixelAspect = targetAspect * (rect.width / naturalWidth) / (rect.height / naturalHeight);

          if (activeDrag === 'e' || activeDrag === 'w') {
            newHeight = newWidth / pixelAspect;
          } else if (activeDrag === 'n' || activeDrag === 's') {
            newWidth = newHeight * pixelAspect;
          } else {
            // Diagonal resize: adjust height to match width
            newHeight = newWidth / pixelAspect;
          }

          // Bound within image rect
          if (newLeft + newWidth > rect.width) {
            newWidth = rect.width - newLeft;
            newHeight = newWidth / pixelAspect;
          }
          if (newTop + newHeight > rect.height) {
            newHeight = rect.height - newTop;
            newWidth = newHeight * pixelAspect;
          }
        }

        // Enforce minimum sizes
        if (newWidth < MIN_PIXELS) newWidth = MIN_PIXELS;
        if (newHeight < MIN_PIXELS) newHeight = MIN_PIXELS;
      }

      onCropChange({
        x: newLeft / rect.width,
        y: newTop / rect.height,
        width: newWidth / rect.width,
        height: newHeight / rect.height,
      });
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, rect, aspectRatio, naturalWidth, naturalHeight, onCropChange]);

  if (!isValid) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-auto select-none z-30 overflow-hidden"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      {/* 4 Darkened Scrim Areas surrounding the crop box */}
      {/* Top */}
      <div
        className="absolute bg-black/60 backdrop-blur-[0.5px]"
        style={{ left: 0, top: 0, right: 0, height: boxTop }}
      />
      {/* Bottom */}
      <div
        className="absolute bg-black/60 backdrop-blur-[0.5px]"
        style={{ left: 0, top: boxTop + boxHeight, right: 0, bottom: 0 }}
      />
      {/* Left */}
      <div
        className="absolute bg-black/60 backdrop-blur-[0.5px]"
        style={{ left: 0, top: boxTop, width: boxLeft, height: boxHeight }}
      />
      {/* Right */}
      <div
        className="absolute bg-black/60 backdrop-blur-[0.5px]"
        style={{ left: boxLeft + boxWidth, top: boxTop, right: 0, height: boxHeight }}
      />

      {/* The Active Crop Box */}
      <div
        className="absolute border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
        style={{
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
        }}
        onPointerDown={(e) => handlePointerDown('move', e)}
      >
        {/* Rule-of-Thirds Grid */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
          <div className="border-r border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-r border-b border-white/25" />
          <div className="border-b border-white/25" />
          <div className="border-r border-white/25" />
          <div className="border-r border-white/25" />
          <div />
        </div>

        {/* 4 Corner L-Bracket Handles */}
        {/* Top-Left (NW) */}
        <div
          className="absolute -left-1.5 -top-1.5 w-4 h-4 border-t-2 border-l-2 border-white cursor-nw-resize z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => handlePointerDown('nw', e)}
        />
        {/* Top-Right (NE) */}
        <div
          className="absolute -right-1.5 -top-1.5 w-4 h-4 border-t-2 border-r-2 border-white cursor-ne-resize z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => handlePointerDown('ne', e)}
        />
        {/* Bottom-Right (SE) */}
        <div
          className="absolute -right-1.5 -bottom-1.5 w-4 h-4 border-b-2 border-r-2 border-white cursor-se-resize z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => handlePointerDown('se', e)}
        />
        {/* Bottom-Left (SW) */}
        <div
          className="absolute -left-1.5 -bottom-1.5 w-4 h-4 border-b-2 border-l-2 border-white cursor-sw-resize z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => handlePointerDown('sw', e)}
        />

        {/* 4 Midpoint Bar Handles */}
        {/* Top (N) */}
        <div
          className="absolute left-1/2 -top-1 -translate-x-1/2 w-5 h-1.5 bg-white/90 rounded-full cursor-n-resize drop-shadow"
          onPointerDown={(e) => handlePointerDown('n', e)}
        />
        {/* Bottom (S) */}
        <div
          className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-5 h-1.5 bg-white/90 rounded-full cursor-s-resize drop-shadow"
          onPointerDown={(e) => handlePointerDown('s', e)}
        />
        {/* Left (W) */}
        <div
          className="absolute top-1/2 -left-1 -translate-y-1/2 h-5 w-1.5 bg-white/90 rounded-full cursor-w-resize drop-shadow"
          onPointerDown={(e) => handlePointerDown('w', e)}
        />
        {/* Right (E) */}
        <div
          className="absolute top-1/2 -right-1 -translate-y-1/2 h-5 w-1.5 bg-white/90 rounded-full cursor-e-resize drop-shadow"
          onPointerDown={(e) => handlePointerDown('e', e)}
        />
      </div>
    </div>
  );
};

