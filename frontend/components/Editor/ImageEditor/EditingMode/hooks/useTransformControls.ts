/**
 * useTransformControls.ts
 * Native in-app transform state and handlers: rotate, flip, straighten,
 * aspect ratio, in-place crop apply/reset, and active tool synchronization.
 * Completely replaces legacy Cropper.js implementation.
 */
import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { HistoryActionType } from '../../history';
import { useEditingHistory } from '../useEditingHistory';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { remapAnnotationToCrop } from '../../editedPreviewHelper';
import type { CropNormalizedRect } from '../../CanvasArea/overlays/CropOverlay';

export interface UseTransformControlsParams {
  src: string;
  currentImageSrc: string;
  cropperRef?: MutableRefObject<any>; // Retained for backward compatibility
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
  const [cropRect, setCropRect] = useState<CropNormalizedRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const activeToolRef = useRef<string | null>(null);

  useEffect(() => {
    setHasCropSelection(false);
    setCropRect({ x: 0, y: 0, width: 1, height: 1 });
  }, [p.src, p.currentImageSrc]);

  const handleCropChange = useCallback((crop: CropNormalizedRect) => {
    setCropRect(crop);
    const isSub =
      crop.width < 0.985 ||
      crop.height < 0.985 ||
      crop.x > 0.015 ||
      crop.y > 0.015;
    setHasCropSelection(isSub);
  }, []);

  const handleCropEvent = useCallback(() => {
    // Kept for backward compatibility
  }, []);

  const handleApplyCrop = useCallback(() => {
    try {
      const baseSrc = p.currentImageSrc || p.src;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        if (natW <= 0 || natH <= 0) return;

        const sx = Math.max(0, Math.round(cropRect.x * natW));
        const sy = Math.max(0, Math.round(cropRect.y * natH));
        const sw = Math.min(natW - sx, Math.max(1, Math.round(cropRect.width * natW)));
        const sh = Math.min(natH - sy, Math.max(1, Math.round(cropRect.height * natH)));

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        canvas.toBlob((blob) => {
          if (!blob) return;

          const newUrl = URL.createObjectURL(blob);
          p.history.createdUrlRef.current = newUrl;

          // Remap annotations if present
          if (p.annotations && p.onAnnotationsChange && sw > 0 && sh > 0 && natW > 0) {
            const nextAnns = p.annotations.map(a =>
              remapAnnotationToCrop(a, sx, sy, sw, sh, natW, natH)
            );
            p.onAnnotationsChange(nextAnns);
          }

          p.setCurrentImageSrc(newUrl);
          setHasCropSelection(false);
          setCropRect({ x: 0, y: 0, width: 1, height: 1 });

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

      img.src = baseSrc;
    } catch (e) {
      console.error('Failed to apply crop in-place:', e);
    }
  }, [p, cropRect]);

  const handleResetCrop = useCallback(() => {
    p.setCurrentImageSrc(p.src);
    setHasCropSelection(false);
    setCropRect({ x: 0, y: 0, width: 1, height: 1 });

    p.setTotalRotation(0);
    p.setStraightenAngle(0);
    p.setFlipH(false);
    p.setFlipV(false);
  }, [p]);

  const handleRotate = useCallback((degree: number) => {
    const newTotal = ((p.totalRotation + degree) % 360 + 360) % 360;
    p.setTotalRotation(newTotal);

    if (!isNaN(currentRatio) && currentRatio > 0) {
      setCurrentRatio(1 / currentRatio);
    }
  }, [p, currentRatio]);

  const handleSetAspectRatio = useCallback((ratio: number) => {
    setCurrentRatio(ratio);
    if (!isNaN(ratio) && ratio > 0) {
      // Adjust current crop rect to match aspect ratio centered
      setCropRect((prev) => {
        let newW = prev.width;
        let newH = newW / ratio;
        if (newH > 1) {
          newH = 1;
          newW = newH * ratio;
        }
        const newX = Math.max(0, (1 - newW) / 2);
        const newY = Math.max(0, (1 - newH) / 2);
        return { x: newX, y: newY, width: newW, height: newH };
      });
      setHasCropSelection(true);
    }
  }, []);

  const handleReady = useCallback(() => {
    // Transform system ready
  }, []);

  const handleFlipH = useCallback(() => {
    p.setFlipH(!p.flipH);
  }, [p.flipH, p.setFlipH]);

  const handleFlipV = useCallback(() => {
    p.setFlipV(!p.flipV);
  }, [p.flipV, p.setFlipV]);

  const handleStraighten = useCallback((angle: number) => {
    p.setStraightenAngle(angle);
  }, [p.setStraightenAngle]);

  const setActiveTool = useCallback((tool: string | null) => {
    activeToolRef.current = tool;
  }, []);

  return {
    currentRatio,
    hasCropSelection,
    cropRect,
    onCropChange: handleCropChange,
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
