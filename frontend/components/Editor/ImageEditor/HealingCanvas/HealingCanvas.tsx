/**
 * HealingCanvas.tsx
 * High-performance Clone Stamp, Healing Brush, Frequency Separation, Patch, and Dodge/Burn canvas overlay.
 */

import React, { useImperativeHandle, forwardRef } from 'react';
import { HealingCanvasRef, HealingCanvasProps } from './types';
import { useHealingPainting } from './useHealingPainting';
import { HealingCursorRing, HealingSourceIndicator, HealingHelperBanner } from './indicators';

export const HealingCanvas = forwardRef<HealingCanvasRef, HealingCanvasProps>(({
  width,
  height,
  sourceImage,
  imageSrc,
  mode = 'clone-stamp',
  brushSize = 30,
  hardness = 50,
  opacity = 100,
  onStrokeComplete,
  readOnly = false,
}, ref) => {
  const {
    canvasRef,
    workCanvasRef,
    sourceAnchor,
    setSourceAnchor,
    liveSourcePos,
    setLiveSourcePos,
    cursorPos,
    setCursorPos,
    isAltHeld,
    hasDrawnStrokes,
    setHasDrawnStrokes,
    sourceAnchorRef,
    lastSampledPosRef,
    strokeOffsetRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useHealingPainting({
    width,
    height,
    sourceImage,
    imageSrc,
    mode,
    brushSize,
    hardness,
    opacity,
    onStrokeComplete,
  });

  // ── Imperative Ref Handle ───────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getCompositeDataUrl: (srcImg: HTMLImageElement) => {
      if (srcImg.naturalWidth <= 0 || srcImg.naturalHeight <= 0) return '';
      const out = document.createElement('canvas');
      out.width = srcImg.naturalWidth;
      out.height = srcImg.naturalHeight;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(srcImg, 0, 0);
      if (workCanvasRef.current && workCanvasRef.current.width > 0 && workCanvasRef.current.height > 0) {
        ctx.drawImage(workCanvasRef.current, 0, 0, srcImg.naturalWidth, srcImg.naturalHeight);
      }
      return out.toDataURL('image/png');
    },
    getWorkCanvas: () => {
      const wc = workCanvasRef.current;
      return (hasDrawnStrokes && wc && wc.width > 0 && wc.height > 0) ? wc : null;
    },
    clearStrokes: () => {
      const wc = workCanvasRef.current;
      if (wc) {
        const ctx = wc.getContext('2d')!;
        ctx.clearRect(0, 0, wc.width, wc.height);
      }
      const dc = canvasRef.current;
      if (dc) {
        const ctx = dc.getContext('2d')!;
        ctx.clearRect(0, 0, dc.width, dc.height);
      }
      sourceAnchorRef.current = null;
      lastSampledPosRef.current = null;
      strokeOffsetRef.current = null;
      setSourceAnchor(null);
      setLiveSourcePos(null);
      setHasDrawnStrokes(false);
    },
    hasStrokes: () => hasDrawnStrokes,
  }));

  const cursorStyle = isAltHeld ? 'crosshair' : 'crosshair';

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: readOnly ? 'none' : 'auto',
        touchAction: readOnly ? 'auto' : 'none',
      }}
    >
      {/* Interactive Display Canvas */}
      <canvas
        ref={canvasRef}
        width={Number.isFinite(width) && width > 0 ? Math.round(width) : 1}
        height={Number.isFinite(height) && height > 0 ? Math.round(height) : 1}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: readOnly ? 'default' : cursorStyle,
          pointerEvents: readOnly ? 'none' : 'auto',
          touchAction: readOnly ? 'auto' : 'none',
        }}
        onPointerDown={readOnly ? undefined : handlePointerDown}
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : handlePointerUp}
        onPointerCancel={readOnly ? undefined : handlePointerUp}
        onPointerLeave={() => {
          setCursorPos(null);
        }}
      />

      {/* Target Brush Cursor Ring */}
      {!readOnly && (
        <HealingCursorRing
          cursorPos={cursorPos}
          brushSize={brushSize}
          isAltHeld={isAltHeld}
        />
      )}

      {/* Live Sample Source Indicator Crosshair & Ring */}
      {!readOnly && (
        <HealingSourceIndicator
          liveSourcePos={liveSourcePos}
          brushSize={brushSize}
          mode={mode}
        />
      )}

      {/* Helper Banner & Active Source Status Badge */}
      {!readOnly && (
        <HealingHelperBanner
          sourceAnchor={sourceAnchor}
          isAltHeld={isAltHeld}
          mode={mode}
        />
      )}
    </div>
  );
});

HealingCanvas.displayName = 'HealingCanvas';

