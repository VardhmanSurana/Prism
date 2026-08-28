/**
 * EditingMode.tsx
 * Logic, state management, and UI layer for the image editor.
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle } from 'lucide-react';
import 'react-color-palette/css';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { AdjustPanel } from '../AdjustPanel';
import { DetailPanel } from '../DetailPanel';
import { TransformPanel } from '../TransformPanel';
import { TopBar } from '../TopBar';
import { Sidebar, ToolId } from '../Sidebar';
import { CanvasArea } from '../CanvasArea';
import { DraftRecoveryBanner } from '../DraftRecoveryBanner';
import { useEditDraftAutoSave } from '@/hooks/useEditDraftAutoSave';
import { Adjustments, DEFAULT_ADJUSTMENTS, DEFAULT_BACKGROUND_ADJUSTMENTS, toFilterString } from '../filterEngine';
import { DEFAULT_CURVE, getCurvesTableValues } from '../curves';
import { HslPanel } from '../HslPanel';
import { PresetsPanel } from '../PresetsPanel';
import { PalettePanel } from '../PalettePanel';
import { HealingPanel } from '../HealingPanel';
import { HealingSettings, DEFAULT_HEALING_SETTINGS } from '../healingEngine';
import { HistoryPanel } from '../HistoryPanel';
import { LayersPanel } from '../LayersPanel';
import { RawEnginePanel } from '../RawEnginePanel';
import { LiquifyPanel } from '../LiquifyPanel';
import { DEFAULT_LIQUIFY_SETTINGS } from '../liquifyEngine';
import { LassoPanel } from '../LassoPanel';
import { DEFAULT_LASSO_STATE, LassoState } from '../lassoEngine';
import { RawSettings, DEFAULT_RAW_SETTINGS } from '../rawEngine';

// ── Types & Utilities from Plugins ──
import type { InpaintMode, InpaintOperation, InpaintSettings, InpaintCanvasHandle } from '@plugins/ai-vision-studio';
import { createInpaintPayload } from '../utils/inpaintPayload';
import type { DepthMode, DepthSettings, EnhanceSettings, EnhanceAction, CaptionTask } from '@plugins/ai-vision-studio';
import { matchColorBetweenImages } from '@plugins/retouch-metadata-studio';
import type { DrawToolId } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { DEFAULT_PEN_SETTINGS, PenSettings } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

// ── Lazy-loaded Plugin Panels (Loaded on-demand directly from plugins/ folder) ──
const BackgroundPanel = React.lazy(() =>
  import('@plugins/ai-vision-studio/BackgroundPanel').then((m) => ({ default: m.BackgroundPanel }))
);
const MagicEraserPanel = React.lazy(() =>
  import('@plugins/ai-vision-studio/MagicEraserPanel').then((m) => ({ default: m.MagicEraserPanel }))
)
const DepthPanel = React.lazy(() =>
  import('@plugins/ai-vision-studio/DepthPanel').then((m) => ({ default: m.DepthPanel }))
)
const EnhancePanel = React.lazy(() =>
  import('@plugins/ai-vision-studio/EnhancePanel').then((m) => ({ default: m.EnhancePanel }))
);
const InpaintPanel = MagicEraserPanel;
const PortraitPanel = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/PortraitPanel').then((m) => ({ default: m.PortraitPanel }))
);
const ColorMatchPanel = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/ColorMatchPanel').then((m) => ({ default: m.ColorMatchPanel }))
);
const AnnotationsPanel = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/AnnotationsPanel').then((m) => ({ default: m.AnnotationsPanel }))
);
const LutPanel = React.lazy(() =>
  import('@plugins/creative-color-studio/LutPanel').then((m) => ({ default: m.LutPanel }))
);
const TexturePanel = React.lazy(() =>
  import('@plugins/creative-color-studio/TexturePanel').then((m) => ({ default: m.TexturePanel }))
);
const FramesPanel = React.lazy(() =>
  import('@plugins/creative-color-studio/FramesPanel').then((m) => ({ default: m.FramesPanel }))
);

import { HistoryActionType } from '../history';
import { API_BASE, resolveUrl } from '@/constants';

import { useAnnotationsState } from './useAnnotationsState';
import { useEditingHistory } from './useEditingHistory';
import { useKeyBindings } from './useKeyBindings';
import { useEditStore } from '@/store/editStore';

interface EditingModeProps {
  src:     string;
  onClose: () => void;
  onSave:  (file: Blob, isSaveAs: boolean) => void;
  photoId?: number | string;
}

export const EditingMode: React.FC<EditingModeProps> = ({
  src,
  onClose,
  onSave,
  photoId,
}) => {
  // Refs / state
  const cropperRef = useRef<Cropper | null>(null);
  const inpaintCanvasRef = useRef<InpaintCanvasHandle | null>(null);
  const [currentRatio, setCurrentRatio] = useState<number>(NaN);
  const [activeTool, setActiveTool] = useState<ToolId | null>('presets');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  
  // Annotations state (via hook)
  const annState = useAnnotationsState();

  // Draw tools and styles local to the drawing mode
  const [activeDrawTool, setActiveDrawTool] = useState<DrawToolId>('freehand');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [activeOpacity, setActiveOpacity] = useState<number>(1);
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [brushSize, setBrushSize] = useState<number>(35);
  const [penSettings, setPenSettings] = useState<PenSettings>(DEFAULT_PEN_SETTINGS);
  const userChangedStyleRef = useRef(false);

  // History and adjustments state (via hook)
  const historyState = useEditingHistory({
    src,
    cropperRef,
    annotations: annState.annotations,
    setAnnotations: annState.setAnnotations,
    setAnnotationsHistoryPast: annState.setAnnotationsHistoryPast,
    setAnnotationsHistoryFuture: annState.setAnnotationsHistoryFuture,
    photoId,
  });

  const {
    currentImageSrc,
    setCurrentImageSrc,
    adjustments,
    setAdjustments,
    flipH,
    setFlipH,
    flipV,
    setFlipV,
    straightenAngle,
    setStraightenAngle,
    totalRotation,
    setTotalRotation,
    history,
    currentHistoryIndex,
    isRestoringHistory,
    revokeLocalUrl,
    addHistoryEntry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = historyState;

  // Inpaint state
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

  // ── Depth effects + AI enhance (ai-vision-studio plugin) ──
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
  const [isSamSegmenting, setIsSamSegmenting] = useState(false);
  const samPointsRef = useRef<Array<{ x: number; y: number; positive: boolean }>>([]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const savedCropBoxRef = useRef<Cropper.CropBoxData | null>(null);

  // Before/After compare state
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Healing brush / clone stamp state
  const [healingSettings, setHealingSettings] = useState<HealingSettings>(DEFAULT_HEALING_SETTINGS);
  const [healingHasStrokes, setHealingHasStrokes] = useState<boolean>(false);
  const healingCanvasRef = useRef<import('../HealingCanvas').HealingCanvasRef | null>(null);
  const liquifyCanvasRef = useRef<import('../LiquifyCanvas').LiquifyCanvasRef | null>(null);

  // New Professional Tools State
  const [activeLayerId, setActiveLayerId] = useState<string | null>('layer-base');
  const [rawSettings, setRawSettings] = useState<RawSettings>(DEFAULT_RAW_SETTINGS);
  const [liquifySettings, setLiquifySettings] = useState(DEFAULT_LIQUIFY_SETTINGS);
  const [lassoState, setLassoState] = useState<LassoState>(DEFAULT_LASSO_STATE);

  // Auto-save and draft recovery hook
  const draftState = useEditDraftAutoSave({
    photoId,
    adjustments,
    setAdjustments,
    totalRotation,
    setTotalRotation,
    straightenAngle,
    setStraightenAngle,
    flipH,
    setFlipH,
    flipV,
    setFlipV,
    annotations: annState.annotations,
    setAnnotations: annState.setAnnotations,
    cropperRef,
    rawSettings,
    liquifySettings,
    isSaving,
  });

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleRequestClose = useCallback(() => {
    if (draftState.isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [draftState.isDirty, onClose]);

  const handleDiscardAndClose = useCallback(() => {
    draftState.discardDraft();
    setShowExitConfirm(false);
    onClose();
  }, [draftState, onClose]);

  const handleKeepDraftAndClose = useCallback(() => {
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  // Face Detection Bounding Boxes State
  const [faces, setFaces] = useState<import('@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay').FaceBBox[]>([]);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${photoId}/faces`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.faces)) {
            setFaces(data.faces);
          }
        }
      } catch (err) {
        console.debug('Failed to fetch photo faces:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [photoId]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, isError });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const [isColorMatching, setIsColorMatching] = useState(false);

  const handleApplyColorMatch = useCallback(async (refSrc: string, strength: number) => {
    if (isColorMatching || !refSrc) return;
    setIsColorMatching(true);

    try {
      const blobUrl = await matchColorBetweenImages(currentImageSrc, refSrc, strength);
      historyState.createdUrlRef.current = blobUrl;

      setCurrentImageSrc(blobUrl);
      addHistoryEntry(
        'filter' as HistoryActionType,
        `Applied Shot Matcher (${strength}%)`,
        undefined,
        blobUrl
      );
      showToast('Color palette matched successfully');
    } catch (e) {
      console.error('Color match failed:', e);
      showToast('Failed to apply color match', true);
    } finally {
      setIsColorMatching(false);
    }
  }, [
    currentImageSrc,
    isColorMatching,
    setCurrentImageSrc,
    addHistoryEntry,
    showToast,
    historyState.createdUrlRef,
  ]);

  const handleRawSettingsChange = useCallback((raw: RawSettings) => {
    setRawSettings(raw);
    setAdjustments({ ...adjustments, raw });
  }, [adjustments, setAdjustments]);

  // Export progress state
  const [exportProgress, setExportProgress] = useState<{ step: string; current: number; total: number } | null>(null);

  // In-place Crop management
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const isImageCropped = currentImageSrc !== src;

  // Sync state if navigation or prop source changes
  useEffect(() => {
    setHasCropSelection(false);
  }, [src]);

  // Track activeTool with ref to keep handleCropEvent stable
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const handleCropEvent = useCallback(() => {
    if (activeToolRef.current !== 'transform') {
      setHasCropSelection(false);
      return;
    }

    const cropper = cropperRef.current;
    if (!cropper) return;

    const cropBoxData = cropper.getCropBoxData();
    const canvasData  = cropper.getCanvasData();

    if (!cropBoxData || !canvasData) return;

    // Detect if selection is smaller than full image
    const isSub =
      cropBoxData.width > 0 && cropBoxData.height > 0 &&
      (
        cropBoxData.width  < canvasData.width  * 0.985 ||
        cropBoxData.height < canvasData.height * 0.985 ||
        cropBoxData.left   > canvasData.left   + 3 ||
        cropBoxData.top    > canvasData.top    + 3
      );

    setHasCropSelection(prev => {
      if (prev !== isSub) return isSub;
      return prev;
    });
  }, []);

  const handleApplyCrop = useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    try {
      const croppedCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      croppedCanvas.toBlob((blob) => {
        if (!blob) return;

        const newUrl = URL.createObjectURL(blob);
        historyState.createdUrlRef.current = newUrl;

        setCurrentImageSrc(newUrl);
        setHasCropSelection(false);

        // Reset transform values (they are baked into the new cropped canvas)
        setTotalRotation(0);
        setStraightenAngle(0);
        setFlipH(false);
        setFlipV(false);

        // Add to history
        addHistoryEntry('crop', 'Applied crop', undefined, newUrl);
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error('Failed to apply crop in-place:', e);
    }
  }, [addHistoryEntry, setCurrentImageSrc, setTotalRotation, setStraightenAngle, setFlipH, setFlipV, historyState.createdUrlRef]);

  const handleResetCrop = useCallback(() => {
    setCurrentImageSrc(src);
    setHasCropSelection(false);

    setTotalRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
  }, [src, setCurrentImageSrc, setTotalRotation, setStraightenAngle, setFlipH, setFlipV]);

  const filterString = useMemo(() => toFilterString(adjustments), [adjustments]);
  // ponytail: deferred values removed — isDraggingSliderRef already handles perf at 450px during drag

  // Palette swatches & in-canvas loupe eyedropper state
  const [paletteSwatches, setPaletteSwatches] = useState<string[]>([
    '#808080', '#808080', '#808080', '#808080', '#808080', '#808080'
  ]);
  const [paletteLocked, setPaletteLocked] = useState<boolean[]>([
    false, false, false, false, false, false
  ]);
  const [palettePickingIndex, setPalettePickingIndex] = useState<number | null>(null);

  const handlePaletteColorPicked = useCallback((hex: string, targetIdx: number) => {
    setPaletteSwatches(prev => {
      const next = [...prev];
      next[targetIdx] = hex;
      return next;
    });
    setPaletteLocked(prev => {
      const next = [...prev];
      next[targetIdx] = true;
      return next;
    });
    setPalettePickingIndex(null);
  }, []);

  useEffect(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    if (activeTool !== 'transform') {
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
  }, [activeTool]);

  const handleRotate = useCallback((degree: number) => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    const newTotal = ((totalRotation + degree) % 360 + 360) % 360;
    setTotalRotation(newTotal);

    cropper.clear();
    cropper.rotate(degree);

    const containerData = cropper.getContainerData();
    const imageData     = cropper.getImageData();
    const isSideways    = newTotal === 90 || newTotal === 270;
    const displayW      = isSideways ? imageData.naturalHeight : imageData.naturalWidth;
    const displayH      = isSideways ? imageData.naturalWidth  : imageData.naturalHeight;

    const scale    = Math.min(
      (containerData.width  * 0.95) / displayW,
      (containerData.height * 0.95) / displayH,
    );
    const newWidth  = displayW * scale;
    const newHeight = displayH * scale;

    cropper.setCanvasData({
      width:  newWidth,
      height: newHeight,
      left:   (containerData.width  - newWidth)  / 2,
      top:    (containerData.height - newHeight) / 2,
    });

    if (!isNaN(currentRatio)) {
      const newRatio = 1 / currentRatio;
      setCurrentRatio(newRatio);
      cropper.setAspectRatio(newRatio);
    } else {
      cropper.crop();
    }
  }, [totalRotation, currentRatio, setTotalRotation]);

  const handleSetAspectRatio = useCallback((ratio: number) => {
    setCurrentRatio(ratio);
    cropperRef.current?.setAspectRatio(ratio);
  }, []);

  const handleReady = useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    const containerData = cropper.getContainerData();
    const canvasData    = cropper.getCanvasData();

    const scale = Math.min(
      (containerData.width  * 0.95) / canvasData.width,
      (containerData.height * 0.95) / canvasData.height,
    );

    const newWidth  = canvasData.width  * scale;
    const newHeight = canvasData.height * scale;
    const newLeft   = (containerData.width  - newWidth)  / 2;
    const newTop    = (containerData.height - newHeight) / 2;
    cropper.setCropBoxData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    cropper.setCanvasData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });

    cropper.scaleX(flipH ? -1 : 1);
    cropper.scaleY(flipV ? -1 : 1);
    if (typeof (cropper as any).rotateTo === 'function') {
      (cropper as any).rotateTo(totalRotation);
    } else {
      cropper.rotate(totalRotation);
    }
    isRestoringHistory.current = false;
  }, [flipH, flipV, totalRotation, isRestoringHistory]);

  const handleFlipH = useCallback(() => {
    const next = !flipH;
    setFlipH(next);
    cropperRef.current?.scaleX(next ? -1 : 1);
  }, [flipH, setFlipH]);

  const handleFlipV = useCallback(() => {
    const next = !flipV;
    setFlipV(next);
    cropperRef.current?.scaleY(next ? -1 : 1);
  }, [flipV, setFlipV]);

  const handleStraighten = useCallback((angle: number) => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const delta = angle - straightenAngle;
    setStraightenAngle(angle);
    cropper.rotate(delta);
  }, [straightenAngle, setStraightenAngle]);

  const handleAdjChange = useCallback((adj: Adjustments) => {
    setAdjustments(adj);
  }, [setAdjustments]);

  const handleCopyEdits = useCallback(() => {
    const { copyAdjustments } = useEditStore.getState();
    copyAdjustments(adjustments);
    showToast('Edits copied to clipboard');
  }, [adjustments, showToast]);

  const handlePasteEdits = useCallback(() => {
    const { copiedAdjustments } = useEditStore.getState();
    if (!copiedAdjustments) return;
    setAdjustments(prev => ({ ...prev, ...copiedAdjustments }));
    showToast('Edits applied to photo');
  }, [setAdjustments, showToast]);

  const [isAutoEnhancing, setIsAutoEnhancing] = useState<boolean>(false);
  const handleAutoEnhance = useCallback(async () => {
    if (!photoId || isAutoEnhancing) return;
    setIsAutoEnhancing(true);
    try {
      const { apiClient } = await import('@/services/apiClient');
      const params = await apiClient.post<Partial<Adjustments>>(`/api/v1/photos/auto-enhance/${photoId}`, {});
      setAdjustments(prev => ({ ...prev, ...params }));
    } catch (e) {
      console.error('Auto enhance failed', e);
    } finally {
      setIsAutoEnhancing(false);
    }
  }, [photoId, isAutoEnhancing, setAdjustments]);

  const handleInpaintProcess = useCallback(async () => {
    if (!inpaintMask || isInpainting) return;
    
    setIsInpainting(true);
    
    try {
      const imageData = await createInpaintPayload(resolveUrl(currentImageSrc));

      let resultUrl: string | null = null;

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
      resultUrl = result.result;

      if (resultUrl) {
        // Create blob URL for consistency
        const res = await fetch(resultUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        historyState.createdUrlRef.current = blobUrl;

        setCurrentImageSrc(blobUrl);
        setInpaintMask(null);

        // Add to history
        addHistoryEntry(
          'inpaint' as HistoryActionType,
          `Applied ${inpaintOperation === 'remove' ? 'Object Removal' : 'Inpaint'}`,
          undefined,
          blobUrl
        );

        // Clear the canvas mask
        inpaintCanvasRef.current?.clearMask();

        showToast(inpaintOperation === 'remove' ? 'Object removed successfully' : 'Inpainting applied');
      }
    } catch (error) {
      console.error('Inpainting error:', error);
      showToast('Failed to apply inpainting');
    } finally {
      setIsInpainting(false);
    }
  }, [
    inpaintMask,
    isInpainting,
    currentImageSrc,
    inpaintOperation,
    inpaintSettings,
    addHistoryEntry,
    setCurrentImageSrc,
    historyState.createdUrlRef,
    showToast,
  ]);

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
      inpaintCanvasRef.current?.clearMask();
    } else {
      const newIdx = idx - 1;
      inpaintHistoryIndexRef.current = newIdx;
      const dataUrl = inpaintHistoryRef.current[newIdx];
      setInpaintMask(dataUrl);
      inpaintCanvasRef.current?.restoreMask(dataUrl);
    }
    setInpaintCanUndo(inpaintHistoryIndexRef.current > 0);
    setInpaintCanRedo(inpaintHistoryIndexRef.current < inpaintHistoryRef.current.length - 1);
  }, []);

  const handleInpaintRedo = useCallback(() => {
    const idx = inpaintHistoryIndexRef.current;
    if (idx < inpaintHistoryRef.current.length - 1) {
      const newIdx = idx + 1;
      inpaintHistoryIndexRef.current = newIdx;
      const dataUrl = inpaintHistoryRef.current[newIdx];
      setInpaintMask(dataUrl);
      inpaintCanvasRef.current?.restoreMask(dataUrl);
    }
    setInpaintCanUndo(inpaintHistoryIndexRef.current > 0);
    setInpaintCanRedo(inpaintHistoryIndexRef.current < inpaintHistoryRef.current.length - 1);
  }, []);

  // ── Depth effects + AI enhance (backend writes the photo file back) ──

  const reloadPhotoAfterServerWrite = useCallback(async (label: string): Promise<boolean> => {
    try {
      if (!photoId) return false;
      const res = await fetch(`${API_BASE}/api/v1/photos/${photoId}/file?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      historyState.createdUrlRef.current = blobUrl;
      setCurrentImageSrc(blobUrl);
      addHistoryEntry('inpaint' as HistoryActionType, label, undefined, blobUrl);
      return true;
    } catch (e) {
      console.error('Failed to reload photo after server write:', e);
      showToast('Applied, but could not refresh preview');
      return false;
    }
  }, [photoId, setCurrentImageSrc, historyState.createdUrlRef, addHistoryEntry, showToast]);

  const handleDepthProcess = useCallback(async () => {
    if (isDepthProcessing || !photoId) return;
    setIsDepthProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/depth/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: photoId,
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
        showToast('Depth map computed');
      } else {
        await reloadPhotoAfterServerWrite('Applied bokeh blur');
        showToast('Bokeh applied');
      }
    } catch (e) {
      console.error('Depth processing failed:', e);
      showToast(e instanceof Error ? e.message : 'Depth processing failed');
    } finally {
      setIsDepthProcessing(false);
    }
  }, [isDepthProcessing, photoId, depthMode, depthSettings, reloadPhotoAfterServerWrite, showToast]);

  const runEnhanceAction = useCallback(async (action: EnhanceAction) => {
    if (isEnhanceProcessing || !photoId) return;
    setIsEnhanceProcessing(true);
    setActiveEnhanceAction(action);
    try {
      const endpoint = action === 'upscale'
        ? '/api/v1/photos/enhance/upscale'
        : action === 'face-restore'
          ? '/api/v1/photos/enhance/face-restore'
          : '/api/v1/photos/denoise';
      const body = action === 'upscale'
        ? { photo_id: photoId, scale: enhanceSettings.scale }
        : action === 'face-restore'
          ? { photo_id: photoId, strength: enhanceSettings.restoreStrength }
          : { photo_id: photoId };
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
            : `Denoised ${result.width}×${result.height}`
      );
      showToast(action === 'upscale' ? 'Upscale complete' : action === 'face-restore' ? 'Faces restored' : 'Denoise complete');
    } catch (e) {
      console.error(`${action} failed:`, e);
      showToast(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setIsEnhanceProcessing(false);
      setActiveEnhanceAction(null);
    }
  }, [isEnhanceProcessing, photoId, enhanceSettings, reloadPhotoAfterServerWrite, showToast]);

  const handleUpscale = useCallback(() => runEnhanceAction('upscale'), [runEnhanceAction]);
  const handleFaceRestore = useCallback(() => runEnhanceAction('face-restore'), [runEnhanceAction]);
  const handleDenoise = useCallback(() => runEnhanceAction('denoise'), [runEnhanceAction]);

  const handleCaption = useCallback(async (task: CaptionTask) => {
    if (isCaptionLoading || !photoId) return;
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
        body: JSON.stringify({ photo_id: photoId, task: taskMap[task] }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      setCaptionText(result.caption || null);
      showToast('Caption generated');
    } catch (e) {
      console.error('Caption generation failed:', e);
      showToast(e instanceof Error ? e.message : 'Caption generation failed', true);
    } finally {
      setIsCaptionLoading(false);
    }
  }, [isCaptionLoading, photoId, showToast]);

  // ── SAM click-to-select → feeds the Magic Eraser mask pipeline ──
  const handleInteractivePointsChange = useCallback(
    (pts: Array<{ x: number; y: number; positive: boolean }>) => {
      samPointsRef.current = pts;
      setSamCanSegment(pts.length > 0);
    },
    []
  );

  const handleGenerateSegmentMask = useCallback(async () => {
    const points = samPointsRef.current;
    if (points.length === 0 || isSamSegmenting || !photoId) return;
    setIsSamSegmenting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/sam/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: photoId,
          points: points.map(p => ({ x: p.x, y: p.y, positive: p.positive })),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      // Feed the mask into the existing brush/erase pipeline — from here the
      // user just hits "Erase Selected Area" (LaMa) or refines with the brush.
      setInpaintMask(result.mask_data);
      inpaintCanvasRef.current?.clearMask();
      inpaintCanvasRef.current?.restoreMask(result.mask_data);
      inpaintHistoryRef.current = [];
      inpaintHistoryIndexRef.current = -1;
      handleInpaintStrokeComplete(result.mask_data);
      showToast('Object selected — press Erase to remove it');
    } catch (e) {
      console.error('SAM segmentation failed:', e);
      showToast(e instanceof Error ? e.message : 'Segmentation failed');
    } finally {
      setIsSamSegmenting(false);
    }
  }, [isSamSegmenting, photoId, showToast]);

  const handleClearSegmentPoints = useCallback(() => {
    // Canvas clears its own points via clearMask; mirror the flag locally.
    samPointsRef.current = [];
    setSamCanSegment(false);
    inpaintCanvasRef.current?.clearMask();
  }, []);

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

  const handleSave = useCallback((isSaveAs: boolean, format?: string, quality?: number) => {
    if (isSaving) return;
    const cropper = cropperRef.current;
    if (!cropper) return;

    setIsSaving(true);

    setTimeout(() => {
      try {
        const cropped = cropper.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });

        void import('../exportPipeline')
          .then(({ exportEditedCanvas }) => exportEditedCanvas({
            sourceCanvas: cropped,
            adjustments,
            mimeType: format || 'image/jpeg',
            quality: quality ?? 0.95,
            annotations: annState.annotations,
            healingCanvas: healingCanvasRef.current?.getWorkCanvas() || null,
            liquifyCanvas: liquifyCanvasRef.current?.getWorkCanvas() || null,
            onProgress: (step, current, total) => setExportProgress({ step, current, total }),
          }))
          .then(async (blob) => {
            if (photoId) {
              try {
                await fetch(`${API_BASE}/api/v1/photos/${photoId}/adjustments`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ adjustments }),
                });
              } catch (e) {
                console.error('Failed to save non-destructive adjustments:', e);
              }
            }
            draftState.clearDraft();
            setExportProgress(null);
            onSave(blob, isSaveAs);
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
  }, [adjustments, isSaving, onSave, annState.annotations]);

  const handleCopy = useCallback(() => {
    if (isSaving) return;
    const cropper = cropperRef.current;

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
      showToast('Image not ready to copy', true);
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      void import('../exportPipeline')
        .then(({ exportEditedCanvas }) => exportEditedCanvas({
          sourceCanvas,
          adjustments,
          mimeType: 'image/png', // Must be PNG for Clipboard API
          quality: 1.0,
          annotations: annState.annotations,
          healingCanvas: healingCanvasRef.current?.getWorkCanvas() || null,
          liquifyCanvas: liquifyCanvasRef.current?.getWorkCanvas() || null,
        }))
        .then(async (blob) => {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              showToast('Image copied to clipboard!');
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
            showToast('Downloaded as PNG (clipboard unavailable)');
          }
          setIsSaving(false);
        })
        .catch((error) => {
          console.error('Copy failed:', error);
          showToast('Failed to copy image', true);
          setIsSaving(false);
        });
    }, 50);
  }, [adjustments, isSaving, annState.annotations, showToast]);

  // Keyboard bindings hook integration
  useKeyBindings({
    activeTool,
    undoAnnotations: annState.undoAnnotations,
    redoAnnotations: annState.redoAnnotations,
    handleUndo,
    handleRedo,
    setIsComparing,
    cropperRef,
    inpaintMode,
    setInpaintSettings,
    onAutoEnhance: handleAutoEnhance,
    onToggleHistory: () => setIsHistoryOpen(prev => !prev),
  });

  const curvesTable = useMemo(
    () => getCurvesTableValues(adjustments.curves || DEFAULT_CURVE),
    [adjustments.curves],
  );


  return (
    <div className="fixed inset-0 z-[100] oled-bg flex flex-col font-sans overflow-hidden bg-[var(--bg-primary)]">
      <TopBar
        onClose={handleRequestClose}
        onReset={draftState.discardDraft}
        isDirty={draftState.isDirty}
        isSaving={isSaving}
        handleSave={handleSave}
        handleCopy={handleCopy}
        isComparing={isComparing}
        onCompareToggle={() => setIsComparing(c => !c)}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleHistory={() => setIsHistoryOpen(prev => !prev)}
        isHistoryOpen={isHistoryOpen}
        historyCount={historyState.history.filter(e => e.type !== 'initial').length}
        exportProgress={exportProgress}
        onCopyEdits={handleCopyEdits}
        onPasteEdits={handlePasteEdits}
        hasCopiedEdits={useEditStore((s) => s.copiedAdjustments !== null)}
      />

      {/* Draft Recovery Banner */}
      {draftState.hasRestoredDraft && (
        <DraftRecoveryBanner
          timestamp={draftState.draftTimestamp}
          onDiscard={draftState.discardDraft}
          onKeep={draftState.dismissBanner}
        />
      )}

      <div className="flex-1 flex min-w-0 overflow-hidden relative isolate">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool as React.Dispatch<React.SetStateAction<ToolId | null>>}>
          {([
            ['background', <BackgroundPanel
              key="background"
              photoId={photoId || ''}
              photoUrl={currentImageSrc}
              adjustments={adjustments}
              onChange={handleAdjChange}
              onResetTool={() => handleAdjChange({ ...adjustments, background: { ...DEFAULT_BACKGROUND_ADJUSTMENTS } })}
            />],
            ['transform', <TransformPanel
              key="transform"
              hasCropSelection={hasCropSelection}
              isImageCropped={isImageCropped}
              handleApplyCrop={handleApplyCrop}
              handleResetCrop={handleResetCrop}
              currentRatio={currentRatio}
              handleSetAspectRatio={handleSetAspectRatio}
              handleRotate={handleRotate}
              straightenAngle={straightenAngle}
              handleStraighten={handleStraighten}
              flipH={flipH}
              flipV={flipV}
              handleFlipH={handleFlipH}
              handleFlipV={handleFlipV}
              adjustments={adjustments}
              onAdjustmentsChange={handleAdjChange}
            />],
            ['adjust', <AdjustPanel
              key="adjust"
              adjustments={adjustments}
              onChange={handleAdjChange}
              photoId={photoId}
              imageSrc={currentImageSrc}
              filterString={filterString}
              onAutoEnhance={handleAutoEnhance}
              isAutoEnhancing={isAutoEnhancing}
            />],
            ['portrait', <PortraitPanel
              key="portrait"
              adjustments={adjustments}
              onChange={handleAdjChange}
              photoId={photoId}
              selectedFaceIndex={selectedFaceIndex}
              onSelectFace={setSelectedFaceIndex}
            />],
            ['hsl', <HslPanel key="hsl" adjustments={adjustments} onChange={handleAdjChange} />],
            ['detail', <DetailPanel key="detail" adjustments={adjustments} onChange={handleAdjChange} />],
            ['presets', <PresetsPanel key="presets" adjustments={adjustments} onChange={handleAdjChange} imageSrc={currentImageSrc} />],
            ['texture', <TexturePanel key="texture" adjustments={adjustments} onChange={handleAdjChange} />],
            ['lut', <LutPanel key="lut" adjustments={adjustments} onChange={handleAdjChange} imageSrc={currentImageSrc} />],
            ['healing', <HealingPanel
              key="healing"
              settings={healingSettings}
              onSettingsChange={setHealingSettings}
              onClearStrokes={() => {
                healingCanvasRef.current?.clearStrokes();
                setHealingHasStrokes(false);
              }}
              hasStrokes={healingHasStrokes}
            />],
            ['layers', <LayersPanel
              key="layers"
              layers={adjustments.layers ?? []}
              onChange={(updatedLayers) => handleAdjChange({ ...adjustments, layers: updatedLayers })}
              activeLayerId={activeLayerId}
              setActiveLayerId={setActiveLayerId}
            />],
            ['raw', <RawEnginePanel
              key="raw"
              settings={adjustments.raw || rawSettings}
              onChange={handleRawSettingsChange}
              photoId={photoId}
              imageSrc={currentImageSrc}
            />],
            ['liquify', <LiquifyPanel
              key="liquify"
              settings={liquifySettings}
              onChange={setLiquifySettings}
              onResetMesh={() => {
                setLiquifySettings(DEFAULT_LIQUIFY_SETTINGS);
                liquifyCanvasRef.current?.resetMesh();
              }}
            />],
            ['colormatch', <ColorMatchPanel
              key="colormatch"
              onApplyColorMatch={handleApplyColorMatch}
              isProcessing={isColorMatching}
            />],
            ['lasso', <LassoPanel
              key="lasso"
              state={lassoState}
              onChange={setLassoState}
              adjustments={adjustments}
              onAdjustmentsChange={handleAdjChange}
              onConvertToInpaintMask={(maskUrl) => {
                setInpaintMask(maskUrl);
                setActiveTool('inpaint');
              }}
            />],
            ['frame', <FramesPanel key="frame" adjustments={adjustments} onChange={handleAdjChange} handleRotate={handleRotate} handleFlipH={handleFlipH} handleFlipV={handleFlipV} flipH={flipH} flipV={flipV} imageSrc={currentImageSrc} />],
            ['palette', <PalettePanel
              key="palette"
              imageSrc={currentImageSrc}
              swatches={paletteSwatches}
              locked={paletteLocked}
              onSwatchesChange={setPaletteSwatches}
              onLockedChange={setPaletteLocked}
              onStartEyedropper={(targetIdx) => setPalettePickingIndex(targetIdx)}
              activeEyedropperIndex={palettePickingIndex}
            />],
            ['annotations', <AnnotationsPanel key="annotations"
              annotations={annState.annotations}
              onChange={annState.updateAnnotations}
              activeDrawTool={activeDrawTool}
              setActiveDrawTool={setActiveDrawTool}
              activeColor={activeColor}
              setActiveColor={setActiveColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              selectedAnnId={annState.selectedAnnId}
              setSelectedAnnId={annState.setSelectedAnnId}
              setActiveOpacity={setActiveOpacity}
              markStyleChanged={() => { userChangedStyleRef.current = true; }}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              fontFamily={annState.fontFamily}
              setFontFamily={annState.setFontFamily}
              fontSize={annState.fontSize}
              setFontSize={annState.setFontSize}
              fontWeight={annState.fontWeight}
              setWeight={annState.setWeight}
              fontStyle={annState.fontStyle}
              setStyle={annState.setStyle}
              textDecoration={annState.textDecoration}
              setDecoration={annState.setDecoration}
              textAlign={annState.textAlign}
              setTextAlign={annState.setTextAlign}
              lineHeight={annState.lineHeight}
              setLineHeight={annState.setLineHeight}
              letterSpacing={annState.letterSpacing}
              setLetterSpacing={annState.setLetterSpacing}
              onUpdateTextProps={annState.onUpdateTextProps}
              doodleText={annState.doodleText}
              setDoodleText={annState.setDoodleText}
              doodleFontSize={annState.doodleFontSize}
              setDoodleFontSize={annState.setDoodleFontSize}
              doodleFontFamily={annState.doodleFontFamily}
              setDoodleFontFamily={annState.setDoodleFontFamily}
              showDoodleGuide={annState.showDoodleGuide}
              setShowDoodleGuide={annState.setShowDoodleGuide}
              penSettings={penSettings}
              setPenSettings={setPenSettings}
            />],
            ['inpaint', <InpaintPanel key="inpaint"
              mode={inpaintMode}
              operation={inpaintOperation}
              settings={inpaintSettings}
              onModeChange={handleInpaintModeChange}
              onOperationChange={setInpaintOperation}
              onSettingsChange={setInpaintSettings}
              onUndo={handleInpaintUndo}
              onRedo={handleInpaintRedo}
              onClearMask={() => {
                setInpaintMask(null);
                inpaintHistoryRef.current = [];
                inpaintHistoryIndexRef.current = -1;
                setInpaintCanUndo(false);
                setInpaintCanRedo(false);
                inpaintCanvasRef.current?.clearMask();
              }}
              onProcess={handleInpaintProcess}
              canUndo={inpaintCanUndo}
              canRedo={inpaintCanRedo}
              isProcessing={isSamSegmenting || isInpainting}
              infoMessage={inpaintInfoMessage}
              onClearInfoMessage={() => setInpaintInfoMessage(null)}
              onGenerateSegmentMask={handleGenerateSegmentMask}
              canSegment={samCanSegment}
              onClearSegmentPoints={handleClearSegmentPoints}
            />],
            ['depth', <DepthPanel
              key="depth"
              mode={depthMode}
              settings={depthSettings}
              onModeChange={(m) => { setDepthMode(m); if (m === 'bokeh') setDepthMapData(null); }}
              onSettingsChange={setDepthSettings}
              onProcess={handleDepthProcess}
              isProcessing={isDepthProcessing}
              depthMapData={depthMapData}
            />],
            ['enhance', <EnhancePanel
              key="enhance"
              settings={enhanceSettings}
              onSettingsChange={setEnhanceSettings}
              onUpscale={handleUpscale}
              onFaceRestore={handleFaceRestore}
              onDenoise={handleDenoise}
              onCaption={handleCaption}
              isProcessing={isEnhanceProcessing || isCaptionLoading}
              activeAction={activeEnhanceAction}
              caption={captionText}
              captionLoading={isCaptionLoading}
            />],
          ] as const).map(([toolId, panel]) => (
            <div
              key={toolId}
              style={activeTool === toolId ? undefined : { visibility: 'hidden', position: 'absolute', pointerEvents: 'none' }}
              className="flex-1 min-h-0 w-full flex flex-col"
            >
              <React.Suspense
                fallback={
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 text-white/40">
                    <div className="w-5 h-5 border-2 border-[#FCBC00] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading tool module...</span>
                  </div>
                }
              >
                {panel}
              </React.Suspense>
            </div>
          ))}
        </Sidebar>

        <CanvasArea
          currentImageSrc={currentImageSrc}
          filterString={filterString}
          cropperRef={cropperRef}
          handleCropEvent={handleCropEvent}
          handleReady={handleReady}
          activeTool={activeTool}
          adjustments={adjustments}
          isSaving={isSaving}
          curvesTable={curvesTable}
          isComparing={isComparing}
          inpaintMode={inpaintMode}
          inpaintCanvasRef={inpaintCanvasRef}
          inpaintMask={inpaintMask}
          brushSize={inpaintSettings.brushSize}
          onInpaintMaskChange={setInpaintMask}
          onInpaintStrokeComplete={handleInpaintStrokeComplete}
          onInteractivePointsChange={handleInteractivePointsChange}
          showMaskPreview={inpaintSettings.showMask}
          maskOpacity={inpaintSettings.maskOpacity}
          annotations={annState.annotations}
          onAnnotationsChange={annState.updateAnnotations}
          onStartGesture={annState.onStartGesture}
          onEndGesture={annState.onEndGesture}
          activeDrawTool={activeDrawTool}
          setActiveDrawTool={setActiveDrawTool}
          activeColor={activeColor}
          strokeWidth={strokeWidth}
          eraserSize={brushSize}
          selectedAnnId={annState.selectedAnnId}
          setSelectedAnnId={annState.setSelectedAnnId}
          userChangedStyleRef={userChangedStyleRef}

          fontFamily={annState.fontFamily}
          setFontFamily={annState.setFontFamily}
          fontSize={annState.fontSize}
          setFontSize={annState.setFontSize}
          fontWeight={annState.fontWeight}
          setWeight={annState.setWeight}
          fontStyle={annState.fontStyle}
          setStyle={annState.setStyle}
          textDecoration={annState.textDecoration}
          setDecoration={annState.setDecoration}
          textAlign={annState.textAlign}
          setTextAlign={annState.setTextAlign}
          lineHeight={annState.lineHeight}
          setLineHeight={annState.setLineHeight}
          letterSpacing={annState.letterSpacing}
          setLetterSpacing={annState.setLetterSpacing}
          onUpdateTextProps={annState.onUpdateTextProps}

          doodleText={annState.doodleText}
          setDoodleText={annState.setDoodleText}
          doodleFontSize={annState.doodleFontSize}
          setDoodleFontSize={annState.setDoodleFontSize}
          doodleFontFamily={annState.doodleFontFamily}
          setDoodleFontFamily={annState.setDoodleFontFamily}
          showDoodleGuide={annState.showDoodleGuide}
          setShowDoodleGuide={annState.setShowDoodleGuide}
          penSettings={penSettings}
          healingSettings={healingSettings}
          healingCanvasRef={healingCanvasRef}
          onHealingStrokeComplete={() => setHealingHasStrokes(true)}
          lassoState={lassoState}
          onLassoStateChange={setLassoState}
          palettePickingIndex={palettePickingIndex}
          onPaletteColorPicked={handlePaletteColorPicked}
          onCancelPalettePicking={() => setPalettePickingIndex(null)}
          faces={faces}
          selectedFaceIndex={selectedFaceIndex}
          onSelectFace={setSelectedFaceIndex}
          liquifySettings={liquifySettings}
          liquifyCanvasRef={liquifyCanvasRef}
        />

        {/* Slide-out History Overlay Drawer */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              {/* Invisible click-outside to close without dimming canvas */}
              <div
                onClick={() => setIsHistoryOpen(false)}
                className="absolute inset-0 z-30"
              />

              {/* Slide-out Panel */}
              <motion.div
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="absolute right-0 top-0 bottom-0 w-[320px] bg-[#0d0f14]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-40 flex flex-col"
              >
                <HistoryPanel
                  history={historyState.history}
                  currentHistoryIndex={historyState.currentHistoryIndex}
                  onToggleHide={historyState.toggleHideHistoryEntry}
                  onDelete={historyState.deleteHistoryEntry}
                  onEdit={(entry) => {
                    if (entry.toolId) {
                      setActiveTool(entry.toolId as ToolId);
                    }
                  }}
                  onJump={historyState.jumpToHistoryEntry}
                  onResetAll={() => historyState.jumpToHistoryEntry(0)}
                  onClose={() => setIsHistoryOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.7)] text-xs font-semibold select-none pointer-events-none ${
              toastMessage.isError
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                : 'bg-[#181a20]/95 border-white/15 text-white'
            }`}
          >
            {toastMessage.isError ? (
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
            ) : (
              <Check size={15} className="text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Unsaved Changes</h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    What would you like to do?
                  </p>
                </div>
              </div>

              <p className="text-xs text-white/70 leading-relaxed">
                You have active edits on this photo. You can keep them saved as a draft to resume anytime or discard them completely.
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleKeepDraftAndClose}
                  className="w-full py-2.5 px-4 bg-primary text-black font-semibold text-xs rounded-xl hover:brightness-110 transition active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Keep Draft & Exit</span>
                </button>
                <button
                  onClick={handleDiscardAndClose}
                  className="w-full py-2.5 px-4 bg-red-500/15 border border-red-500/30 text-red-300 font-semibold text-xs rounded-xl hover:bg-red-500/25 transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Discard All Edits & Exit</span>
                </button>
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-2 px-4 text-white/45 hover:text-white text-xs font-medium rounded-xl hover:bg-white/5 transition"
                >
                  Cancel (Stay in Editor)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
