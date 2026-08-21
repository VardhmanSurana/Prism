/**
 * useCropperSetup.ts
 * Custom hook encapsulating CropperJS initialization, container resize syncing,
 * and tool mode switching.
 */

import React from 'react';
import Cropper from 'cropperjs';
import type { ToolId } from './Sidebar';

interface UseCropperSetupOptions {
  imgRef: React.RefObject<HTMLImageElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  cropperRef: React.RefObject<Cropper | null>;
  currentImageSrc: string;
  activeTool: ToolId | null;
  handleCropEvent: () => void;
  handleReady: () => void;
  updateImageRect: () => void;
  syncZoom: () => void;
}

export function useCropperSetup({
  imgRef,
  containerRef,
  cropperRef,
  currentImageSrc,
  activeTool,
  handleCropEvent,
  handleReady,
  updateImageRect,
  syncZoom,
}: UseCropperSetupOptions): void {
  // Initialize cropperjs on the <img> element
  const onCropCbRef = React.useRef(handleCropEvent);
  React.useEffect(() => { onCropCbRef.current = handleCropEvent; }, [handleCropEvent]);

  const onCropperReady = React.useCallback(() => {
    handleReady();
    updateImageRect();
    syncZoom();
  }, [handleReady, updateImageRect, syncZoom]);

  const onReadyCbRef = React.useRef(onCropperReady);
  React.useEffect(() => { onReadyCbRef.current = onCropperReady; }, [onCropperReady]);

  React.useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentImageSrc) return;

    const cropper = new Cropper(img, {
      viewMode: 1,
      dragMode: 'crop',
      background: false,
      responsive: true,
      autoCrop: true,
      autoCropArea: 1,
      checkOrientation: false,
      rotatable: true,
      zoomable: true,
      zoomOnWheel: false,
      zoomOnTouch: false,
      toggleDragModeOnDblclick: false,
      crop() {
        onCropCbRef.current();
      },
      ready() {
        onReadyCbRef.current();
      },
    });

    if (cropperRef && typeof cropperRef !== 'function') {
      (cropperRef as React.MutableRefObject<any>).current = cropper;
    }

    return () => {
      cropper.destroy();
      if (cropperRef && typeof cropperRef !== 'function') {
        (cropperRef as React.MutableRefObject<any>).current = null;
      }
    };
  }, [currentImageSrc, cropperRef, imgRef]);

  // Sync rect on container resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      // Small delay to allow cropperjs to finish its internal update
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const cropper = cropperRef.current;
        if (cropper) {
          // Guard: cropper internals may not be mounted yet, causing "container.offsetWidth" crash
          const innerContainer = (cropper as any).$container;
          if (innerContainer && innerContainer.offsetWidth > 0) {
            (cropper as any).resize();
          }
        }
        updateImageRect();
      }, 50);
    });

    observer.observe(containerRef.current);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [updateImageRect, cropperRef, containerRef]);

  // Handle tool changes and cropper state
  React.useEffect(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    const frame = window.requestAnimationFrame(() => {
      try {
        (cropper as any).resize();
      } catch {}

      if (activeTool === 'transform') {
        cropper.enable();
        cropper.setDragMode('crop');
        cropper.crop();
        syncZoom();
      } else {
        // For inpaint and other tools, keep it enabled so it handles resize
        // but disable interaction and clearing crop box
        cropper.enable();
        cropper.setDragMode('none');
        cropper.clear();
        // Defer updateImageRect to allow cropper to update internal state after clear()
        setTimeout(() => {
          updateImageRect();
          syncZoom();
        }, 50);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTool, cropperRef, updateImageRect, syncZoom]);
}
