/**
 * useTransformControls.ts
 * Cropper-backed transform state and handlers: rotate, flip, straighten,
 * aspect ratio, in-place crop apply/reset, drag-mode sync, and the
 * `setActiveTool` callback that toggles cropper drag-mode.
 */
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import { HistoryActionType } from '../../history';
import { useEditingHistory } from '../useEditingHistory';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { remapAnnotationToCrop } from '../../editedPreviewHelper';

export interface UseTransformControlsParams {
  src: string;
  currentImageSrc: string;
  cropperRef: MutableRefObject<Cropper | null>;
  flipH: boolean;
  setFlipH: (v: boolean) => void;
  flipV: boolean;
  setFlipV: (v: boolean) => void;
  totalRotation: number;
  setTotalRotation: (n: number) => void;
  straightenAngle: number;
  setStraightenAngle: (n: number) => void;
  setCurrentImageSrc: (s: string) => void;
  history: ReturnType<typeof useEditingHistory>;
  annotations?: Annotation[];
  onAnnotationsChange?: (annotations: Annotation[]) => void;
}

export function useTransformControls(p: UseTransformControlsParams) {
  const [currentRatio, setCurrentRatio] = useState<number>(NaN);
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const savedCropBoxRef = useRef<Cropper.CropBoxData | null>(null);
  const activeToolRef = useRef<string | null>(null);

  useEffect(() => {
    setHasCropSelection(false);
  }, [p.src]);

  const handleCropEvent = useCallback(() => {
    if (activeToolRef.current !== 'transform') {
      setHasCropSelection(false);
      return;
    }

    const cropper = p.cropperRef.current;
    if (!cropper) return;

    const cropBoxData = cropper.getCropBoxData();
    const canvasData = cropper.getCanvasData();

    if (!cropBoxData || !canvasData) return;

    const isSub =
      cropBoxData.width > 0 && cropBoxData.height > 0 &&
      (
        cropBoxData.width < canvasData.width * 0.985 ||
        cropBoxData.height < canvasData.height * 0.985 ||
        cropBoxData.left > canvasData.left + 3 ||
        cropBoxData.top > canvasData.top + 3
      );

    setHasCropSelection(prev => (prev !== isSub ? isSub : prev));
  }, [p.cropperRef]);

  const handleApplyCrop = useCallback(() => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    try {
      // Capture crop coordinates and dimensions before changing anything
      const cropData = cropper.getData();
      const imgData = cropper.getImageData();

      // Ensure cropped canvas is generated from the clean base image so active adjustments remain non-destructive
      const prevImg = (cropper as any).image;
      const baseSrc = p.currentImageSrc || p.src;

      const finishCrop = (canvas: HTMLCanvasElement) => {
        canvas.toBlob((blob) => {
          if (!blob) return;

          const newUrl = URL.createObjectURL(blob);
          p.history.createdUrlRef.current = newUrl;

          // Remap annotations if present
          if (p.annotations && p.onAnnotationsChange && cropData.width > 0 && cropData.height > 0 && imgData.naturalWidth > 0) {
            const nextAnns = p.annotations.map(a =>
              remapAnnotationToCrop(a, cropData.x, cropData.y, cropData.width, cropData.height, imgData.naturalWidth, imgData.naturalHeight)
            );
            p.onAnnotationsChange(nextAnns);
          }

          p.setCurrentImageSrc(newUrl);
          setHasCropSelection(false);

          p.setTotalRotation(0);
          p.setStraightenAngle(0);
          p.setFlipH(false);
          p.setFlipV(false);

          p.history.addHistoryEntry('crop' as HistoryActionType, 'Applied crop', undefined, newUrl, undefined, {
            toolId: 'transform',
            isSnapshot: true,
          });
        }, 'image/jpeg', 0.95);
      };

      if (baseSrc && prevImg && prevImg.src !== baseSrc) {
        const baseImg = new Image();
        baseImg.crossOrigin = 'anonymous';
        baseImg.onload = () => {
          (cropper as any).image = baseImg;
          const croppedCanvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
          });
          (cropper as any).image = prevImg;
          if (croppedCanvas) finishCrop(croppedCanvas);
        };
        baseImg.onerror = () => {
          const croppedCanvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
          });
          if (croppedCanvas) finishCrop(croppedCanvas);
        };
        baseImg.src = baseSrc;
      } else {
        const croppedCanvas = cropper.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });
        if (croppedCanvas) finishCrop(croppedCanvas);
      }
    } catch (e) {
      console.error('Failed to apply crop in-place:', e);
    }
  }, [p]);

  const handleResetCrop = useCallback(() => {
    p.setCurrentImageSrc(p.src);
    setHasCropSelection(false);

    p.setTotalRotation(0);
    p.setStraightenAngle(0);
    p.setFlipH(false);
    p.setFlipV(false);
  }, [p]);

  const handleRotate = useCallback((degree: number) => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    const newTotal = ((p.totalRotation + degree) % 360 + 360) % 360;
    p.setTotalRotation(newTotal);

    cropper.clear();
    cropper.rotate(degree);

    const containerData = cropper.getContainerData();
    const imageData = cropper.getImageData();
    const isSideways = newTotal === 90 || newTotal === 270;
    const displayW = isSideways ? imageData.naturalHeight : imageData.naturalWidth;
    const displayH = isSideways ? imageData.naturalWidth : imageData.naturalHeight;

    const scale = Math.min(
      (containerData.width * 0.95) / displayW,
      (containerData.height * 0.95) / displayH,
    );
    const newWidth = displayW * scale;
    const newHeight = displayH * scale;

    const newLeft = (containerData.width - newWidth) / 2;
    const newTop = (containerData.height - newHeight) / 2;

    cropper.setCanvasData({
      width: newWidth,
      height: newHeight,
      left: newLeft,
      top: newTop,
    });

    (cropper as any).limited = true;
    (cropper as any).options.viewMode = 1;

    if (!isNaN(currentRatio)) {
      const newRatio = 1 / currentRatio;
      setCurrentRatio(newRatio);
      cropper.setAspectRatio(newRatio);
    } else if (activeToolRef.current === 'transform') {
      cropper.crop();
      cropper.setCropBoxData({
        left: newLeft,
        top: newTop,
        width: newWidth,
        height: newHeight,
      });
    }
  }, [p, currentRatio]);

  const handleSetAspectRatio = useCallback((ratio: number) => {
    setCurrentRatio(ratio);
    const cropper = p.cropperRef.current;
    if (!cropper) return;
    (cropper as any).limited = true;
    (cropper as any).options.viewMode = 1;
    cropper.setAspectRatio(ratio);
  }, [p.cropperRef]);

  const handleReady = useCallback(() => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    (cropper as any).limited = true;
    (cropper as any).options.viewMode = 1;

    const containerData = cropper.getContainerData();
    const canvasData = cropper.getCanvasData();

    const scale = Math.min(
      (containerData.width * 0.95) / canvasData.width,
      (containerData.height * 0.95) / canvasData.height,
    );

    const newWidth = canvasData.width * scale;
    const newHeight = canvasData.height * scale;
    const newLeft = (containerData.width - newWidth) / 2;
    const newTop = (containerData.height - newHeight) / 2;

    cropper.setCanvasData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });

    if (activeToolRef.current === 'transform') {
      cropper.setCropBoxData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    }

    cropper.scaleX(p.flipH ? -1 : 1);
    cropper.scaleY(p.flipV ? -1 : 1);
    if (typeof (cropper as any).rotateTo === 'function') {
      (cropper as any).rotateTo(p.totalRotation);
    } else {
      cropper.rotate(p.totalRotation);
    }
    p.history.isRestoringHistory.current = false;
  }, [p.flipH, p.flipV, p.totalRotation, p.cropperRef, p.history.isRestoringHistory]);

  const handleFlipH = useCallback(() => {
    const next = !p.flipH;
    p.setFlipH(next);
    p.cropperRef.current?.scaleX(next ? -1 : 1);
  }, [p.flipH, p.setFlipH, p.cropperRef]);

  const handleFlipV = useCallback(() => {
    const next = !p.flipV;
    p.setFlipV(next);
    p.cropperRef.current?.scaleY(next ? -1 : 1);
  }, [p.flipV, p.setFlipV, p.cropperRef]);

  const handleStraighten = useCallback((angle: number) => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;
    const delta = angle - p.straightenAngle;
    p.setStraightenAngle(angle);
    cropper.rotate(delta);
  }, [p.straightenAngle, p.setStraightenAngle, p.cropperRef]);

  // Sync cropper drag-mode with the active tool from the parent.
  const setActiveTool = useCallback((tool: string | null) => {
    if (activeToolRef.current === tool) {
      return;
    }
    activeToolRef.current = tool;
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    (cropper as any).limited = true;
    (cropper as any).options.viewMode = 1;

    if (tool !== 'transform') {
      const cropBoxData = cropper.getCropBoxData();
      if (cropBoxData && cropBoxData.width > 0 && cropBoxData.height > 0) {
        savedCropBoxRef.current = cropBoxData;
      }

      cropper.clear();
      cropper.setDragMode('none');
    } else {
      cropper.setDragMode('crop');
      cropper.crop();

      const canvasData = cropper.getCanvasData();
      if (
        savedCropBoxRef.current &&
        savedCropBoxRef.current.width > 0 &&
        savedCropBoxRef.current.height > 0 &&
        canvasData &&
        canvasData.width > 0 &&
        canvasData.height > 0
      ) {
        const width = Math.min(savedCropBoxRef.current.width, canvasData.width);
        const height = Math.min(savedCropBoxRef.current.height, canvasData.height);
        const maxLeft = canvasData.left + canvasData.width - width;
        const maxTop = canvasData.top + canvasData.height - height;
        const left = Math.max(canvasData.left, Math.min(savedCropBoxRef.current.left, maxLeft));
        const top = Math.max(canvasData.top, Math.min(savedCropBoxRef.current.top, maxTop));
        cropper.setCropBoxData({ left, top, width, height });
      } else if (canvasData && canvasData.width > 0 && canvasData.height > 0) {
        cropper.setCropBoxData({
          left: canvasData.left,
          top: canvasData.top,
          width: canvasData.width,
          height: canvasData.height,
        });
      }
    }
  }, [p.cropperRef]);

  return {
    currentRatio,
    hasCropSelection,
    straightenAngle: p.straightenAngle,
    setActiveTool,
    handleCropEvent,
    handleApplyCrop,
    handleResetCrop,
    handleRotate,
    handleSetAspectRatio,
    handleReady,
    handleFlipH,
    handleFlipV,
    handleStraighten,
  };
}
