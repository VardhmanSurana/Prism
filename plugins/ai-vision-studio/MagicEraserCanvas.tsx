/**
 * MagicEraserCanvas.tsx
 * Canvas overlay for drawing Magic Eraser masks with brush tools,
 * interactive segmentation, and mask management via clean imperative ref handle.
 */

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MagicEraserMode } from './MagicEraserPanel';

export interface MagicEraserCanvasHandle {
  clearMask: () => void;
  restoreMask: (dataUrl: string) => void;
}

export type InpaintCanvasHandle = MagicEraserCanvasHandle;

interface Point {
  x: number;
  y: number;
}

interface MaskStroke {
  points: Point[];
  brushSize: number;
  brushHardness: number;
  isEraser: boolean;
}

function drawDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hardness: number,
  isEraser: boolean,
) {
  ctx.save();
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  if (hardness >= 95) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    const innerRadius = Math.max(0, radius * (hardness / 100));
    const grad = ctx.createRadialGradient(x, y, innerRadius, x, y, radius);
    if (isEraser) {
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  radius: number,
  hardness: number,
  isEraser: boolean,
) {
  if (hardness >= 95) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
    }
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  } else {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, radius * 0.2);
    const count = Math.ceil(dist / step);
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      drawDab(ctx, p0.x + dx * t, p0.y + dy * t, radius, hardness, isEraser);
    }
  }
}

export interface MagicEraserCanvasProps {
  imageUrl: string;
  mode: MagicEraserMode;
  brushSize: number;
  brushHardness?: number;
  onMaskChange: (maskDataUrl: string) => void;
  onStrokeComplete?: (maskDataUrl: string) => void;
  /** Fired whenever interactive prompt points change (add / clear). */
  onInteractivePointsChange?: (points: Array<{ x: number; y: number; positive: boolean }>) => void;
  showMaskPreview?: boolean;
  maskOpacity?: number;
  initialMask?: string | null;
}

export type InpaintCanvasProps = MagicEraserCanvasProps;

