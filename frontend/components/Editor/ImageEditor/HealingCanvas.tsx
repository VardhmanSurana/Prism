/**
 * HealingCanvas.tsx
 * Session-only Clone Stamp and Healing Brush overlay.
 *
 * How it works:
 *  - Clone Stamp: Alt+click to set source point, then paint to copy pixels from source
 *  - Healing Brush: Like clone stamp but with soft-edge blending (feathered compositing)
 *  - Changes live only in the current session — they are rendered as a canvas overlay
 *    on top of the main image. On export, strokes are composited into the final image.
 *
 * Architecture note: Pure Canvas2D pixel operations — no SVG filters, no AI backend needed.
 */

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';

export type HealingToolMode = 'clone-stamp' | 'healing-brush' | 'frequency-separation' | 'content-patch' | 'dodge-burn';

export interface HealingCanvasRef {
  /** Returns a data URL of all healing strokes applied to the source image */
  getCompositeDataUrl: (sourceImage: HTMLImageElement) => string;
  /** Clear all strokes */
  clearStrokes: () => void;
  /** Check if there are any strokes */
  hasStrokes: () => boolean;
}

interface HealingCanvasProps {
  /** Rendered width/height of the overlay (matches the displayed image rect) */
  width: number;
  height: number;
  /** The source image for sampling */
  sourceImage: HTMLImageElement | null;
  mode: HealingToolMode;
  brushSize: number;
  hardness: number; // 0-100
  opacity: number;  // 0-100
  onStrokeComplete?: () => void;
}

