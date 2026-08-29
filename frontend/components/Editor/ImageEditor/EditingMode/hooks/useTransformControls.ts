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

export interface UseTransformControlsParams {
  src: string;
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
      const croppedCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      croppedCanvas.toBlob((blob) => {
        if (!blob) return;

        const newUrl = URL.createObjectURL(blob);
        p.history.createdUrlRef.current = newUrl;

        p.setCurrentImageSrc(newUrl);
        setHasCropSelection(false);

        p.setTotalRotation(0);
        p.setStraightenAngle(0);
        p.setFlipH(false);
        p.setFlipV(false);

        p.history.addHistoryEntry('crop' as HistoryActionType, 'Applied crop', undefined, newUrl);
      }, 'image/jpeg', 0.95);
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

    cropper.setCanvasData({
      width: newWidth,
      height: newHeight,
      left: (containerData.width - newWidth) / 2,
      top: (containerData.height - newHeight) / 2,
    });

    if (!isNaN(currentRatio)) {
      const newRatio = 1 / currentRatio;
      setCurrentRatio(newRatio);
      cropper.setAspectRatio(newRatio);
    } else {
      cropper.crop();
    }
  }, [p, currentRatio]);

  const handleSetAspectRatio = useCallback((ratio: number) => {
    setCurrentRatio(ratio);
    p.cropperRef.current?.setAspectRatio(ratio);
  }, [p.cropperRef]);

  const handleReady = useCallback(() => {
    const cropper = p.cropperRef.current;
    if (!cropper) return;

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
    cropper.setCropBoxData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    cropper.setCanvasData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });

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
    activeToolRef.current = tool;
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    if (tool !== 'transform') {
      const cropBoxData = cropper.getCropBoxData();
      savedCropBoxRef.current = cropBoxData;

      cropper.clear();
      cropper.setDragMode('none');
    } else {
      cropper.setDragMode('crop');
      cropper.crop();
      if (savedCropBoxRef.current) {
        cropper.setCropBoxData(savedCropBoxRef.current);
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