export const MagicEraserCanvas = forwardRef<MagicEraserCanvasHandle, MagicEraserCanvasProps>(({
  imageUrl,
  mode,
  brushSize,
  brushHardness = 80,
  onMaskChange,
  onStrokeComplete,
  onInteractivePointsChange,
  showMaskPreview = true,
  maskOpacity = 60,
  initialMask,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const [interactivePoints, setInteractivePoints] = useState<Array<{ x: number; y: number; positive: boolean }>>([]);
  const mousePosRef = useRef<Point | null>(null);
  const [isShiftDown, setIsShiftDown] = useState(false);
  
  const strokesRef = useRef<MaskStroke[]>([]);
  const currentStrokeRef = useRef<MaskStroke | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const lastStrokeEndPointRef = useRef<Point | null>(null);

  // Track global Shift key for straight line snapping
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Redraw the mask canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      const radius = stroke.brushSize / 2;
      const hardness = stroke.brushHardness ?? 80;

      if (stroke.points.length === 1) {
        drawDab(ctx, stroke.points[0].x, stroke.points[0].y, radius, hardness, stroke.isEraser);
      } else {
        drawDab(ctx, stroke.points[0].x, stroke.points[0].y, radius, hardness, stroke.isEraser);
        for (let i = 1; i < stroke.points.length; i++) {
          drawSegment(ctx, stroke.points[i - 1], stroke.points[i], radius, hardness, stroke.isEraser);
        }
      }
    }
  }, []);

  // Redraw the visual overlay (semi-transparent mask preview + interactive points + cursor)
  const redrawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const oCtx = overlay?.getContext('2d');
    const maskCanvas = canvasRef.current;
    if (!oCtx || !overlay || !maskCanvas) return;

    oCtx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw mask preview in red with opacity using cached temp canvas
    if (showMaskPreview) {
      oCtx.save();
      oCtx.globalAlpha = maskOpacity / 100;

      let tempCanvas = tempCanvasRef.current;
      if (!tempCanvas) {
        tempCanvas = document.createElement('canvas');
        tempCanvasRef.current = tempCanvas;
      }
      if (tempCanvas.width !== maskCanvas.width || tempCanvas.height !== maskCanvas.height) {
        tempCanvas.width = maskCanvas.width;
        tempCanvas.height = maskCanvas.height;
      }
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.save();
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = '#ef4444';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.restore();
        oCtx.drawImage(tempCanvas, 0, 0);
      }
      oCtx.restore();
    }

    const currentPos = mousePosRef.current;

    // Draw Shift straight-line guide preview
    if (isShiftDown && lastStrokeEndPointRef.current && currentPos && (mode === 'brush' || mode === 'erase')) {
      oCtx.save();
      oCtx.beginPath();
      oCtx.setLineDash([4, 4]);
      oCtx.strokeStyle = mode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.8)';
      oCtx.lineWidth = 1.5;
      oCtx.moveTo(lastStrokeEndPointRef.current.x, lastStrokeEndPointRef.current.y);
      oCtx.lineTo(currentPos.x, currentPos.y);
      oCtx.stroke();
      oCtx.restore();
    }

    // Draw interactive segmentation points
    if (mode === 'interactive') {
      for (const pt of interactivePoints) {
        oCtx.save();
        oCtx.beginPath();
        oCtx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        oCtx.fillStyle = pt.positive ? '#22c55e' : '#ef4444';
        oCtx.fill();
        oCtx.lineWidth = 2;
        oCtx.strokeStyle = '#ffffff';
        oCtx.stroke();

        oCtx.fillStyle = '#ffffff';
        oCtx.font = 'bold 11px sans-serif';
        oCtx.textAlign = 'center';
        oCtx.textBaseline = 'middle';
        oCtx.fillText(pt.positive ? '+' : '−', pt.x, pt.y);
        oCtx.restore();
      }
    }

    // Draw brush outline cursor
    if (currentPos && (mode === 'brush' || mode === 'erase')) {
      oCtx.save();
      oCtx.beginPath();
      oCtx.arc(currentPos.x, currentPos.y, brushSize / 2, 0, Math.PI * 2);
      oCtx.strokeStyle = mode === 'erase' ? '#ef4444' : '#ffffff';
      oCtx.lineWidth = 1.5;
      oCtx.setLineDash([4, 4]);
      oCtx.stroke();

      // Soft brush inner ring indicator
      if (brushHardness < 95) {
        const innerR = Math.max(0, (brushSize / 2) * (brushHardness / 100));
        if (innerR > 2) {
          oCtx.beginPath();
          oCtx.arc(currentPos.x, currentPos.y, innerR, 0, Math.PI * 2);
          oCtx.strokeStyle = mode === 'erase' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.4)';
          oCtx.lineWidth = 1;
          oCtx.setLineDash([2, 2]);
          oCtx.stroke();
        }
      }

      oCtx.beginPath();
      oCtx.arc(currentPos.x, currentPos.y, 2, 0, Math.PI * 2);
      oCtx.fillStyle = mode === 'erase' ? '#ef4444' : '#ffffff';
      oCtx.fill();
      oCtx.restore();
    }
  }, [showMaskPreview, maskOpacity, isShiftDown, mode, interactivePoints, brushSize, brushHardness]);

  const clearMask = useCallback(() => {
    strokesRef.current = [];
    setInteractivePoints([]);
    currentStrokeRef.current = null;
    lastStrokeEndPointRef.current = null;
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    const overlayCtx = overlayCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (overlayCtx && overlayCanvasRef.current) {
      overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    onMaskChange('');
  }, [onMaskChange]);

  // Restore mask from image data URL
  const restoreMask = useCallback((dataUrl: string) => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    lastStrokeEndPointRef.current = null;
    if (!dataUrl) {
      clearMask();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (ctx && canvas) {
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        if (overlayCanvasRef.current && (overlayCanvasRef.current.width === 0 || overlayCanvasRef.current.height === 0)) {
          overlayCanvasRef.current.width = img.width;
          overlayCanvasRef.current.height = img.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      onMaskChange(dataUrl);
      redrawOverlay();
    };
    img.src = dataUrl;
  }, [clearMask, onMaskChange, redrawOverlay]);

  const redrawCanvasRef = useRef(redrawCanvas);
  redrawCanvasRef.current = redrawCanvas;
  const redrawOverlayRef = useRef(redrawOverlay);
  redrawOverlayRef.current = redrawOverlay;
  const restoreMaskRef = useRef(restoreMask);
  restoreMaskRef.current = restoreMask;
  const initialMaskRef = useRef(initialMask);
  initialMaskRef.current = initialMask;

  // Load image and initialize canvas
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvasWithImage = (img: HTMLImageElement) => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = img.naturalWidth || img.width;
        overlayCanvasRef.current.height = img.naturalHeight || img.height;
      }

      imageRef.current = img;
      if (initialMaskRef.current) {
        restoreMaskRef.current(initialMaskRef.current);
      } else {
        redrawCanvasRef.current();
        redrawOverlayRef.current();
      }
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setupCanvasWithImage(img);
    };
    img.src = imageUrl;

    if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
      setupCanvasWithImage(img);
    }

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Sync initialMask when prop changes
  useEffect(() => {
    if (initialMask) {
      restoreMask(initialMask);
    }
  }, [initialMask, restoreMask]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  // Convert client pointer coordinates to canvas pixel space
  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const emitMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onMaskChange(dataUrl);
    return dataUrl;
  }, [onMaskChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const pt = getCanvasCoords(e);
    if (!pt) return;

    if (mode === 'interactive') {
      const isPositive = e.button === 0;
      const next = [...interactivePoints, { ...pt, positive: isPositive }];
      setInteractivePoints(next);
      onInteractivePointsChange?.(next);
      return;
    }

    if (mode === 'brush' || mode === 'erase') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });

      // Shift-click straight line: connect from previous stroke end
      if (e.shiftKey && lastStrokeEndPointRef.current) {
        const fromPt = lastStrokeEndPointRef.current;
        const newStroke: MaskStroke = {
          points: [fromPt, pt],
          brushSize,
          brushHardness,
          isEraser: mode === 'erase',
        };
        strokesRef.current.push(newStroke);
        if (ctx) {
          drawSegment(ctx, fromPt, pt, brushSize / 2, brushHardness, mode === 'erase');
        }
        lastStrokeEndPointRef.current = pt;
        lastPoint.current = pt;
        const dataUrl = emitMask();
        if (dataUrl && onStrokeComplete) {
          onStrokeComplete(dataUrl);
        }
        redrawOverlay();
        return;
      }

      setIsDrawing(true);
      isDrawingRef.current = true;
      lastPoint.current = pt;

      const newStroke: MaskStroke = {
        points: [pt],
        brushSize,
        brushHardness,
        isEraser: mode === 'erase',
      };
      currentStrokeRef.current = newStroke;
      strokesRef.current.push(newStroke);

      if (ctx) {
        drawDab(ctx, pt.x, pt.y, brushSize / 2, brushHardness, mode === 'erase');
      }

      redrawOverlay();
    }
  }, [mode, brushSize, brushHardness, getCanvasCoords, redrawOverlay, interactivePoints, onInteractivePointsChange, emitMask, onStrokeComplete]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;

    mousePosRef.current = pt;

    if (isDrawingRef.current && (mode === 'brush' || mode === 'erase')) {
      const currentStroke = currentStrokeRef.current;
      if (currentStroke) {
        currentStroke.points.push(pt);
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      const last = lastPoint.current;

      if (ctx && last) {
        drawSegment(ctx, last, pt, brushSize / 2, brushHardness, mode === 'erase');
      }

      lastPoint.current = pt;
    }

    redrawOverlay();
  }, [mode, brushSize, brushHardness, getCanvasCoords, redrawOverlay]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (lastPoint.current) {
        lastStrokeEndPointRef.current = lastPoint.current;
      }
      lastPoint.current = null;
      currentStrokeRef.current = null;

      const dataUrl = emitMask();
      if (dataUrl && onStrokeComplete) {
        onStrokeComplete(dataUrl);
      }
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  }, [emitMask, onStrokeComplete]);

  const handlePointerLeave = useCallback(() => {
    mousePosRef.current = null;
    if (isDrawingRef.current) {
      setIsDrawing(false);
      isDrawingRef.current = false;
      if (lastPoint.current) {
        lastStrokeEndPointRef.current = lastPoint.current;
      }
      lastPoint.current = null;
      currentStrokeRef.current = null;
      const dataUrl = emitMask();
      if (dataUrl && onStrokeComplete) {
        onStrokeComplete(dataUrl);
      }
    }
    redrawOverlay();
  }, [emitMask, onStrokeComplete, redrawOverlay]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'interactive') {
      e.preventDefault();
    }
  }, [mode]);

  // Expose clean imperative handle via ref
  useImperativeHandle(ref, () => ({
    clearMask,
    restoreMask,
  }), [clearMask, restoreMask]);

  return (
    <div 
      className="absolute inset-0 z-20 overflow-hidden select-none"
      style={{
        cursor: (mode === 'brush' || mode === 'erase') ? 'none' : 'crosshair',
      }}
    >
      {/* Mask canvas (hidden, used for generating mask data) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-0 select-none"
      />
      
      {/* Overlay canvas (visible, shows cursor and interactive feedback) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        style={{
          mixBlendMode: 'normal',
          cursor: (mode === 'brush' || mode === 'erase') ? 'none' : 'crosshair',
          touchAction: 'none',
        }}
      />
    </div>
  );
});

MagicEraserCanvas.displayName = 'MagicEraserCanvas';

export const InpaintCanvas = MagicEraserCanvas;

