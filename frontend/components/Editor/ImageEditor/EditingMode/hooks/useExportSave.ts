/**
 * useExportSave.ts
 * Save (overwrite/save-as) and Clipboard-copy pipelines plus auto-enhance API call.
 * Features native canvas extraction without Cropper.js and photographic EXIF metadata preservation.
 */
import { MutableRefObject, useCallback, useState } from 'react';
import { Adjustments } from '../../filterEngine';
import { API_BASE } from '@/constants';
import { useToast } from './useToast';
import { preserveExifMetadata } from '../../utils/exifPreserver';
import type { CropNormalizedRect } from '../../CanvasArea/overlays/CropOverlay';

export interface UseExportSaveParams {
  photoId?: number | string;
  src?: string;
  currentImageSrc?: string;
  cropRect?: CropNormalizedRect;
  cropperRef?: MutableRefObject<any>; // Retained for backward compatibility
  adjustments: Adjustments;
  annotations: unknown[];
  healingCanvasRef: MutableRefObject<{ getWorkCanvas(): HTMLCanvasElement | null } | null>;
  liquifyCanvasRef: MutableRefObject<{ getWorkCanvas(): HTMLCanvasElement | null } | null>;
  onSave: (file: Blob, isSaveAs: boolean) => void;
  showToast: ReturnType<typeof useToast>['showToast'];
}

export function useExportSave(p: UseExportSaveParams) {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAutoEnhancing, setIsAutoEnhancing] = useState<boolean>(false);
  const [exportProgress, setExportProgress] =
    useState<{ step: string; current: number; total: number } | null>(null);

  const getSourceCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (p.cropperRef?.current?.getCroppedCanvas) {
      try {
        return p.cropperRef.current.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });
      } catch {
        // Fallback to native
      }
    }

    const baseSrc = p.currentImageSrc || p.src;
    if (!baseSrc) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        if (natW <= 0 || natH <= 0) {
          resolve(null);
          return;
        }

        const crop = p.cropRect && (p.cropRect.width < 0.985 || p.cropRect.height < 0.985 || p.cropRect.x > 0.015 || p.cropRect.y > 0.015)
          ? p.cropRect
          : { x: 0, y: 0, width: 1, height: 1 };

        const sx = Math.max(0, Math.round(crop.x * natW));
        const sy = Math.max(0, Math.round(crop.y * natH));
        const sw = Math.min(natW - sx, Math.max(1, Math.round(crop.width * natW)));
        const sh = Math.min(natH - sy, Math.max(1, Math.round(crop.height * natH)));

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        }
        resolve(canvas);
      };
      img.onerror = () => resolve(null);
      img.src = baseSrc;
    });
  }, [p.cropperRef, p.currentImageSrc, p.src, p.cropRect]);

  const handleSave = useCallback((isSaveAs: boolean, format?: string, quality?: number) => {
    if (isSaving) return;
    setIsSaving(true);

    setTimeout(async () => {
      try {
        const sourceCanvas = await getSourceCanvas();
        if (!sourceCanvas) {
          throw new Error('Could not prepare source canvas for export');
        }

        const { exportEditedCanvas } = await import('../../exportPipeline');
        const exportedBlob = await exportEditedCanvas({
          sourceCanvas,
          adjustments: p.adjustments,
          mimeType: format || 'image/jpeg',
          quality: quality ?? 0.95,
          annotations: p.annotations as any,
          healingCanvas: p.healingCanvasRef.current?.getWorkCanvas() || null,
          liquifyCanvas: p.liquifyCanvasRef.current?.getWorkCanvas() || null,
          onProgress: (step: string, current: number, total: number) => setExportProgress({ step, current, total }),
        });

        // Preserve photographic EXIF camera metadata from original image
        const originalSrc = p.src || p.currentImageSrc || '';
        const finalBlob = await preserveExifMetadata(
          originalSrc,
          exportedBlob,
          sourceCanvas.width,
          sourceCanvas.height
        );

        if (p.photoId) {
          try {
            await fetch(`${API_BASE}/api/v1/photos/${p.photoId}/adjustments`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adjustments: p.adjustments }),
            });
          } catch (e) {
            console.error('Failed to save non-destructive adjustments:', e);
          }
        }

        setExportProgress(null);
        p.onSave(finalBlob, isSaveAs);
        setIsSaving(false);
      } catch (err) {
        setExportProgress(null);
        console.error('Save failed:', err);
        p.showToast('Save failed', true);
        setIsSaving(false);
      }
    }, 50);
  }, [p, isSaving, getSourceCanvas]);

  const handleCopy = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);

    setTimeout(async () => {
      try {
        const sourceCanvas = await getSourceCanvas();
        if (!sourceCanvas) {
          p.showToast('Image not ready to copy', true);
          setIsSaving(false);
          return;
        }

        const { exportEditedCanvas } = await import('../../exportPipeline');
        const blob = await exportEditedCanvas({
          sourceCanvas,
          adjustments: p.adjustments,
          mimeType: 'image/png', // Must be PNG for Clipboard API
          quality: 1.0,
          annotations: p.annotations as any,
          healingCanvas: p.healingCanvasRef.current?.getWorkCanvas() || null,
          liquifyCanvas: p.liquifyCanvasRef.current?.getWorkCanvas() || null,
        });

        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            p.showToast('Image copied to clipboard!');
          } else {
            throw new Error('Async Clipboard API not supported');
          }
        } catch (err) {
          console.warn('Clipboard write failed, using fallback download:', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'edited-image.png';
          a.click();
          URL.revokeObjectURL(url);
          p.showToast('Downloaded as PNG (clipboard unavailable)');
        }
        setIsSaving(false);
      } catch (error) {
        console.error('Copy failed:', error);
        p.showToast('Failed to copy image', true);
        setIsSaving(false);
      }
    }, 50);
  }, [p, isSaving, getSourceCanvas]);

  const handleAutoEnhance = useCallback(async (): Promise<Partial<Adjustments> | null> => {
    if (!p.photoId || isAutoEnhancing) return null;
    setIsAutoEnhancing(true);
    try {
      const { apiClient } = await import('@/services/apiClient');
      const params = await apiClient.post<Partial<Adjustments>>(
        `/api/v1/photos/auto-enhance/${p.photoId}`,
        {},
      );
      return params;
    } catch (e) {
      console.error('Auto enhance failed', e);
      return null;
    } finally {
      setIsAutoEnhancing(false);
    }
  }, [p.photoId, isAutoEnhancing]);

  return {
    isSaving,
    isAutoEnhancing,
    exportProgress,
    handleSave,
    handleCopy,
    handleAutoEnhance,
  };
}
