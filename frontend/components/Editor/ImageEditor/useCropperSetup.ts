/**
 * useCropperSetup.ts
 * Custom hook encapsulating CropperJS initialization, container resize syncing,
 * and tool mode switching.
 */

import React from 'react';
import Cropper from 'cropperjs';
import type { ToolId } from './Sidebar';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import type { HealingCanvasRef } from './HealingCanvas';
import { getEditedPreviewUrl } from './editedPreviewHelper';

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
  liveCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  healingCanvasRef?: React.Ref<HealingCanvasRef>;
  annotations?: Annotation[];
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
  liveCanvasRef,
  healingCanvasRef,
  annotations,
}: UseCropperSetupOptions): void {
  // Initialize cropperjs on the <img> element
  const onCropCbRef = React.useRef(handleCropEvent);
  React.useEffect(() => { onCropCbRef.current = handleCropEvent; }, [handleCropEvent]);

  const onCropperReady = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (cropper) {
      (cropper as any).limited = true;
      (cropper as any).options.viewMode = 1;
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
      if (activeTool !== 'transform') {
        cropper.disable();
      }
    }
    handleReady();
    updateImageRect();
    syncZoom();
  }, [handleReady, updateImageRect, syncZoom, cropperRef, activeTool]);

  const onReadyCbRef = React.useRef(onCropperReady);
  React.useEffect(() => { onReadyCbRef.current = onCropperReady; }, [onCropperReady]);

  React.useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentImageSrc) return;

    const isTransform = activeTool === 'transform';
    const cropper = new Cropper(img, {
      viewMode: 1, // Constrain crop box to never exceed canvas (image) bounds
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
      guides: true,
      center: false,
      highlight: false,
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

    // Fresh instances start enabled — lock immediately unless transforming
    // (the tool-change effect early-returns when activeTool didn't change)
    if (activeTool !== 'transform') {
      cropper.disable();
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

  const prevToolRef = React.useRef<ToolId | null>(null);
  const updateImageRectRef = React.useRef(updateImageRect);
  updateImageRectRef.current = updateImageRect;
  const syncZoomRef = React.useRef(syncZoom);
  syncZoomRef.current = syncZoom;

  // Handle tool changes and cropper state
  React.useEffect(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    const wasTransform = prevToolRef.current === 'transform';
    prevToolRef.current = activeTool;

    (cropper as any).limited = true;
    (cropper as any).options.viewMode = 1;

    if (activeTool === 'transform') {
      cropper.enable();
      const liveCanvas = liveCanvasRef?.current;
      if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0) {
        const healingCanvas = (healingCanvasRef && typeof healingCanvasRef === 'object' && 'current' in healingCanvasRef)
          ? healingCanvasRef.current?.getWorkCanvas() || null
          : null;
        void getEditedPreviewUrl(liveCanvas, healingCanvas, annotations).then((url) => {
          if (url && cropperRef.current && typeof cropperRef.current.replace === 'function' && prevToolRef.current === 'transform') {
            cropperRef.current.replace(url, true);
          }
        });
      }
      cropper.setDragMode('crop');
      cropper.crop();
      syncZoomRef.current();
      updateImageRectRef.current();
    } else {
      if (wasTransform && cropperRef.current && typeof cropperRef.current.replace === 'function') {
        cropperRef.current.replace(currentImageSrc, true);
      }
      cropper.enable();
      cropper.setDragMode('none');
      cropper.clear();
      // ponytail: lock event-driven canvas moves while annotating — programmatic
      // move()/zoom() used by pan/zoom controls ignore `disabled`, only pointer
      // entry points (drag, dblclick-toggle, wheel) are blocked, so pen strokes
      // can never drag the image no matter which element receives the event
      cropper.disable();
      updateImageRectRef.current();
      syncZoomRef.current();
    }
  }, [activeTool, cropperRef, currentImageSrc, liveCanvasRef, healingCanvasRef, annotations]);
}
