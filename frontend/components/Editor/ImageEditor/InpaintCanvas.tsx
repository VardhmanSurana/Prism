/**
 * InpaintCanvas.tsx
 * Canvas overlay for drawing inpainting masks with brush tools,
 * interactive segmentation, and mask management.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { InpaintMode } from './InpaintPanel';

declare global {
  interface Window {
    __clearInpaintMask?: () => void;
    __restoreInpaintMask?: (dataUrl: string) => void;
  }
}

interface Point {
  x: number;
  y: number;
}

interface MaskStroke {
  points: Point[];
  brushSize: number;
  isEraser: boolean;
}

interface InpaintCanvasProps {
  imageUrl: string;
  mode: InpaintMode;
  brushSize: number;
  onMaskChange: (maskDataUrl: string) => void;
  onStrokeComplete?: (maskDataUrl: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showMaskPreview?: boolean;
  maskOpacity?: number;
}

export const InpaintCanvas: React.FC<InpaintCanvasProps> = ({
  imageUrl,
  mode,
  brushSize,
  onMaskChange,
  onStrokeComplete,
  showMaskPreview = true,
  maskOpacity = 60,
}) => {
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

  // Load image and initialize canvas
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      cancelled = true;
      return;
    }

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
      redrawCanvas();
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Redraw the mask canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach(stroke => {
      drawStroke(ctx, stroke);
    });

    const maskDataUrl = canvas.toDataURL('image/webp', 0.8);
    onMaskChange(maskDataUrl);
  }, [onMaskChange]);

  // Redraw the overlay (cursor, points, etc.)
  const redrawOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (!overlayCtx || !overlayCanvas) return;

    // Clear overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Draw mask overlay if visible
    if (showMaskPreview) {
      const maskCanvas = canvasRef.current;
      if (maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0) {
        overlayCtx.save();
        overlayCtx.globalAlpha = maskOpacity / 100;
        overlayCtx.drawImage(maskCanvas, 0, 0);
        overlayCtx.globalCompositeOperation = 'source-in';
        overlayCtx.fillStyle = 'rgba(59, 130, 246, 1)'; // Blue tint
        overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayCtx.restore();
      }
    }
    
    // Draw interactive points
    interactivePoints.forEach(p => {
      overlayCtx.fillStyle = p.positive ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
      overlayCtx.beginPath();
      overlayCtx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      overlayCtx.fill();
    });

    // Draw brush cursor
    if (mousePos && (mode === 'brush' || mode === 'erase')) {
      overlayCtx.save();
      // Outer glow for dark backgrounds
      overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      overlayCtx.lineWidth = 4;
      overlayCtx.beginPath();
      overlayCtx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, 2 * Math.PI);
      overlayCtx.stroke();

      // Primary white ring
      overlayCtx.strokeStyle = 'white';
      overlayCtx.lineWidth = 2.5;
      overlayCtx.beginPath();
      overlayCtx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, 2 * Math.PI);
      overlayCtx.stroke();
      
      // Mode-specific inner ring
      overlayCtx.strokeStyle = mode === 'erase' ? 'rgba(255, 60, 60, 0.9)' : 'rgba(60, 160, 255, 0.9)';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.beginPath();
      overlayCtx.arc(mousePos.x, mousePos.y, (brushSize / 2) - 1.5, 0, 2 * Math.PI);
      overlayCtx.stroke();
      
      // Center precision dot
      overlayCtx.fillStyle = 'white';
      overlayCtx.beginPath();
      overlayCtx.arc(mousePos.x, mousePos.y, 2, 0, 2 * Math.PI);
      overlayCtx.fill();
      overlayCtx.restore();
    }
  }, [mousePos, mode, brushSize, interactivePoints, showMaskPreview, maskOpacity]);

  // Push the current canvas state to the parent (used for live updates during draw)
  const pushMaskUpdate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maskDataUrl = canvas.toDataURL('image/webp', 0.8);
    onMaskChange(maskDataUrl);
  }, [onMaskChange]);

  useEffect(() => {
    if (!isDrawing) {
      redrawCanvas();
    }
  }, [redrawCanvas, isDrawing]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay, brushSize, mousePos, showMaskPreview, maskOpacity]);

  // Draw a single stroke
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: MaskStroke) => {
    if (stroke.points.length === 0) return;

    ctx.save();

    // Set blend mode for eraser
    ctx.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';

    // Set brush properties
    ctx.strokeStyle = stroke.isEraser ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = stroke.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the stroke
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
    ctx.restore();
  }, []);

  const getEffectiveBrushSize = useCallback((e: React.PointerEvent<HTMLCanvasElement>): number => {
    if (e.pointerType === 'pen' && e.pressure > 0) {
      return Math.max(5, brushSize * Math.min(1, e.pressure * 1.5));
    }
    return brushSize;
  }, [brushSize]);

  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point | null => {
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

  // Pointer down handler
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.pointerType === 'pen') e.currentTarget.setPointerCapture(e.pointerId);
    
    const point = getCanvasCoords(e);
    if (!point) return;

    if (mode === 'interactive') {
      const isRightClick = e.button === 2;
      setInteractivePoints(prev => [...prev, { x: point.x, y: point.y, positive: !isRightClick }]);
      
      const overlayCtx = overlayCanvasRef.current?.getContext('2d');
      if (overlayCtx) {
        overlayCtx.fillStyle = isRightClick ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 0, 0.5)';
        overlayCtx.beginPath();
        overlayCtx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        overlayCtx.fill();
      }
    } else if (mode === 'brush' || mode === 'erase') {
      setIsDrawing(true);
      isDrawingRef.current = true;
      lastPoint.current = point;
      
      const effectiveSize = getEffectiveBrushSize(e);
      currentStrokeRef.current = {
        points: [point],
        brushSize: effectiveSize,
        isEraser: mode === 'erase',
      };
    }
  }, [mode, getCanvasCoords, getEffectiveBrushSize]);

  // Pointer move handler
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasCoords(e);
    if (!point) return;

    setMousePos(point);

    if (isDrawingRef.current && currentStrokeRef.current && lastPoint.current) {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const dx = point.x - lastPoint.current.x;
      const dy = point.y - lastPoint.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / 1));
      const effectiveSize = getEffectiveBrushSize(e);

      ctx.save();
      ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
      ctx.fillStyle = mode === 'erase' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const interpPoint = {
          x: lastPoint.current.x + dx * t,
          y: lastPoint.current.y + dy * t,
        };

        ctx.beginPath();
        ctx.arc(interpPoint.x, interpPoint.y, effectiveSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        
        currentStrokeRef.current.points.push(interpPoint);
      }
      ctx.restore();

      lastPoint.current = point;
    }
  }, [mode, getCanvasCoords, getEffectiveBrushSize]);

  // Pointer up handler
  const handlePointerUp = useCallback(() => {
    if (isDrawingRef.current && currentStrokeRef.current) {
      strokesRef.current.push({ ...currentStrokeRef.current });
      currentStrokeRef.current = null;
      const canvas = canvasRef.current;
      if (canvas && onStrokeComplete) {
        queueMicrotask(() => {
          const maskDataUrl = canvas.toDataURL('image/png');
          onStrokeComplete(maskDataUrl);
        });
      }
      queueMicrotask(pushMaskUpdate);
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastPoint.current = null;
  }, [pushMaskUpdate, onStrokeComplete]);

  // Pointer leave handler
  const handlePointerLeave = useCallback(() => {
    handlePointerUp();
    setMousePos(null);
  }, [handlePointerUp]);

  // Context menu handler (prevent default for right-click interactive seg)
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'interactive') {
      e.preventDefault();
    }
  }, [mode]);

  // Clear all masks
  const clearMask = useCallback(() => {
    strokesRef.current = [];
    setInteractivePoints([]);
    currentStrokeRef.current = null;
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    const overlayCtx = overlayCanvasRef.current?.getContext('2d');
    if (overlayCtx && overlayCanvasRef.current) {
      overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    onMaskChange('');
  }, [onMaskChange]);

  // Expose clear and restore functions
  useEffect(() => {
    window.__clearInpaintMask = clearMask;
    window.__restoreInpaintMask = (dataUrl: string) => {
      strokesRef.current = [];
      currentStrokeRef.current = null;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        onMaskChange(dataUrl);
        redrawOverlay();
      };
      img.src = dataUrl;
    };
    return () => {
      delete window.__clearInpaintMask;
      delete window.__restoreInpaintMask;
    };
  }, [clearMask, onMaskChange, redrawOverlay]);

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
};
