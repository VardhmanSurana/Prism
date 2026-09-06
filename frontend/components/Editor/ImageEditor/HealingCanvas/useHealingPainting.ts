/**
 * useHealingPainting.ts
 * Core painting loop, stroke interpolation, and mouse/stylus event handlers.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { HealingToolMode } from './types';

interface UseHealingPaintingProps {
  width: number;
  height: number;
  sourceImage: HTMLImageElement | null;
  imageSrc?: string;
  mode?: HealingToolMode;
  brushSize?: number;
  hardness?: number;
  opacity?: number;
  onStrokeComplete?: () => void;
}

export function useHealingPainting({
  width,
  height,
  sourceImage,
  imageSrc,
  mode = 'clone-stamp',
  brushSize = 30,
  hardness = 50,
  opacity = 100,
  onStrokeComplete,
}: UseHealingPaintingProps) {
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

  return {
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
  };
}

