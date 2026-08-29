/**
 * useExportSave.ts
 * Save (overwrite/save-as) and Clipboard-copy pipelines plus auto-enhance API call.
 * The auto-enhance partial is returned so the orchestrator owns the `setAdjustments` merge.
 */
import { MutableRefObject, useCallback, useState } from 'react';
import Cropper from 'cropperjs';
import { Adjustments } from '../../filterEngine';
import { API_BASE } from '@/constants';
import { useToast } from './useToast';

export interface UseExportSaveParams {
  photoId?: number | string;
  cropperRef: MutableRefObject<Cropper | null>;
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

  const handleSave = useCallback((isSaveAs: boolean, format?: string, quality?: number) => {
    if (isSaving) return;
    const cropper = p.cropperRef.current;
    if (!cropper) return;

    setIsSaving(true);

    setTimeout(() => {
      try {
        const cropped = cropper.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });

        void import('../../exportPipeline')
          .then(({ exportEditedCanvas }) => exportEditedCanvas({
            sourceCanvas: cropped,
            adjustments: p.adjustments,
            mimeType: format || 'image/jpeg',
            quality: quality ?? 0.95,
            annotations: p.annotations as any,
            healingCanvas: p.healingCanvasRef.current?.getWorkCanvas() || null,
            liquifyCanvas: p.liquifyCanvasRef.current?.getWorkCanvas() || null,
            onProgress: (step: string, current: number, total: number) => setExportProgress({ step, current, total }),
          }))
          .then(async (blob) => {
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
            p.onSave(blob, isSaveAs);
            setIsSaving(false);
          })
          .catch((error) => {
            setExportProgress(null);
            console.error('Save failed:', error);
            setIsSaving(false);
          });
      } catch (err) {
        setExportProgress(null);
        console.error('Save failed:', err);
        setIsSaving(false);
      }
    }, 50);
  }, [p, isSaving]);

  const handleCopy = useCallback(() => {
    if (isSaving) return;
    const cropper = p.cropperRef.current;

    let sourceCanvas: HTMLCanvasElement | null = null;
    if (cropper) {
      try {
        sourceCanvas = cropper.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });
      } catch (err) {
        console.warn('Failed to get cropped canvas from cropper:', err);
      }
    }

    if (!sourceCanvas) {
      p.showToast('Image not ready to copy', true);
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
        void import('../../exportPipeline')
        .then(({ exportEditedCanvas }) => exportEditedCanvas({
          sourceCanvas,
          adjustments: p.adjustments,
          mimeType: 'image/png', // Must be PNG for Clipboard API
          quality: 1.0,
          annotations: p.annotations as any,
          healingCanvas: p.healingCanvasRef.current?.getWorkCanvas() || null,
          liquifyCanvas: p.liquifyCanvasRef.current?.getWorkCanvas() || null,
        }))
        .then(async (blob) => {
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
        })
        .catch((error) => {
          console.error('Copy failed:', error);
          p.showToast('Failed to copy image', true);
          setIsSaving(false);
        });
    }, 50);
  }, [p, isSaving]);

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
