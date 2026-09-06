/**
 * useImageRectSync.ts
 * Bridges the cropper canvas data with React state and with all overlay
 * container refs that need to follow the cropper in zero-lag lockstep.
 * Also owns the slider-drag fast-path trigger for re-renders.
 */
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import { ImageRect } from './imageRect';

export interface OverlayRefs {
  liveCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  beforeImageRef: MutableRefObject<HTMLImageElement | null>;
  annotationsContainerRef: MutableRefObject<HTMLDivElement | null>;
  inpaintContainerRef: MutableRefObject<HTMLDivElement | null>;
  healingContainerRef: MutableRefObject<HTMLDivElement | null>;
  lassoContainerRef: MutableRefObject<HTMLDivElement | null>;
  paletteContainerRef: MutableRefObject<HTMLDivElement | null>;
  faceBBoxContainerRef: MutableRefObject<HTMLDivElement | null>;
  liquifyContainerRef: MutableRefObject<HTMLDivElement | null>;
  beforeLabelRef: MutableRefObject<HTMLDivElement | null>;
  afterLabelRef: MutableRefObject<HTMLDivElement | null>;
  compareDividerRef: MutableRefObject<HTMLDivElement | null>;
}

export interface UseImageRectSyncParams {
  cropperRef: MutableRefObject<Cropper | null>;
  currentImageSrc: string;
  overlays: OverlayRefs;
  latestComparePercentRef: MutableRefObject<number>;
  onCanvasRedrawRequest: () => void;
}

export interface UseImageRectSyncApi {
  imageRect: ImageRect | null;
  setImageRect: React.Dispatch<React.SetStateAction<ImageRect | null>>;
  isDraggingSliderRef: MutableRefObject<boolean>;
  updateImageRect: () => void;
}

export function useImageRectSync(p: UseImageRectSyncParams): UseImageRectSyncApi {
  const [imageRect, setImageRect] = useState<ImageRect | null>(null);
  const latestImageRectRef = useRef<ImageRect | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingSliderRef = useRef(false);

  useEffect(() => {
    latestImageRectRef.current = imageRect;
  }, [imageRect]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  // Global slider-drag fast-path: trigger a redraw on mouseup.
  useEffect(() => {
    const handleStartDrag = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
        isDraggingSliderRef.current = true;
      }
    };
    const handleEndDrag = () => {
      if (isDraggingSliderRef.current) {
        isDraggingSliderRef.current = false;
        p.onCanvasRedrawRequest();
      }
    };

    window.addEventListener('mousedown', handleStartDrag, { passive: true });
    window.addEventListener('touchstart', handleStartDrag, { passive: true });
    window.addEventListener('mouseup', handleEndDrag, { passive: true });
    window.addEventListener('touchend', handleEndDrag, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleStartDrag);
      window.removeEventListener('touchstart', handleStartDrag);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [p]);

  const updateImageRect = useCallback(() => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;
    const canvasData = cropper.getCanvasData();
    if (!canvasData || !canvasData.width || !canvasData.height || canvasData.width <= 0 || canvasData.height <= 0) return;

    const elementsToSync: (HTMLElement | null)[] = [
      p.overlays.liveCanvasRef.current,
      p.overlays.beforeImageRef.current,
      p.overlays.annotationsContainerRef.current,
      p.overlays.inpaintContainerRef.current,
      p.overlays.healingContainerRef.current,
      p.overlays.lassoContainerRef.current,
      p.overlays.paletteContainerRef.current,
      p.overlays.faceBBoxContainerRef.current,
      p.overlays.liquifyContainerRef.current,
    ];

    for (const el of elementsToSync) {
      if (el) {
        el.style.left = `${canvasData.left}px`;
        el.style.top = `${canvasData.top}px`;
        el.style.width = `${canvasData.width}px`;
        el.style.height = `${canvasData.height}px`;
      }
    }

    if (p.overlays.beforeLabelRef.current) {
      p.overlays.beforeLabelRef.current.style.left = `${canvasData.left + 16}px`;
      p.overlays.beforeLabelRef.current.style.top = `${canvasData.top + 16}px`;
    }
    if (p.overlays.afterLabelRef.current) {
      p.overlays.afterLabelRef.current.style.left = `${canvasData.left + canvasData.width - 64}px`;
      p.overlays.afterLabelRef.current.style.top = `${canvasData.top + 16}px`;
    }
    if (p.overlays.compareDividerRef.current) {
      const pct = p.latestComparePercentRef.current ?? 50;
      p.overlays.compareDividerRef.current.style.left = `${canvasData.left + (pct / 100) * canvasData.width}px`;
      p.overlays.compareDividerRef.current.style.top = `${canvasData.top}px`;
      p.overlays.compareDividerRef.current.style.height = `${canvasData.height}px`;
    }

    const prev = latestImageRectRef.current;
    if (!prev) {
      setImageRect({
        left: canvasData.left,
        top: canvasData.top,
        width: canvasData.width,
        height: canvasData.height,
      });
      setTimeout(() => p.onCanvasRedrawRequest(), 0);
    } else if (
      prev.left !== canvasData.left ||
      prev.top !== canvasData.top ||
      prev.width !== canvasData.width ||
      prev.height !== canvasData.height
    ) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setImageRect({
          left: canvasData.left,
          top: canvasData.top,
          width: canvasData.width,
          height: canvasData.height,
        });
      }, 100);
    }
  }, [p]);

  // Reset on src change
  useEffect(() => {
    setImageRect(null);
  }, [p.currentImageSrc]);

  return {
    imageRect,
    setImageRect,
    isDraggingSliderRef,
    updateImageRect,
  };
}
