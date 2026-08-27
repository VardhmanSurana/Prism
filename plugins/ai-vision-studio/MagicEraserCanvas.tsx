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
  isEraser: boolean;
}

export interface MagicEraserCanvasProps {
  imageUrl: string;
  mode: MagicEraserMode;
  brushSize: number;
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
  onMaskChange,
  onStrokeComplete,
  onInteractivePointsChange,
  showMaskPreview = true,
  maskOpacity = 60,
  initialMask,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const [interactivePoints, setInteractivePoints] = useState<Array<{ x: number; y: number; positive: boolean }>>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  
  const strokesRef = useRef<MaskStroke[]>([]);
  const currentStrokeRef = useRef<MaskStroke | null>(null);
  const lastPoint = useRef<Point | null>(null);

  // Redraw the mask canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.brushSize;

      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#ffffff';
      }

      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Redraw the visual overlay (semi-transparent mask preview + interactive points + cursor)
  const redrawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const oCtx = overlay?.getContext('2d');
    const maskCanvas = canvasRef.current;
    if (!oCtx || !overlay || !maskCanvas) return;

    oCtx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw mask preview in red with opacity
    if (showMaskPreview) {
      oCtx.save();
      oCtx.globalAlpha = maskOpacity / 100;
      oCtx.fillStyle = 'rgba(239, 68, 68, 1)';
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = maskCanvas.width;
      tempCanvas.height = maskCanvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = '#ef4444';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        oCtx.drawImage(tempCanvas, 0, 0);
      }
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
    if (mousePos && (mode === 'brush' || mode === 'erase')) {
      oCtx.save();
      oCtx.beginPath();
      oCtx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2);
      oCtx.strokeStyle = mode === 'erase' ? '#ef4444' : '#ffffff';
      oCtx.lineWidth = 1.5;
      oCtx.setLineDash([4, 4]);
      oCtx.stroke();

      oCtx.beginPath();
      oCtx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
      oCtx.fillStyle = mode === 'erase' ? '#ef4444' : '#ffffff';
      oCtx.fill();
      oCtx.restore();
    }
  }, [showMaskPreview, maskOpacity, mode, interactivePoints, mousePos, brushSize]);

  // Clear all masks
  const clearMask = useCallback(() => {
    strokesRef.current = [];
    setInteractivePoints([]);
    currentStrokeRef.current = null;
    
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

  // Load image and initialize canvas
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = img.width;
        overlayCanvasRef.current.height = img.height;
      }
      
      imageRef.current = img;
      if (initialMask) {
        restoreMask(initialMask);
      } else {
        redrawCanvas();
        redrawOverlay();
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, initialMask, redrawCanvas, redrawOverlay, restoreMask]);

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
      setIsDrawing(true);
      isDrawingRef.current = true;
      lastPoint.current = pt;

      const newStroke: MaskStroke = {
        points: [pt],
        brushSize,
        isEraser: mode === 'erase',
      };
      currentStrokeRef.current = newStroke;
      strokesRef.current.push(newStroke);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (ctx && canvas) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
        if (mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#ffffff';
        }
        ctx.fill();
        ctx.restore();
      }

      redrawOverlay();
    }
  }, [mode, brushSize, getCanvasCoords, redrawOverlay, interactivePoints, onInteractivePointsChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;

    setMousePos(pt);

    if (isDrawingRef.current && (mode === 'brush' || mode === 'erase')) {
      const currentStroke = currentStrokeRef.current;
      if (currentStroke) {
        currentStroke.points.push(pt);
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      const last = lastPoint.current;

      if (ctx && last) {
        ctx.save();
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;

        if (mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#ffffff';
        }

        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.restore();
      }

      lastPoint.current = pt;
    }

    redrawOverlay();
  }, [mode, brushSize, getCanvasCoords, redrawOverlay, interactivePoints, onInteractivePointsChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      setIsDrawing(false);
      isDrawingRef.current = false;
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
    setMousePos(null);
    if (isDrawingRef.current) {
      setIsDrawing(false);
      isDrawingRef.current = false;
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

