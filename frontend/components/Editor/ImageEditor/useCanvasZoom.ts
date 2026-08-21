/**
 * useCanvasZoom.ts
 * Custom hook encapsulating zoom logic for the canvas area.
 */

import React from 'react';
import type Cropper from 'cropperjs';

interface UseCanvasZoomOptions {
  cropperRef: React.RefObject<Cropper | null>;
  updateImageRect: () => void;
}

interface UseCanvasZoomReturn {
  zoomPercent: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleZoomToPercent: (pct: number) => void;
  syncZoom: () => void;
}

export function useCanvasZoom({
  cropperRef,
  updateImageRect,
}: UseCanvasZoomOptions): UseCanvasZoomReturn {
  const [zoomPercent, setZoomPercent] = React.useState(100);
  const zoomDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    };
  }, []);

  const syncZoom = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    try {
      const imageData  = cropper.getImageData();
      const canvasData = cropper.getCanvasData();
      if (imageData.naturalWidth > 0) {
        const pct = (canvasData.width / imageData.naturalWidth) * 100;
        // Debounce setZoomPercent to avoid heavy CanvasArea re-renders
        if (zoomDebounceRef.current) {
          clearTimeout(zoomDebounceRef.current);
        }
        zoomDebounceRef.current = setTimeout(() => {
          setZoomPercent(Math.round(pct));
        }, 100);
      }
    } catch { /* cropper not ready */ }
  }, [cropperRef]);

  const handleZoomIn = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const imageData = cropper.getImageData();
    const currentZoom = (cropper.getCanvasData().width / imageData.naturalWidth) * 100;
    const maxZoom = 500; // max 500%
    if (currentZoom < maxZoom) {
      // Smooth zoom using smaller increments
      const targetZoom = Math.min(maxZoom, currentZoom + 15);
      const scale = targetZoom / currentZoom;
      cropper.zoom(scale - 1);
      syncZoom();
      updateImageRect();
    }
  }, [cropperRef, syncZoom, updateImageRect]);

  const handleZoomOut = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const imageData = cropper.getImageData();
    const currentZoom = (cropper.getCanvasData().width / imageData.naturalWidth) * 100;
    const minZoom = 10; // min 10%
    if (currentZoom > minZoom) {
      // Smooth zoom using smaller increments
      const targetZoom = Math.max(minZoom, currentZoom - 15);
      const scale = targetZoom / currentZoom;
      cropper.zoom(scale - 1);
      syncZoom();
      updateImageRect();
    }
  }, [cropperRef, syncZoom, updateImageRect]);

  const handleZoomReset = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const containerData = cropper.getContainerData();
    const imageData     = cropper.getImageData();
    const scale = Math.min(
      (containerData.width  * 0.95) / imageData.naturalWidth,
      (containerData.height * 0.95) / imageData.naturalHeight,
    );
    cropper.zoomTo(scale);
    syncZoom();
    updateImageRect();
  }, [cropperRef, syncZoom, updateImageRect]);

  const handleZoomToPercent = React.useCallback((pct: number) => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const scale = pct / 100;
    cropper.zoomTo(scale);
    syncZoom();
    updateImageRect();
  }, [cropperRef, syncZoom, updateImageRect]);

  return {
    zoomPercent,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomToPercent,
    syncZoom,
  };
}
