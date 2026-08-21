/**
 * useCtrlPan.ts
 * Custom hook encapsulating Ctrl+drag canvas panning logic.
 */

import React from 'react';
import type Cropper from 'cropperjs';

interface UseCtrlPanOptions {
  cropperRef: React.RefObject<Cropper | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  updateImageRect: () => void;
}

interface UseCtrlPanReturn {
  isCtrlPressed: boolean;
  isDragging: boolean;
}

export function useCtrlPan({
  cropperRef,
  containerRef,
  updateImageRect,
}: UseCtrlPanOptions): UseCtrlPanReturn {
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Monitor Ctrl key globally
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
        setIsDragging(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
      setIsDragging(false);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });
    window.addEventListener('blur', handleBlur, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Prevent context menu when Ctrl is held
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (isCtrlPressed) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [isCtrlPressed]);

  // Capture mousedown on the container for panning when Ctrl is held
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDownCapture = (e: MouseEvent) => {
      if (e.ctrlKey && (e.button === 0 || e.button === 2)) {
        e.preventDefault();
        e.stopPropagation();

        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    container.addEventListener('mousedown', handleMouseDownCapture, true);
    return () => {
      container.removeEventListener('mousedown', handleMouseDownCapture, true);
    };
  }, [containerRef]);

  // Window-level mousemove and mouseup for fluid offsite dragging
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !cropperRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const cropper = cropperRef.current;
      if (cropper) {
        cropper.move(dx, dy);
        updateImageRect();
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('blur', handleMouseUp, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
    };
  }, [isDragging, cropperRef, updateImageRect]);

  return { isCtrlPressed, isDragging };
}
