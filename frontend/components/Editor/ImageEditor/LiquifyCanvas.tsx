/**
 * LiquifyCanvas.tsx
 * Interactive 60fps WebGL-accelerated canvas overlay for Liquify & Reshape tools.
 * Handles Forward Warp, Pucker, Bloat, Smooth, Reconstruct, and Face Reshaping.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import {
  LiquifySettings,
  MeshGrid,
  WebGLLiquifyRenderer,
  DEFAULT_LIQUIFY_SETTINGS,
} from './liquifyEngine';
import type { FaceBBox } from '@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay';

export interface LiquifyCanvasRef {
  getWorkCanvas: () => HTMLCanvasElement | null;
  getMeshGrid: () => MeshGrid | null;
  resetMesh: () => void;
  hasModifications: () => boolean;
}

interface LiquifyCanvasProps {
  width: number;
  height: number;
  sourceImage: HTMLImageElement | HTMLCanvasElement | null;
  imageSrc?: string;
  settings?: LiquifySettings;
  faces?: FaceBBox[];
  selectedFaceIndex?: number | null;
  onModifiedChange?: (modified: boolean) => void;
  readOnly?: boolean;
}

export const LiquifyCanvas = forwardRef<LiquifyCanvasRef, LiquifyCanvasProps>(({
  width,
  height,
  sourceImage,
  imageSrc,
  settings = DEFAULT_LIQUIFY_SETTINGS,
  faces = [],
  selectedFaceIndex,
  onModifiedChange,
  readOnly = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGLLiquifyRenderer | null>(null);
  const meshRef = useRef<MeshGrid>(new MeshGrid(64, 64));
  const baseMeshRef = useRef<MeshGrid>(new MeshGrid(64, 64));
  const fallbackImgRef = useRef<HTMLImageElement | null>(null);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const isInteractingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Fallback image loader if sourceImage prop is unrendered
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      fallbackImgRef.current = img;
      if (rendererRef.current) {
        rendererRef.current.setSourceImage(img);
        rendererRef.current.render(meshRef.current);
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const getEffectiveImage = useCallback((): HTMLImageElement | HTMLCanvasElement | null => {
    if (sourceImage) {
      if (sourceImage instanceof HTMLImageElement && sourceImage.naturalWidth > 0) return sourceImage;
      if (sourceImage instanceof HTMLCanvasElement && sourceImage.width > 0) return sourceImage;
    }
    if (fallbackImgRef.current && fallbackImgRef.current.naturalWidth > 0) {
      return fallbackImgRef.current;
    }
    return null;
  }, [sourceImage]);

  // Initialize/recreate WebGL renderer and textures on dimension changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    if (w <= 0 || h <= 0) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (!rendererRef.current) {
      rendererRef.current = new WebGLLiquifyRenderer(canvas);
    }

    const img = getEffectiveImage();
    if (img && rendererRef.current) {
      const imgW = 'naturalWidth' in img ? img.naturalWidth : img.width;
      const imgH = 'naturalHeight' in img ? img.naturalHeight : img.height;
      if (imgW > 0 && imgH > 0) {
        rendererRef.current.setSourceImage(img);
        rendererRef.current.render(meshRef.current);
      }
    }
  }, [width, height, getEffectiveImage]);

  // Sync Face-Aware Reshape Sliders into Mesh Grid
  useEffect(() => {
    if (!settings.face) return;

    const img = getEffectiveImage();
    const naturalW = (img && 'naturalWidth' in img && img.naturalWidth > 0) ? img.naturalWidth : width;
    const naturalH = (img && 'naturalHeight' in img && img.naturalHeight > 0) ? img.naturalHeight : height;

    // Determine target face bounding box in normalized [0..1] space
    let targetFaceBox = { x: 0.25, y: 0.15, width: 0.5, height: 0.6 };
    if (faces.length > 0) {
      const activeFace = (typeof selectedFaceIndex === 'number' && faces[selectedFaceIndex])
        ? faces[selectedFaceIndex]
        : faces[0];

      if (Array.isArray(activeFace.box) && activeFace.box.length >= 4) {
        const [rawX, rawY, rawW, rawH] = activeFace.box;
        const isPixel = rawX > 1 || rawY > 1 || rawW > 1 || rawH > 1;
        targetFaceBox = isPixel
          ? {
              x: Math.max(0, Math.min(1, rawX / naturalW)),
              y: Math.max(0, Math.min(1, rawY / naturalH)),
              width: Math.max(0.05, Math.min(1, rawW / naturalW)),
              height: Math.max(0.05, Math.min(1, rawH / naturalH)),
            }
          : {
              x: Math.max(0, Math.min(1, rawX)),
              y: Math.max(0, Math.min(1, rawY)),
              width: Math.max(0.05, Math.min(1, rawW)),
              height: Math.max(0.05, Math.min(1, rawH)),
            };
      } else if (activeFace.box && !Array.isArray(activeFace.box)) {
        const b = activeFace.box as { x: number; y: number; width: number; height: number };
        const isNorm = b.x <= 1 && b.y <= 1 && b.width <= 1;
        targetFaceBox = isNorm
          ? { x: b.x, y: b.y, width: b.width, height: b.height }
          : {
              x: Math.max(0, Math.min(1, b.x / naturalW)),
              y: Math.max(0, Math.min(1, b.y / naturalH)),
              width: Math.max(0.05, Math.min(1, b.width / naturalW)),
              height: Math.max(0.05, Math.min(1, b.height / naturalH)),
            };
      }
    }

    const aspect = width > 0 && height > 0 ? width / height : 1.0;
    meshRef.current.applyFaceReshape(targetFaceBox, settings.face, baseMeshRef.current, aspect);

    if (rendererRef.current) {
      rendererRef.current.render(meshRef.current);
    }

    const modified = meshRef.current.hasModifications();
    setHasChanges(modified);
    onModifiedChange?.(modified);
  }, [settings.face, faces, selectedFaceIndex, width, height, getEffectiveImage, onModifiedChange]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isInteractingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    lastPointRef.current = { x, y };
    setCursorPos({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursorPos({ x, y });

    if (!isInteractingRef.current || !lastPointRef.current || readOnly) return;

    const dx = (x - lastPointRef.current.x) / width;
    const dy = (y - lastPointRef.current.y) / height;
    lastPointRef.current = { x, y };

    const normX = x / width;
    const normY = y / height;
    const normRadius = (settings.brushSize / 2) / Math.max(width, height);
    const aspect = width / height;

    meshRef.current.applyBrush(
      normX,
      normY,
      dx,
      dy,
      normRadius,
      settings.pressure,
      settings.mode,
      aspect,
    );

    if (rendererRef.current) {
      rendererRef.current.render(meshRef.current);
    }

    setHasChanges(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      lastPointRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
      baseMeshRef.current.copyFrom(meshRef.current);
      const modified = meshRef.current.hasModifications();
      setHasChanges(modified);
      onModifiedChange?.(modified);
    }
  };

  useImperativeHandle(ref, () => ({
    getWorkCanvas: () => {
      const c = canvasRef.current;
      return (meshRef.current.hasModifications() && c && c.width > 0 && c.height > 0) ? c : null;
    },
    getMeshGrid: () => meshRef.current,
    resetMesh: () => {
      meshRef.current.reset();
      baseMeshRef.current.reset();
      if (rendererRef.current) {
        const img = getEffectiveImage();
        if (img) {
          const imgW = 'naturalWidth' in img ? img.naturalWidth : img.width;
          const imgH = 'naturalHeight' in img ? img.naturalHeight : img.height;
          if (imgW > 0 && imgH > 0) {
            rendererRef.current.setSourceImage(img);
          }
        }
        rendererRef.current.render(meshRef.current);
      }
      setHasChanges(false);
      onModifiedChange?.(false);
    },
    hasModifications: () => hasChanges || meshRef.current.hasModifications(),
  }));

  return (
    <div
      className="absolute inset-0 select-none overflow-hidden"
      style={{
        pointerEvents: readOnly ? 'none' : 'auto',
        touchAction: readOnly ? 'auto' : 'none',
      }}
    >
      {/* WebGL Displacement Display Canvas */}
      <canvas
        ref={canvasRef}
        width={Number.isFinite(width) && width > 0 ? Math.round(width) : 1}
        height={Number.isFinite(height) && height > 0 ? Math.round(height) : 1}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: readOnly ? 'default' : 'crosshair',
          pointerEvents: readOnly ? 'none' : 'auto',
          touchAction: readOnly ? 'auto' : 'none',
        }}
        onPointerEnter={readOnly ? undefined : (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onPointerDown={readOnly ? undefined : handlePointerDown}
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : handlePointerUp}
        onPointerCancel={readOnly ? undefined : handlePointerUp}
        onPointerLeave={() => {
          setCursorPos(null);
        }}
      />

      {/* Interactive Brush Cursor Ring */}
      {!readOnly && cursorPos && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: settings.brushSize,
            height: settings.brushSize,
            border: '2px solid rgba(252, 188, 0, 0.95)',
            borderRadius: '50%',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.8), inset 0 0 8px rgba(252, 188, 0, 0.3)',
            zIndex: 40,
          }}
        >
          {/* Precise Center Indicator */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FCBC00] shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
        </div>
      )}
    </div>
  );
});

LiquifyCanvas.displayName = 'LiquifyCanvas';
