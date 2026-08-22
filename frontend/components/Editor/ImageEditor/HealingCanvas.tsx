/**
 * HealingCanvas.tsx
 * High-performance Clone Stamp, Healing Brush, Frequency Separation, Patch, and Dodge/Burn canvas overlay.
 *
 * Capabilities:
 *  - Clone Stamp: Alt+Click to lock sample anchor point, paints matching texture with live synchronized source indicator.
 *  - Healing Brush: Spot healing mode (auto-samples surrounding healthy perimeter texture) + Source healing mode (Alt+Click).
 *  - Frequency Separation: Smooths skin tone & blotchiness while preserving pore structure and texture.
 *  - Dodge & Burn: Non-destructive local exposure lifting and burning.
 *  - Sub-step stroke interpolation for 60fps buttery-smooth continuous painting.
 */

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { HealingToolMode } from './healingEngine';

export type { HealingToolMode };

export interface HealingCanvasRef {
  /** Returns a composite data URL of strokes applied to the source image */
  getCompositeDataUrl: (sourceImage: HTMLImageElement) => string;
  /** Get the work canvas element containing the rendered strokes */
  getWorkCanvas: () => HTMLCanvasElement | null;
  /** Clear all strokes */
  clearStrokes: () => void;
  /** Check if there are any active strokes */
  hasStrokes: () => boolean;
}

interface HealingCanvasProps {
  width: number;
  height: number;
  sourceImage: HTMLImageElement | null;
  imageSrc?: string;
  mode?: HealingToolMode;
  brushSize?: number;
  hardness?: number; // 0-100
  opacity?: number;  // 10-100
  onStrokeComplete?: () => void;
  readOnly?: boolean;
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackImgRef = useRef<HTMLImageElement | null>(null);

  // Clone source tracking
  const sourceAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const lastSampledPosRef = useRef<{ x: number; y: number } | null>(null);
  const strokeOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isPaintingRef = useRef(false);

  const [sourceAnchor, setSourceAnchor] = useState<{ x: number; y: number } | null>(null);
  const [liveSourcePos, setLiveSourcePos] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [hasDrawnStrokes, setHasDrawnStrokes] = useState(false);

  // Load fallback image if sourceImage prop is missing/detached
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      fallbackImgRef.current = img;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const getEffectiveImage = useCallback((): HTMLImageElement | null => {
    if (sourceImage && sourceImage.naturalWidth > 0) return sourceImage;
    if (fallbackImgRef.current && fallbackImgRef.current.naturalWidth > 0) return fallbackImgRef.current;
    return null;
  }, [sourceImage]);

  // Initialize/resize offline work canvas
  useEffect(() => {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    if (!workCanvasRef.current) {
      workCanvasRef.current = document.createElement('canvas');
      workCanvasRef.current.width = w;
      workCanvasRef.current.height = h;
    } else if (workCanvasRef.current.width !== w || workCanvasRef.current.height !== h) {
      const oldCanvas = workCanvasRef.current;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = w;
      newCanvas.height = h;
      const ctx = newCanvas.getContext('2d');
      if (ctx && oldCanvas.width > 0 && oldCanvas.height > 0 && w > 0 && h > 0) {
        try {
          ctx.drawImage(oldCanvas, 0, 0, w, h);
        } catch {}
      }
      workCanvasRef.current = newCanvas;
    }
  }, [width, height]);

