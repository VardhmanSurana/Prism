import React, { useState, useRef, useCallback } from 'react';
import { useEditorUIStore } from '../store/uiStore';

interface UseLightboxGesturesProps {
  onNext: () => void;
  onPrev: () => void;
}

const ZOOM_MIN = 1.0;
const ZOOM_MAX = 10;

export const useLightboxGestures = ({ onNext, onPrev }: UseLightboxGesturesProps) => {
  const zoom = useEditorUIStore((s) => s.zoom);
  const setZoom = useEditorUIStore((s) => s.setZoom);
  const resetZoom = useEditorUIStore((s) => s.resetZoom);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const pointers = useRef<Map<number, React.PointerEvent<HTMLDivElement>>>(new Map());
  const lastPinchDistance = useRef<number | null>(null);

  const zoomScale = zoom.scale;
  const offset = { x: zoom.offsetX, y: zoom.offsetY };

  const resetInteraction = useCallback(() => {
    resetZoom();
    setIsDragging(false);
  }, [resetZoom]);

  const setZoomScale = useCallback((newScale: number) => {
    const nextScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));
    if (nextScale <= 1.0) {
      setZoom({
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        mode: 'fit',
      });
    } else {
      setZoom({
        scale: nextScale,
        mode: 'custom',
      });
    }
  }, [setZoom]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (zoomScale > 1) {
      resetInteraction();
    } else {
      setZoom({ scale: 2.0, mode: 'custom' });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, e);

    if (pointers.current.size === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragStartOffset.current = { x: offset.x, y: offset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, e);

    if (isDragging && pointers.current.size === 1) {
      if (zoomScale > 1) {
        const newX = dragStartOffset.current.x + (e.clientX - dragStart.current.x);
        const newY = dragStartOffset.current.y + (e.clientY - dragStart.current.y);
        const bound = 500 * (zoomScale - 1);
        setZoom({
          offsetX: Math.max(-bound, Math.min(bound, newX)),
          offsetY: Math.max(-bound, Math.min(bound, newY)),
        });
      }
    }

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values()) as React.PointerEvent<HTMLDivElement>[];
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);

      if (lastPinchDistance.current !== null) {
        const delta = dist / lastPinchDistance.current;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale * delta));

        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;

        if (newScale <= 1.0) {
          setZoom({
            scale: 1.0,
            offsetX: 0,
            offsetY: 0,
            mode: 'fit',
          });
        } else {
          setZoom({
            scale: newScale,
            offsetX: midX - (midX - offset.x) * (newScale / zoomScale),
            offsetY: midY - (midY - offset.y) * (newScale / zoomScale),
            mode: 'custom',
          });
        }
      }
      lastPinchDistance.current = dist;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging && zoomScale === 1 && pointers.current.size === 1) {
      const diffX = e.clientX - dragStart.current.x;
      if (Math.abs(diffX) > 60) {
        if (diffX > 0) onPrev();
        else onNext();
      }
    }

    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastPinchDistance.current = null;
    if (pointers.current.size === 0) setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale * (1 + delta)));

    if (newScale !== zoomScale) {
      if (newScale <= 1.0) {
        setZoom({
          scale: 1.0,
          offsetX: 0,
          offsetY: 0,
          mode: 'fit',
        });
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const containerCenterX = rect.left + rect.width / 2;
        const containerCenterY = rect.top + rect.height / 2;
        const relX = e.clientX - containerCenterX;
        const relY = e.clientY - containerCenterY;

        const ratio = newScale / zoomScale;
        const newOffsetX = relX - (relX - offset.x) * ratio;
        const newOffsetY = relY - (relY - offset.y) * ratio;

        setZoom({
          scale: newScale,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
          mode: 'custom',
        });
      }
    }
  };

  return {
    zoomScale,
    setZoomScale,
    offset,
    isDragging,
    resetInteraction,
    handleDoubleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
  };
};
