import React from 'react';
import { MIN_ZOOM, MAX_ZOOM } from './utils/imageUtils';

interface UseCanvasZoomOptions {
  updateImageRect: () => void;
  onZoomChange?: (pct: number) => void;
  cropperRef?: React.RefObject<any>; // Optional for backward compatibility
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
  updateImageRect,
  onZoomChange,
}: UseCanvasZoomOptions): UseCanvasZoomReturn {
  const [zoomPercent, setZoomPercent] = React.useState(100);

  const applyZoom = React.useCallback((pct: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(pct)));
    setZoomPercent(clamped);
    onZoomChange?.(clamped);
    setTimeout(() => updateImageRect(), 0);
  }, [onZoomChange, updateImageRect]);

  const handleZoomIn = React.useCallback(() => {
    applyZoom(zoomPercent + 15);
  }, [applyZoom, zoomPercent]);

  const handleZoomOut = React.useCallback(() => {
    applyZoom(zoomPercent - 15);
  }, [applyZoom, zoomPercent]);

  const handleZoomReset = React.useCallback(() => {
    applyZoom(100);
  }, [applyZoom]);

  const handleZoomToPercent = React.useCallback((pct: number) => {
    applyZoom(pct);
  }, [applyZoom]);

  const syncZoom = React.useCallback(() => {
    // Keep in sync with current state
  }, []);

  return {
    zoomPercent,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomToPercent,
    syncZoom,
  };
}