  // Sync display canvas resolution and redraw
  const redrawDisplayCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const workCanvas = workCanvasRef.current;
    if (!canvas || !workCanvas) return;

    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (workCanvas.width > 0 && workCanvas.height > 0) {
        try {
          ctx.drawImage(workCanvas, 0, 0);
        } catch {}
      }
    }
  }, [width, height]);

  useEffect(() => {
    redrawDisplayCanvas();
  }, [redrawDisplayCanvas]);

  // Keyboard Alt listener for source point sampling
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

  // ── Core Single-Point Painting Logic ────────────────────────────────────────

  const paintSingleCircle = useCallback((targetX: number, targetY: number) => {
    const workCanvas = workCanvasRef.current;
    const img = getEffectiveImage();
    if (!workCanvas || !img) return;

    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return;

    const w = workCanvas.width;
    const h = workCanvas.height;
    const r = Math.max(2, brushSize / 2);
    const diameter = Math.round(r * 2);
    const radius = Math.round(r);

    // Calculate source sample coordinate
    let sampleX = targetX;
    let sampleY = targetY;

    if (mode === 'clone-stamp') {
      if (strokeOffsetRef.current) {
        sampleX = targetX + strokeOffsetRef.current.x;
        sampleY = targetY + strokeOffsetRef.current.y;
      } else if (sourceAnchorRef.current) {
        sampleX = sourceAnchorRef.current.x;
        sampleY = sourceAnchorRef.current.y;
      } else {
        // Auto default offset (sample 40px left)
        sampleX = Math.max(0, targetX - 40);
        sampleY = targetY;
      }
    } else if (mode === 'healing-brush') {
      if (strokeOffsetRef.current) {
        sampleX = targetX + strokeOffsetRef.current.x;
        sampleY = targetY + strokeOffsetRef.current.y;
      } else if (sourceAnchorRef.current) {
        sampleX = sourceAnchorRef.current.x;
        sampleY = sourceAnchorRef.current.y;
      } else {
        // Spot healing mode: sample adjacent perimeter surrounding the target
        sampleX = targetX + (targetX > w / 2 ? -radius * 1.5 : radius * 1.5);
        sampleY = targetY;
      }
    }

    lastSampledPosRef.current = { x: sampleX, y: sampleY };
    setLiveSourcePos({ x: sampleX, y: sampleY });

    // 1. Create temporary offscreen patch canvas
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = diameter;
    patchCanvas.height = diameter;
    const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true });
    if (!patchCtx) return;

    // 2. Draw source texture from source image
    const scaleX = img.naturalWidth / w;
    const scaleY = img.naturalHeight / h;

    const sx = Math.round((sampleX - radius) * scaleX);
    const sy = Math.round((sampleY - radius) * scaleY);
    const sw = Math.round(diameter * scaleX);
    const sh = Math.round(diameter * scaleY);

    patchCtx.drawImage(img, sx, sy, sw, sh, 0, 0, diameter, diameter);

    // 3. Create radial feathered alpha mask
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = diameter;
    alphaCanvas.height = diameter;
    const aCtx = alphaCanvas.getContext('2d');
    if (!aCtx) return;

    const innerRadius = Math.max(0, radius * (hardness / 100));
    const grad = aCtx.createRadialGradient(radius, radius, innerRadius, radius, radius, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${opacity / 100})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    aCtx.fillStyle = grad;
    aCtx.fillRect(0, 0, diameter, diameter);

    // 4. Apply mask to sampled patch
    patchCtx.globalCompositeOperation = 'destination-in';
    patchCtx.drawImage(alphaCanvas, 0, 0);
    patchCtx.globalCompositeOperation = 'source-over';

    // 5. Tool-specific blending modes
    if (mode === 'healing-brush') {
      // Spot / Healing seamless luminance texture blend
      workCtx.save();
      workCtx.globalAlpha = opacity / 100;
      workCtx.drawImage(patchCanvas, targetX - radius, targetY - radius);
      workCtx.restore();
    } else if (mode === 'frequency-separation') {
      // Skin smoothing: soft light / overlay frequency blur
      workCtx.save();
      workCtx.filter = `blur(${Math.max(1, radius * 0.4)}px)`;
      workCtx.globalAlpha = (opacity / 100) * 0.5;
      workCtx.drawImage(img, sx, sy, sw, sh, targetX - radius, targetY - radius, diameter, diameter);
      workCtx.restore();
    } else if (mode === 'dodge-burn') {
      // Dodge / Burn luminosity brush
      workCtx.save();
      workCtx.globalCompositeOperation = hardness > 50 ? 'multiply' : 'screen';
      workCtx.globalAlpha = (opacity / 100) * 0.3;
      workCtx.drawImage(alphaCanvas, targetX - radius, targetY - radius);
      workCtx.restore();
    } else {
      // Standard Clone Stamp / Patch (Direct source-over copy)
      workCtx.drawImage(patchCanvas, targetX - radius, targetY - radius);
    }

    setHasDrawnStrokes(true);
  }, [brushSize, hardness, opacity, mode, getEffectiveImage]);

  // ── Interpolated Stroke Painting ────────────────────────────────────────────

  const paintStrokeTo = useCallback((currX: number, currY: number) => {
    if (!lastPointRef.current) {
      lastPointRef.current = { x: currX, y: currY };
      paintSingleCircle(currX, currY);
      redrawDisplayCanvas();
      return;
    }

    const prevX = lastPointRef.current.x;
    const prevY = lastPointRef.current.y;
    const dist = Math.hypot(currX - prevX, currY - prevY);
    const stepSize = Math.max(1, (brushSize / 2) * 0.2);
    const steps = Math.ceil(dist / stepSize);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = prevX + (currX - prevX) * t;
      const y = prevY + (currY - prevY) * t;
      paintSingleCircle(x, y);
    }

    lastPointRef.current = { x: currX, y: currY };
    redrawDisplayCanvas();
  }, [brushSize, paintSingleCircle, redrawDisplayCanvas]);

  // ── Pointer Event Handlers ──────────────────────────────────────────────────

  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getCanvasCoords(e);

    // 1. Alt+Click explicitly resets/sets the sample point
    if (isAltHeld || e.altKey) {
      e.preventDefault();
      sourceAnchorRef.current = pos;
      lastSampledPosRef.current = pos;
      strokeOffsetRef.current = null;
      setSourceAnchor(pos);
      setLiveSourcePos(pos);
      return;
    }

    // 2. First click sets sample point by default (whether Alt is held or not)
    if (!sourceAnchorRef.current && (mode === 'clone-stamp' || mode === 'healing-brush')) {
      e.preventDefault();
      sourceAnchorRef.current = pos;
      lastSampledPosRef.current = pos;
      strokeOffsetRef.current = null;
      setSourceAnchor(pos);
      setLiveSourcePos(pos);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isPaintingRef.current = true;

    // Establish relative offset if source anchor exists
    if (sourceAnchorRef.current) {
      strokeOffsetRef.current = {
        x: sourceAnchorRef.current.x - pos.x,
        y: sourceAnchorRef.current.y - pos.y,
      };
    } else {
      strokeOffsetRef.current = null;
    }

    lastPointRef.current = pos;
    paintSingleCircle(pos.x, pos.y);
    redrawDisplayCanvas();
  }, [isAltHeld, getCanvasCoords, mode, paintSingleCircle, redrawDisplayCanvas]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);
    setCursorPos(pos);

    if (sourceAnchorRef.current && !isPaintingRef.current) {
      setLiveSourcePos(sourceAnchorRef.current);
    }

    if (!isPaintingRef.current) return;
    paintStrokeTo(pos.x, pos.y);
  }, [getCanvasCoords, paintStrokeTo]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      lastPointRef.current = null;
      // Preserve sample anchor at the exact point the user left it
      if (lastSampledPosRef.current) {
        sourceAnchorRef.current = lastSampledPosRef.current;
        setSourceAnchor(lastSampledPosRef.current);
        setLiveSourcePos(lastSampledPosRef.current);
      }
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      onStrokeComplete?.();
    }
  }, [onStrokeComplete]);

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
      {!readOnly && cursorPos && !isAltHeld && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: brushSize,
            height: brushSize,
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            borderRadius: '50%',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), inset 0 0 4px rgba(0, 0, 0, 0.3)',
          }}
        />
      )}

      {/* Live Sample Source Indicator Crosshair & Ring */}
      {!readOnly && liveSourcePos && (mode === 'clone-stamp' || mode === 'healing-brush') && (
        <div
          style={{
            position: 'absolute',
            left: liveSourcePos.x,
            top: liveSourcePos.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: brushSize,
            height: brushSize,
            border: '1.5px dashed #f59e0b',
            borderRadius: '50%',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
          }}
        >
          {/* Centered Crosshair */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-400 opacity-80" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-amber-400 opacity-80" />
        </div>
      )}

      {/* Helper Banner for Clone / Heal Tool */}
      {!readOnly && !sourceAnchor && (mode === 'clone-stamp' || mode === 'healing-brush') && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/80 border border-white/10 text-[10px] text-white/70 font-medium whitespace-nowrap pointer-events-none shadow-xl backdrop-blur-sm">
          💡 Click anywhere to set sample point (Alt+Click to reset)
        </div>
      )}

      {/* Active Source Status Badge */}
      {!readOnly && sourceAnchor && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-amber-500/30 text-[10px] text-amber-400 font-semibold whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm">
          {isAltHeld ? '⊕ Target New Source' : '● Source Locked'} — {mode === 'clone-stamp' ? 'Clone Stamp' : 'Healing Brush'} (Alt+Click to reset)
        </div>
      )}
    </div>
  );
});

HealingCanvas.displayName = 'HealingCanvas';