export const HealingCanvas = forwardRef<HealingCanvasRef, HealingCanvasProps>(({
  width,
  height,
  sourceImage,
  mode,
  brushSize,
  hardness,
  opacity,
  onStrokeComplete,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null); // Offline canvas with strokes
  const sourcePointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPaintPointRef = useRef<{ x: number; y: number } | null>(null);
  const isPaintingRef = useRef(false);
  const [sourcePoint, setSourcePoint] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isAltHeld, setIsAltHeld] = useState(false);

  // Initialize offline work canvas
  useEffect(() => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    workCanvasRef.current = document.createElement('canvas');
    workCanvasRef.current.width = w;
    workCanvasRef.current.height = h;
  }, [width, height]);

  // Sync display canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    // Redraw work canvas onto display canvas
    const ctx = canvas.getContext('2d');
    if (ctx && workCanvasRef.current) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(workCanvasRef.current, 0, 0);
    }
  }, [width, height]);

  // Track Alt key for source point selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Convert canvas coordinates (display) → source image coordinates
  const toImageCoords = useCallback((cx: number, cy: number) => {
    if (!sourceImage) return { x: cx, y: cy };
    const scaleX = sourceImage.naturalWidth / width;
    const scaleY = sourceImage.naturalHeight / height;
    return { x: cx * scaleX, y: cy * scaleY };
  }, [sourceImage, width, height]);

  // Convert image coords → canvas coords
  const toCanvasCoords = useCallback((ix: number, iy: number) => {
    if (!sourceImage) return { x: ix, y: iy };
    const scaleX = width / sourceImage.naturalWidth;
    const scaleY = height / sourceImage.naturalHeight;
    return { x: ix * scaleX, y: iy * scaleY };
  }, [sourceImage, width, height]);

  // ── Core painting function ────────────────────────────────────────────────

  const paintAt = useCallback((canvasX: number, canvasY: number) => {
    const workCanvas = workCanvasRef.current;
    const displayCanvas = canvasRef.current;
    if (!workCanvas || !displayCanvas || !sourceImage || !sourcePointRef.current) return;

    const srcPt = sourcePointRef.current;
    const lastPt = lastPaintPointRef.current;

    // Calculate offset from last paint point to track relative source movement
    let offsetX = 0, offsetY = 0;
    if (lastPt) {
      offsetX = canvasX - lastPt.x;
      offsetY = canvasY - lastPt.y;
    }
    lastPaintPointRef.current = { x: canvasX, y: canvasY };

    // Determine the source sample position (follows cursor proportionally)
    const currentSrcX = srcPt.x + (lastPt ? (canvasX - lastPaintPointRef.current!.x + offsetX) : 0);
    const currentSrcY = srcPt.y + (lastPt ? (canvasY - lastPaintPointRef.current!.y + offsetY) : 0);

    // Create an offscreen canvas for sampling
    const sampleCanvas = document.createElement('canvas');
    const sampleSize = brushSize * 2;
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return;

    // Draw source patch from the source image (scaled to display coords)
    const imgScaleX = width / sourceImage.naturalWidth;
    const imgScaleY = height / sourceImage.naturalHeight;

    sCtx.drawImage(
      sourceImage,
      (srcPt.x / imgScaleX) - brushSize / imgScaleX,
      (srcPt.y / imgScaleY) - brushSize / imgScaleY,
      sampleSize / imgScaleX,
      sampleSize / imgScaleY,
      0, 0, sampleSize, sampleSize
    );

    // Build a radial feather mask
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = sampleSize;
    alphaCanvas.height = sampleSize;
    const aCtx = alphaCanvas.getContext('2d')!;
    const hardnessRatio = hardness / 100;
    const innerRadius = brushSize * hardnessRatio;
    const outerRadius = brushSize;

    const grad = aCtx.createRadialGradient(brushSize, brushSize, innerRadius, brushSize, brushSize, outerRadius);
    grad.addColorStop(0, `rgba(255,255,255,${opacity / 100})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    aCtx.fillStyle = grad;
    aCtx.fillRect(0, 0, sampleSize, sampleSize);

    // Apply alpha mask to sample
    sCtx.globalCompositeOperation = 'destination-in';
    sCtx.drawImage(alphaCanvas, 0, 0);
    sCtx.globalCompositeOperation = 'source-over';

    // For healing brush: blend with underlying image content
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return;

    if (mode === 'healing-brush') {
      // Healing: first draw source patch, then blend using luminosity
      workCtx.globalCompositeOperation = 'luminosity';
    } else {
      workCtx.globalCompositeOperation = 'source-over';
    }

    workCtx.drawImage(
      sampleCanvas,
      canvasX - brushSize,
      canvasY - brushSize,
      sampleSize,
      sampleSize
    );

    workCtx.globalCompositeOperation = 'source-over';

    // Sync to display canvas
    const dCtx = displayCanvas.getContext('2d');
    if (dCtx) {
      dCtx.clearRect(0, 0, width, height);
      dCtx.drawImage(workCanvas, 0, 0);
    }
  }, [sourceImage, brushSize, hardness, opacity, mode, width]);

  // ── Source point display — draw a cross at source point location ──────────

  const drawSourceIndicator = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourcePointRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = sourcePointRef.current;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    const crossSize = 10;
    ctx.beginPath();
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x + crossSize, y);
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [brushSize]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getPos(e);

    if (isAltHeld || e.altKey) {
      // Set source point
      e.preventDefault();
      sourcePointRef.current = pos;
      setSourcePoint(pos);
      return;
    }

    if (!sourcePointRef.current) return; // Must set source point first

    isPaintingRef.current = true;
    lastPaintPointRef.current = pos;
    paintAt(pos.x, pos.y);
  }, [isAltHeld, getPos, paintAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    setCursorPos(pos);

    if (!isPaintingRef.current) return;
    paintAt(pos.x, pos.y);
  }, [getPos, paintAt]);

  const handleMouseUp = useCallback(() => {
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      lastPaintPointRef.current = null;
      onStrokeComplete?.();
    }
  }, [onStrokeComplete]);

  // ── Ref API ───────────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    getCompositeDataUrl: (srcImg: HTMLImageElement) => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = srcImg.naturalWidth;
      outCanvas.height = srcImg.naturalHeight;
      const ctx = outCanvas.getContext('2d')!;
      ctx.drawImage(srcImg, 0, 0);
      if (workCanvasRef.current) {
        ctx.drawImage(workCanvasRef.current, 0, 0, srcImg.naturalWidth, srcImg.naturalHeight);
      }
      return outCanvas.toDataURL('image/png');
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
      sourcePointRef.current = null;
      setSourcePoint(null);
    },
    hasStrokes: () => {
      const wc = workCanvasRef.current;
      if (!wc) return false;
      const ctx = wc.getContext('2d', { willReadFrequently: true })!;
      const data = ctx.getImageData(0, 0, wc.width, wc.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    },
  }));

  const cursorStyle = isAltHeld
    ? 'crosshair'
    : sourcePoint
      ? 'cell'
      : 'not-allowed';

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: cursorStyle,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setCursorPos(null);
          handleMouseUp();
        }}
      />

      {/* Source point cross indicator */}
      {sourcePoint && (
        <div
          style={{
            position: 'absolute',
            left: sourcePoint.x,
            top: sourcePoint.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: brushSize,
            height: brushSize,
            border: '1.5px dashed rgba(255, 200, 0, 0.9)',
            borderRadius: '50%',
          }}
        />
      )}

      {/* Brush cursor preview */}
      {cursorPos && !isAltHeld && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: brushSize,
            height: brushSize,
            border: `1.5px solid rgba(255,255,255,${sourcePoint ? 0.8 : 0.3})`,
            borderRadius: '50%',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Alt hint when no source set */}
      {!sourcePoint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[10px] text-white/60 font-medium whitespace-nowrap pointer-events-none">
          Alt+Click to set source point
        </div>
      )}

      {/* Mode indicator */}
      {sourcePoint && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 border border-amber-500/30 text-[10px] text-amber-400 font-medium whitespace-nowrap pointer-events-none">
          {isAltHeld ? '⊕ Move source' : '● Paint to clone'} — {mode === 'healing-brush' ? 'Healing Brush' : 'Clone Stamp'}
        </div>
      )}
    </div>
  );
});

HealingCanvas.displayName = 'HealingCanvas';
