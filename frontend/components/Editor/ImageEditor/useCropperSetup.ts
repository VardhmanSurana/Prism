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
    const cropper = cropperRef.current;
    if (cropper) {
      const containerData = cropper.getContainerData();
      const imageData = cropper.getImageData();
      if (
        containerData.width > 0 &&
        containerData.height > 0 &&
        imageData.naturalWidth > 0 &&
        imageData.naturalHeight > 0
      ) {
        const scale = Math.min(
          (containerData.width * 0.95) / imageData.naturalWidth,
          (containerData.height * 0.95) / imageData.naturalHeight,
        );
        cropper.zoomTo(scale);
      }
    }
    handleReady();
    updateImageRect();
    syncZoom();
  }, [handleReady, updateImageRect, syncZoom, cropperRef]);

  const onReadyCbRef = React.useRef(onCropperReady);
  React.useEffect(() => { onReadyCbRef.current = onCropperReady; }, [onCropperReady]);

  React.useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentImageSrc) return;

    const isTransform = activeTool === 'transform';
    const cropper = new Cropper(img, {
      viewMode: isTransform ? 1 : 0,
      dragMode: isTransform ? 'crop' : 'none',
      background: false,
      responsive: true,
      autoCrop: isTransform,
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

    // Ensure onCropperReady runs even if image was already decoded or cached during HMR/fast-load
    const frameId = requestAnimationFrame(() => {
      try {
        const canvasData = cropper.getCanvasData();
        if (canvasData && canvasData.width > 0 && canvasData.height > 0) {
          onReadyCbRef.current();
        }
      } catch {}
    });

    return () => {
      cancelAnimationFrame(frameId);
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
        (cropper as any).options.viewMode = 1;
        cropper.enable();
        cropper.setDragMode('crop');
        cropper.crop();
        syncZoom();
        updateImageRect();
      } else {
        (cropper as any).options.viewMode = 0;
        cropper.enable();
        cropper.setDragMode('none');
        cropper.clear();
        updateImageRect();
        syncZoom();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTool, cropperRef, updateImageRect, syncZoom]);
}
