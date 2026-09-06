/**
 * useImageRectSync.ts
 * Bridges the image viewport geometry with React state and with all overlay
 * container refs that need to follow the image canvas in zero-lag lockstep.
 * Also owns the slider-drag fast-path trigger for re-renders.
 */
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
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
  containerRef: React.RefObject<HTMLDivElement | null>;
  sourceImg: HTMLImageElement | null;
  zoomPercent: number;
  panOffset: { x: number; y: number };
  cropperRef?: MutableRefObject<any>;
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
    let canvasData: { left: number; top: number; width: number; height: number } | null = null;

    if (p.containerRef.current && p.sourceImg) {
      const container = p.containerRef.current;
      const cW = container.clientWidth;
      const cH = container.clientHeight;
      const natW = p.sourceImg.naturalWidth;
      const natH = p.sourceImg.naturalHeight;

      if (cW > 0 && cH > 0 && natW > 0 && natH > 0) {
        const baseScale = Math.min((cW * 0.95) / natW, (cH * 0.95) / natH);
        const zoom = (p.zoomPercent || 100) / 100;
        const width = Math.round(natW * baseScale * zoom);
        const height = Math.round(natH * baseScale * zoom);
        const left = Math.round((cW - width) / 2 + (p.panOffset?.x || 0));
        const top = Math.round((cH - height) / 2 + (p.panOffset?.y || 0));
        canvasData = { left, top, width, height };
      }
    }

    if (!canvasData && p.cropperRef?.current?.getCanvasData) {
      canvasData = p.cropperRef.current.getCanvasData();
    }

    if (!canvasData || !canvasData.width || !canvasData.height || canvasData.width <= 0 || canvasData.height <= 0) {
      return;
    }

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
        if (!canvasData) return;
        setImageRect({
          left: canvasData.left,
          top: canvasData.top,
          width: canvasData.width,
          height: canvasData.height,
        });
        p.onCanvasRedrawRequest();
      }, 30);
    }
  }, [p]);

  useEffect(() => {
    updateImageRect();
  }, [updateImageRect, p.sourceImg, p.zoomPercent, p.panOffset]);

  useEffect(() => {
    const handleResize = () => updateImageRect();
    window.addEventListener('resize', handleResize);
    const container = p.containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateImageRect());
      observer.observe(container);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [updateImageRect, p.containerRef]);

  return { imageRect, setImageRect, isDraggingSliderRef, updateImageRect };
}
