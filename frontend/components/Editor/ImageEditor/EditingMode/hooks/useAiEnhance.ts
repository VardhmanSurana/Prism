/**
 * useAiEnhance.ts
 * AI vision-studio features: depth (bokeh/map), enhance (upscale/face-restore/denoise),
 * captioning, and SAM interactive segmentation.
 */
import { MutableRefObject, useCallback, useRef, useState } from 'react';
import type {
  DepthMode,
  DepthSettings,
  EnhanceSettings,
  EnhanceAction,
  CaptionTask,
  InpaintCanvasHandle,
} from '@plugins/ai-vision-studio';
import { API_BASE } from '@/constants';
import { HistoryActionType } from '../../history';
import { useEditingHistory } from '../useEditingHistory';
import { useToast } from './useToast';

export interface UseAiEnhanceParams {
  photoId?: number | string;
  setCurrentImageSrc: (s: string) => void;
  inpaintCanvasRef: MutableRefObject<InpaintCanvasHandle | null>;
  setInpaintMask: (m: string | null) => void;
  handleInpaintStrokeComplete: (maskDataUrl: string) => void;
  history: ReturnType<typeof useEditingHistory>;
  showToast: ReturnType<typeof useToast>['showToast'];
}

export function useAiEnhance(p: UseAiEnhanceParams) {
  const [depthMode, setDepthMode] = useState<DepthMode>('bokeh');
  const [depthSettings, setDepthSettings] = useState<DepthSettings>({ strengthPx: 6, focus: 0.5 });
  const [depthMapData, setDepthMapData] = useState<string | null>(null);
  const [isDepthProcessing, setIsDepthProcessing] = useState(false);

  const [enhanceSettings, setEnhanceSettings] = useState<EnhanceSettings>({ scale: 2, restoreStrength: 1 });
  const [isEnhanceProcessing, setIsEnhanceProcessing] = useState(false);
  const [activeEnhanceAction, setActiveEnhanceAction] = useState<EnhanceAction | null>(null);

  const [captionText, setCaptionText] = useState<string | null>(null);
  const [isCaptionLoading, setIsCaptionLoading] = useState(false);

  const [samCanSegment, setSamCanSegment] = useState(false);
  const [samPointsCount, setSamPointsCount] = useState(0);
  const [isSamSegmenting, setIsSamSegmenting] = useState(false);
  const samPointsRef = useRef<Array<{ x: number; y: number; positive: boolean }>>([]);

  const reloadPhotoAfterServerWrite = useCallback(async (label: string): Promise<boolean> => {
    try {
      if (!p.photoId) return false;
      const res = await fetch(`${API_BASE}/api/v1/photos/${p.photoId}/file?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      p.history.createdUrlRef.current = blobUrl;
      p.setCurrentImageSrc(blobUrl);
      p.history.addHistoryEntry('inpaint' as HistoryActionType, label, undefined, blobUrl);
      return true;
    } catch (e) {
      console.error('Failed to reload photo after server write:', e);
      p.showToast('Applied, but could not refresh preview');
      return false;
    }
  }, [p]);

  const handleDepthProcess = useCallback(async () => {
    if (isDepthProcessing || !p.photoId) return;
    setIsDepthProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/depth/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: p.photoId,
          mode: depthMode,
          strength_px: depthSettings.strengthPx,
          focus: depthSettings.focus,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      if (depthMode === 'map') {
        setDepthMapData(result.depth_map_data ?? null);
        p.showToast('Depth map computed');
      } else {
        await reloadPhotoAfterServerWrite('Applied bokeh blur');
        p.showToast('Bokeh applied');
      }
    } catch (e) {
      console.error('Depth processing failed:', e);
      p.showToast(e instanceof Error ? e.message : 'Depth processing failed');
    } finally {
      setIsDepthProcessing(false);
    }
  }, [isDepthProcessing, p, depthMode, depthSettings, reloadPhotoAfterServerWrite]);

  const runEnhanceAction = useCallback(async (action: EnhanceAction) => {
    if (isEnhanceProcessing || !p.photoId) return;
    setIsEnhanceProcessing(true);
    setActiveEnhanceAction(action);
    try {
      const endpoint = action === 'upscale'
        ? '/api/v1/photos/enhance/upscale'
        : action === 'face-restore'
          ? '/api/v1/photos/enhance/face-restore'
          : '/api/v1/photos/denoise';
      const body = action === 'upscale'
        ? { photo_id: p.photoId, scale: enhanceSettings.scale }
        : action === 'face-restore'
          ? { photo_id: p.photoId, strength: enhanceSettings.restoreStrength }
          : { photo_id: p.photoId };
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      await reloadPhotoAfterServerWrite(
        action === 'upscale'
          ? `Upscaled ${result.width}×${result.height}`
          : action === 'face-restore'
            ? `Restored ${result.faces_restored} face(s)`
            : `Denoised ${result.width}×${result.height}`,
      );
      p.showToast(action === 'upscale' ? 'Upscale complete' : action === 'face-restore' ? 'Faces restored' : 'Denoise complete');
    } catch (e) {
      console.error(`${action} failed:`, e);
      p.showToast(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setIsEnhanceProcessing(false);
      setActiveEnhanceAction(null);
    }
  }, [isEnhanceProcessing, p, enhanceSettings, reloadPhotoAfterServerWrite]);

  const handleUpscale = useCallback(() => runEnhanceAction('upscale'), [runEnhanceAction]);
  const handleFaceRestore = useCallback(() => runEnhanceAction('face-restore'), [runEnhanceAction]);
  const handleDenoise = useCallback(() => runEnhanceAction('denoise'), [runEnhanceAction]);

  const handleCaption = useCallback(async (task: CaptionTask) => {
    if (isCaptionLoading || !p.photoId) return;
    setIsCaptionLoading(true);
    setCaptionText(null);
    try {
      const taskMap: Record<CaptionTask, string> = {
        caption: 'caption',
        detailed: 'detailed',
        more_detailed: 'more_detailed',
      };
      const response = await fetch(`${API_BASE}/api/v1/photos/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: p.photoId, task: taskMap[task] }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      setCaptionText(result.caption || null);
      p.showToast('Caption generated');
    } catch (e) {
      console.error('Caption generation failed:', e);
      p.showToast(e instanceof Error ? e.message : 'Caption generation failed', true);
    } finally {
      setIsCaptionLoading(false);
    }
  }, [isCaptionLoading, p]);

  const handleInteractivePointsChange = useCallback(
    (pts: Array<{ x: number; y: number; positive: boolean }>) => {
      samPointsRef.current = pts;
      setSamCanSegment(pts.length > 0);
      setSamPointsCount(pts.length);
    },
    [],
  );

  const handleGenerateSegmentMask = useCallback(async () => {
    const points = samPointsRef.current;
    if (points.length === 0 || isSamSegmenting || !p.photoId) return;
    setIsSamSegmenting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/sam/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: p.photoId,
          points: points.map(pt => ({ x: pt.x, y: pt.y, positive: pt.positive })),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      // Feed the mask into the existing brush/erase pipeline — from here the
      // user just hits "Erase Selected Area" (LaMa) or refines with the brush.
      p.setInpaintMask(result.mask_data);
      p.inpaintCanvasRef.current?.clearMask();
      p.inpaintCanvasRef.current?.restoreMask(result.mask_data);
      p.handleInpaintStrokeComplete(result.mask_data);
      p.showToast('Object selected — press Erase to remove it');
    } catch (e) {
      console.error('SAM segmentation failed:', e);
      p.showToast(e instanceof Error ? e.message : 'Segmentation failed');
    } finally {
      setIsSamSegmenting(false);
    }
  }, [isSamSegmenting, p]);

  const handleClearSegmentPoints = useCallback(() => {
    samPointsRef.current = [];
    setSamCanSegment(false);
    setSamPointsCount(0);
    p.inpaintCanvasRef.current?.clearMask();
  }, [p.inpaintCanvasRef]);

  return {
    depthMode,
    setDepthMode: (m: DepthMode) => {
      setDepthMode(m);
      if (m === 'bokeh') setDepthMapData(null);
    },
    depthSettings,
    setDepthSettings,
    depthMapData,
    isDepthProcessing,
    enhanceSettings,
    setEnhanceSettings,
    isEnhanceProcessing,
    activeEnhanceAction,
    captionText,
    isCaptionLoading,
    samCanSegment,
    samPointsCount,
    isSamSegmenting,
    samPointsRef,
    handleDepthProcess,
    handleUpscale,
    handleFaceRestore,
    handleDenoise,
    handleCaption,
    handleInteractivePointsChange,
    handleGenerateSegmentMask,
    handleClearSegmentPoints,
    reloadPhotoAfterServerWrite,
  };
}
