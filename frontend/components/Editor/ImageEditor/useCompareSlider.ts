/**
 * useCompareSlider.ts
 * Custom hook encapsulating the before/after split-view compare slider.
 */

import React from 'react';

interface UseCompareSliderOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  latestImageRectRef: React.RefObject<{ left: number; top: number; width: number; height: number } | null>;
}

interface UseCompareSliderReturn {
  comparePercent: number;
  handleComparePointerDown: (e: React.PointerEvent) => void;
  handleComparePointerMove: (e: React.PointerEvent) => void;
  handleComparePointerUp: (e: React.PointerEvent) => void;
}

export function useCompareSlider({
  containerRef,
  latestImageRectRef,
}: UseCompareSliderOptions): UseCompareSliderReturn {
  const [comparePercent, setComparePercent] = React.useState<number>(50);
  const [isDraggingCompare, setIsDraggingCompare] = React.useState<boolean>(false);

  const handleComparePointerDown = React.useCallback((e: React.PointerEvent) => {
    setIsDraggingCompare(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleComparePointerMove = React.useCallback((e: React.PointerEvent) => {
    const pointerId = e.pointerId;
    if (!e.currentTarget.hasPointerCapture(pointerId) || !latestImageRectRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - latestImageRectRef.current.left;
    const percent = Math.max(0, Math.min(100, (x / latestImageRectRef.current.width) * 100));
    setComparePercent(percent);
  }, [containerRef, latestImageRectRef]);

  const handleComparePointerUp = React.useCallback((e: React.PointerEvent) => {
    setIsDraggingCompare(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return {
    comparePercent,
    handleComparePointerDown,
    handleComparePointerMove,
    handleComparePointerUp,
  };
}
