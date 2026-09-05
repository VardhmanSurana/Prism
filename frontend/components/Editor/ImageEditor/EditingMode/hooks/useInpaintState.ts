/**
 * useInpaintState.ts
 * Magic-Eraser / Inpaint state: brush mode, operation, settings, mask,
 * local mask undo/redo, process pipeline, and SAM-aware info messages.
 */
import { MutableRefObject, useCallback, useRef, useState } from 'react';
import {
  type InpaintMode,
  type InpaintOperation,
  type InpaintSettings,
  type InpaintCanvasHandle,
  eraseImageLocally,
} from '@plugins/ai-vision-studio';
import { API_BASE, resolveUrl } from '@/constants';
import { createInpaintPayload } from '../../utils/inpaintPayload';
import { HistoryActionType } from '../../history';
import { useEditingHistory } from '../useEditingHistory';
import { useToast } from './useToast';

export interface UseInpaintStateParams {
  photoId?: number | string;
  currentImageSrc: string;
  inpaintCanvasRef: MutableRefObject<InpaintCanvasHandle | null>;
  setCurrentImageSrc: (s: string) => void;
  history: ReturnType<typeof useEditingHistory>;
  showToast: ReturnType<typeof useToast>['showToast'];
}

export function useInpaintState(p: UseInpaintStateParams) {
  const [inpaintMode, setInpaintMode] = useState<InpaintMode>('brush');
  const [inpaintOperation, setInpaintOperation] = useState<InpaintOperation>('remove');
  const [inpaintSettings, setInpaintSettings] = useState<InpaintSettings>({
    brushSize: 50,
    brushHardness: 80,
    model: 'lama',
    guidance: 7.5,
    steps: 50,
    maskOpacity: 60,
    showMask: true,
  });
  const [inpaintMask, setInpaintMask] = useState<string | null>(null);
  const [isInpainting, setIsInpainting] = useState<boolean>(false);
  const inpaintHistoryRef = useRef<string[]>([]);
  const inpaintHistoryIndexRef = useRef<number>(-1);
  const [inpaintCanUndo, setInpaintCanUndo] = useState(false);
  const [inpaintCanRedo, setInpaintCanRedo] = useState(false);
  const [inpaintInfoMessage, setInpaintInfoMessage] = useState<string | null>(null);

  const handleInpaintProcess = useCallback(async () => {
    if (!inpaintMask || isInpainting) return;

    setIsInpainting(true);

    try {
      let resultBlobUrl: string | null = null;
      let usedLocalFallback = false;

      // 1. If user explicitly chose the Instant Local engine, bypass backend
      if (inpaintSettings.model === 'client_telea') {
        const localDataUrl = await eraseImageLocally(p.currentImageSrc, inpaintMask);
        const res = await fetch(localDataUrl);
        const blob = await res.blob();
        resultBlobUrl = URL.createObjectURL(blob);
      } else {
        // 2. Attempt neural model on backend with auto-fallback to client engine
        try {
          const imageData = await createInpaintPayload(resolveUrl(p.currentImageSrc));

          const response = await fetch(`${API_BASE}/api/v1/photos/inpaint/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_data: imageData,
              mask_data: inpaintMask,
              operation: inpaintOperation,
              model: inpaintSettings.model,
              prompt: inpaintSettings.prompt,
              guidance_scale: inpaintSettings.guidance,
              num_inference_steps: inpaintSettings.steps,
            }),
          });
          const result = await response.json();
          if (!response.ok || result.success === false || !result.result) {
            throw new Error(result.error || `HTTP ${response.status}`);
          }
          const resultUrl: string = result.result;

          const res = await fetch(resultUrl);
          const blob = await res.blob();
          resultBlobUrl = URL.createObjectURL(blob);
        } catch (backendErr) {
          console.warn('Backend neural inpainting unavailable, executing client-side Telea inpainter fallback:', backendErr);
          usedLocalFallback = true;
          const localDataUrl = await eraseImageLocally(p.currentImageSrc, inpaintMask);
          const res = await fetch(localDataUrl);
          const blob = await res.blob();
          resultBlobUrl = URL.createObjectURL(blob);
        }
      }

      if (resultBlobUrl) {
        p.history.createdUrlRef.current = resultBlobUrl;
        p.setCurrentImageSrc(resultBlobUrl);
        setInpaintMask(null);

        p.history.addHistoryEntry(
          'inpaint' as HistoryActionType,
          `Applied ${inpaintOperation === 'remove' ? 'Object Removal' : 'Inpaint'}${usedLocalFallback ? ' (Local Engine)' : ''}`,
          undefined,
          resultBlobUrl,
        );

        p.inpaintCanvasRef.current?.clearMask();

        p.showToast(
          usedLocalFallback
            ? 'Neural model unavailable — erased using Local Engine'
            : (inpaintOperation === 'remove' ? 'Object removed successfully' : 'Inpainting applied')
        );
      }
    } catch (error) {
      console.error('Inpainting error:', error);
      p.showToast('Failed to apply inpainting');
    } finally {
      setIsInpainting(false);
    }
  }, [p, inpaintMask, isInpainting, inpaintOperation, inpaintSettings]);

  const handleInpaintStrokeComplete = useCallback((maskDataUrl: string) => {
    const idx = inpaintHistoryIndexRef.current;
    inpaintHistoryRef.current = inpaintHistoryRef.current.slice(0, idx + 1);
    inpaintHistoryRef.current.push(maskDataUrl);
    inpaintHistoryIndexRef.current = inpaintHistoryRef.current.length - 1;
    setInpaintCanUndo(inpaintHistoryIndexRef.current > 0);
    setInpaintCanRedo(false);
  }, []);

  const handleInpaintUndo = useCallback(() => {
    const idx = inpaintHistoryIndexRef.current;
    if (idx <= 0) {
      inpaintHistoryIndexRef.current = -1;
      setInpaintMask(null);
      p.inpaintCanvasRef.current?.clearMask();
    } else {
      const newIdx = idx - 1;
      inpaintHistoryIndexRef.current = newIdx;
      const dataUrl = inpaintHistoryRef.current[newIdx];
      setInpaintMask(dataUrl);
      p.inpaintCanvasRef.current?.restoreMask(dataUrl);
    }
    setInpaintCanUndo(inpaintHistoryIndexRef.current > 0);
    setInpaintCanRedo(inpaintHistoryIndexRef.current < inpaintHistoryRef.current.length - 1);
  }, [p.inpaintCanvasRef]);

  const handleInpaintRedo = useCallback(() => {
    const idx = inpaintHistoryIndexRef.current;
    if (idx < inpaintHistoryRef.current.length - 1) {
      const newIdx = idx + 1;
      inpaintHistoryIndexRef.current = newIdx;
      const dataUrl = inpaintHistoryRef.current[newIdx];
      setInpaintMask(dataUrl);
      p.inpaintCanvasRef.current?.restoreMask(dataUrl);
    }
    setInpaintCanUndo(inpaintHistoryIndexRef.current > 0);
    setInpaintCanRedo(inpaintHistoryIndexRef.current < inpaintHistoryRef.current.length - 1);
  }, [p.inpaintCanvasRef]);

  const handleInpaintModeChange = useCallback((mode: InpaintMode) => {
    setInpaintMode(mode);
    if (mode === 'interactive') {
      setInpaintInfoMessage('Interactive segmentation requires AI features to be enabled. Points placed will not be processed without a backend SAM model.');
    } else if (mode === 'auto') {
      setInpaintInfoMessage('Auto-detect requires AI features to be enabled. Enable ENABLE_AI_FACE or similar flag in backend config.');
    } else {
      setInpaintInfoMessage(null);
    }
  }, []);

  const handleInpaintClear = useCallback(() => {
    setInpaintMask(null);
    inpaintHistoryRef.current = [];
    inpaintHistoryIndexRef.current = -1;
    setInpaintCanUndo(false);
    setInpaintCanRedo(false);
    p.inpaintCanvasRef.current?.clearMask();
  }, [p.inpaintCanvasRef]);

  return {
    inpaintMode,
    inpaintOperation,
    inpaintSettings,
    inpaintMask,
    isInpainting,
    inpaintCanUndo,
    inpaintCanRedo,
    inpaintInfoMessage,
    setInpaintMode,
    setInpaintOperation,
    setInpaintSettings,
    setInpaintMask,
    setInpaintInfoMessage,
    handleInpaintProcess,
    handleInpaintStrokeComplete,
    handleInpaintUndo,
    handleInpaintRedo,
    handleInpaintModeChange,
    handleInpaintClear,
  };
}
