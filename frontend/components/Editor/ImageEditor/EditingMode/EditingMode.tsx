/**
 * EditingMode.tsx
 * Top-level orchestrator. Owns no JSX beyond layout; wires hooks to sub-components.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanvasArea } from '../CanvasArea';
import { useEditDraftAutoSave } from '@/hooks/useEditDraftAutoSave';
import { Adjustments, toFilterString } from '../filterEngine';
import { DEFAULT_CURVE, getCurvesTableValues } from '../curves';
import { HealingSettings, DEFAULT_HEALING_SETTINGS } from '../healingEngine';
import { LiquifyCanvasRef } from '../LiquifyCanvas';
import { HealingCanvasRef } from '../HealingCanvas';
import { DEFAULT_LIQUIFY_SETTINGS } from '../liquifyEngine';
import { DEFAULT_LASSO_STATE, LassoState } from '../lassoEngine';
import { RawSettings, DEFAULT_RAW_SETTINGS } from '../rawEngine';
import {
  DEFAULT_PEN_SETTINGS,
  PenSettings,
  DrawToolId,
  Annotation,
} from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { InpaintCanvasHandle } from '@plugins/ai-vision-studio';
import { useEditStore } from '@/store/editStore';
import { matchColorBetweenImages } from '@plugins/retouch-metadata-studio';

import { useAnnotationsState } from './useAnnotationsState';
import { useEditingHistory } from './useEditingHistory';
import { useKeyBindings } from './useKeyBindings';
import { useTransformControls } from './hooks/useTransformControls';
import { useInpaintState } from './hooks/useInpaintState';
import { useAiEnhance } from './hooks/useAiEnhance';
import { useExportSave } from './hooks/useExportSave';
import { useToast } from './hooks/useToast';
import { useFacesLoader } from './hooks/useFacesLoader';
import { useExitGuard } from './hooks/useExitGuard';

import { TopBarSection } from './components/TopBarSection';
import { ToolsSidebar } from './components/ToolsSidebar';
import { HistoryOverlay } from './components/HistoryOverlay';
import { ToastNotification } from './components/ToastNotification';
import { ExitConfirmDialog } from './components/ExitConfirmDialog';
import { AiModelLoadingOverlay } from '../AiModelLoadingOverlay';
import { useAiLoadingStore } from '@/store/aiLoadingStore';
import { PanelCtx } from './panelRegistry';
import { ToolId } from '../Sidebar';
import { HistoryActionType } from '../history';

interface EditingModeProps {
  src: string;
  onClose: () => void;
  onSave: (file: Blob, isSaveAs: boolean) => void;
  photoId?: number | string;
}

export const EditingMode: React.FC<EditingModeProps> = ({ src, onClose, onSave, photoId }) => {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const cropperRef = useRef<any>(null);
  const inpaintCanvasRef = useRef<InpaintCanvasHandle | null>(null);
  const healingCanvasRef = useRef<HealingCanvasRef | null>(null);
  const liquifyCanvasRef = useRef<LiquifyCanvasRef | null>(null);
  const userChangedStyleRef = useRef(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<ToolId | null>('templates');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // ── Drawing-mode state ────────────────────────────────────────────────────
  const [activeDrawTool, setActiveDrawTool] = useState<DrawToolId>('freehand');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [activeOpacity, setActiveOpacity] = useState<number>(1);
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [brushSize, setBrushSize] = useState<number>(35);
  const [penSettings, setPenSettings] = useState<PenSettings>(DEFAULT_PEN_SETTINGS);

  // ── Tool-specific local state ─────────────────────────────────────────────
  const [healingSettings, setHealingSettings] = useState<HealingSettings>(DEFAULT_HEALING_SETTINGS);
  const [healingHasStrokes, setHealingHasStrokes] = useState<boolean>(false);
  const [liquifySettings, setLiquifySettings] = useState(DEFAULT_LIQUIFY_SETTINGS);
  const [lassoState, setLassoState] = useState<LassoState>(DEFAULT_LASSO_STATE);
  const [rawSettings, setRawSettings] = useState<RawSettings>(DEFAULT_RAW_SETTINGS);
  const [activeLayerId, setActiveLayerId] = useState<string | null>('layer-base');

  // ── Palette swatches ──────────────────────────────────────────────────────
  const [paletteSwatches, setPaletteSwatches] = useState<string[]>([
    '#808080', '#808080', '#808080', '#808080', '#808080', '#808080',
  ]);
  const [paletteLocked, setPaletteLocked] = useState<boolean[]>([
    false, false, false, false, false, false,
  ]);
  const [palettePickingIndex, setPalettePickingIndex] = useState<number | null>(null);

  // ── Core hooks ────────────────────────────────────────────────────────────
  const { toastMessage, showToast } = useToast();
  const faces = useFacesLoader(photoId);
  // ponytail: ref indirection — ann is created before history, so the commit
  // callback can't close over addHistoryEntry directly
  const annCommitRef = useRef<(prev: Annotation[], next: Annotation[]) => void>(() => {});
  const ann = useAnnotationsState((prev, next) => annCommitRef.current(prev, next));
  const history = useEditingHistory({
    src,
    cropperRef,
    annotations: ann.annotations,
    setAnnotations: ann.setAnnotations,
    setAnnotationsHistoryPast: ann.setAnnotationsHistoryPast,
    setAnnotationsHistoryFuture: ann.setAnnotationsHistoryFuture,
    photoId,
  });

  const {
    currentImageSrc, setCurrentImageSrc, adjustments, setAdjustments,
    flipH, setFlipH, flipV, setFlipV,
    straightenAngle, setStraightenAngle, totalRotation, setTotalRotation,
    canUndo, canRedo, handleUndo, handleRedo, addHistoryEntry,
  } = history;

  // ── Image natural dimensions ──────────────────────────────────────────────
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    if (!currentImageSrc) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.src = currentImageSrc;
  }, [currentImageSrc]);

  // Annotation commits (stroke drawn / moved / deleted) become timeline snapshots
  useEffect(() => {
    annCommitRef.current = (prev, next) => {
      const label = next.length > prev.length ? 'Added annotation'
        : next.length < prev.length ? 'Deleted annotation' : 'Edited annotation';
      addHistoryEntry('annotations', label, undefined, undefined, next, {
        toolId: 'annotations',
        isSnapshot: true,
      });
    };
  }, [addHistoryEntry]);

  // ── Transform / crop ──────────────────────────────────────────────────────
  const transform = useTransformControls({
    src, currentImageSrc, cropperRef, flipH, setFlipH, flipV, setFlipV,
    totalRotation, setTotalRotation, straightenAngle, setStraightenAngle,
    setCurrentImageSrc, history,
    annotations: ann.annotations,
    onAnnotationsChange: ann.updateAnnotations,
  });
  useEffect(() => {
    transform.setActiveTool(activeTool);
  }, [activeTool, transform.setActiveTool]);

  // ── Inpaint ───────────────────────────────────────────────────────────────
  const inpaint = useInpaintState({
    photoId, currentImageSrc, inpaintCanvasRef, setCurrentImageSrc, history, showToast,
  });

  // ── AI enhance (depth / enhance / caption / SAM) ──────────────────────────
  const ai = useAiEnhance({
    photoId, setCurrentImageSrc, inpaintCanvasRef,
    setInpaintMask: inpaint.setInpaintMask,
    handleInpaintStrokeComplete: inpaint.handleInpaintStrokeComplete,
    history, showToast,
  });

  // ── Export / save / copy / auto-enhance ───────────────────────────────────
  const exporter = useExportSave({
    photoId, src, currentImageSrc, cropRect: transform.cropRect,
    cropperRef, adjustments, annotations: ann.annotations,
    healingCanvasRef, liquifyCanvasRef, onSave, showToast,
  });

  // ── Auto-save / draft ─────────────────────────────────────────────────────
  const draft = useEditDraftAutoSave({
    photoId, adjustments, setAdjustments, totalRotation, setTotalRotation,
    straightenAngle, setStraightenAngle, flipH, setFlipH, flipV, setFlipV,
    annotations: ann.annotations, setAnnotations: ann.setAnnotations,
    cropperRef, rawSettings, liquifySettings, isSaving: exporter.isSaving,
  });

  // ── Exit guard ────────────────────────────────────────────────────────────
  const exit = useExitGuard({ isDirty: draft.isDirty, onClose, discardDraft: draft.discardDraft });

  // ── Color match ───────────────────────────────────────────────────────────
  const [isColorMatching, setIsColorMatching] = useState(false);
  const handleApplyColorMatch = useCallback(async (refSrc: string, strength: number) => {
    if (isColorMatching || !refSrc) return;
    setIsColorMatching(true);

    try {
      const blobUrl = await matchColorBetweenImages(currentImageSrc, refSrc, strength);
      history.createdUrlRef.current = blobUrl;

      setCurrentImageSrc(blobUrl);
      addHistoryEntry(
        'colormatch' as HistoryActionType,
        `Applied Shot Matcher (${strength}%)`,
        undefined,
        blobUrl,
        undefined,
        {
          toolId: 'colormatch',
          isSnapshot: true,
        },
      );
      showToast('Color palette matched successfully');
    } catch (e) {
      console.error('Color match failed:', e);
      showToast('Failed to apply color match', true);
    } finally {
      setIsColorMatching(false);
    }
  }, [isColorMatching, currentImageSrc, history, setCurrentImageSrc, addHistoryEntry, showToast]);

  // ── Global AI Processing Overlay State ────────────────────────────────────
  const aiStore = useAiLoadingStore();
  const isAnyAiProcessing =
    aiStore.isLoading ||
    inpaint.isInpainting ||
    ai.isSamSegmenting ||
    ai.isDepthProcessing ||
    ai.isEnhanceProcessing ||
    ai.isCaptionLoading ||
    isColorMatching;

  const currentOperationName = useMemo(() => {
    if (aiStore.isLoading && aiStore.operationName) return aiStore.operationName;
    if (inpaint.isInpainting) return 'Magic Eraser Inpainting';
    if (ai.isSamSegmenting) return 'MobileSAM Subject Segmentation';
    if (ai.isDepthProcessing) return 'Monocular Depth & Bokeh';
    if (ai.isEnhanceProcessing) return 'AI Super-Resolution & Restore';
    if (ai.isCaptionLoading) return 'Florence-2 Vision Analysis';
    if (isColorMatching) return 'Shot Matcher 3D Color Transfer';
    return 'AI Model Inference';
  }, [
    aiStore.isLoading,
    aiStore.operationName,
    inpaint.isInpainting,
    ai.isSamSegmenting,
    ai.isDepthProcessing,
    ai.isEnhanceProcessing,
    ai.isCaptionLoading,
    isColorMatching,
  ]);

  // ── Raw settings change → adjustments merge ───────────────────────────────
  const handleRawSettingsChange = useCallback((raw: RawSettings) => {
    setRawSettings(raw);
    setAdjustments((prev: Adjustments) => ({ ...prev, raw }));
  }, [setAdjustments]);

  // ── Adjustments & edit clipboard ──────────────────────────────────────────
  const handleAdjChange = useCallback((a: Adjustments) => setAdjustments(a), [setAdjustments]);

  const handleCopyEdits = useCallback(() => {
    useEditStore.getState().copyAdjustments(adjustments);
    showToast('Edits copied to clipboard');
  }, [adjustments, showToast]);

  const handlePasteEdits = useCallback(() => {
    const copied = useEditStore.getState().copiedAdjustments;
    if (!copied) return;
    setAdjustments(prev => ({ ...prev, ...copied }));
    showToast('Edits applied to photo');
  }, [setAdjustments, showToast]);

  const handleAutoEnhance = useCallback(async () => {
    if (!photoId) return;
    const partial = await exporter.handleAutoEnhance();
    if (partial) setAdjustments(prev => ({ ...prev, ...partial }));
  }, [photoId, exporter, setAdjustments]);

  // ── Palette eyedropper ────────────────────────────────────────────────────
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const filterString = useMemo(() => toFilterString(adjustments), [adjustments]);
  const curvesTable = useMemo(
    () => getCurvesTableValues(adjustments.curves || DEFAULT_CURVE),
    [adjustments.curves],
  );

  // ── Keyboard bindings ─────────────────────────────────────────────────────
  useKeyBindings({
    activeTool,
    undoAnnotations: ann.undoAnnotations,
    redoAnnotations: ann.redoAnnotations,
    handleUndo, handleRedo, setIsComparing, cropperRef,
    inpaintMode: inpaint.inpaintMode,
    setInpaintSettings: inpaint.setInpaintSettings,
    inpaintCanUndo: inpaint.inpaintCanUndo,
    inpaintCanRedo: inpaint.inpaintCanRedo,
    onInpaintUndo: inpaint.handleInpaintUndo,
    onInpaintRedo: inpaint.handleInpaintRedo,
    onAutoEnhance: handleAutoEnhance,
    onToggleHistory: () => setIsHistoryOpen(prev => !prev),
  });

  // ── Panel context (typed as PanelCtx; cast through unknown for `any` slots) ─
  const panelCtx: PanelCtx = {
    photoId, src, currentImageSrc, filterString, adjustments, ann,
    activeDrawTool, setActiveDrawTool, activeColor, setActiveColor,
    setActiveOpacity, strokeWidth, setStrokeWidth,
    brushSize, setBrushSize, penSettings, setPenSettings, userChangedStyleRef,
    healing: {
      settings: healingSettings, setSettings: setHealingSettings,
      canvasRef: healingCanvasRef,
      onClearStrokes: () => {
        healingCanvasRef.current?.clearStrokes();
        setHealingHasStrokes(false);
      },
      hasStrokes: healingHasStrokes,
    },
    liquify: {
      settings: liquifySettings, setSettings: setLiquifySettings,
      canvasRef: liquifyCanvasRef,
      onResetMesh: () => {
        setLiquifySettings(DEFAULT_LIQUIFY_SETTINGS);
        liquifyCanvasRef.current?.resetMesh();
      },
    },
    lasso: {
      state: lassoState,
      setState: setLassoState,
      naturalWidth: naturalDimensions.width,
      naturalHeight: naturalDimensions.height,
      onConvertToInpaintMask: (maskUrl: string) => {
        inpaint.setInpaintMask(maskUrl);
        setActiveTool('inpaint');
      },
      onAddHistoryEntry: (toolId: string, description: string) => {
        addHistoryEntry(
          toolId as HistoryActionType,
          description,
          undefined,
          undefined,
          undefined,
          { isSnapshot: true },
        );
      },
    },
    layers: { activeLayerId, setActiveLayerId },
    palette: {
      swatches: paletteSwatches, locked: paletteLocked,
      setSwatches: setPaletteSwatches, setLocked: setPaletteLocked,
      pickingIndex: palettePickingIndex, onStartPicking: setPalettePickingIndex,
    },
    inpaint: {
      inpaintMode: inpaint.inpaintMode,
      inpaintOperation: inpaint.inpaintOperation,
      inpaintSettings: inpaint.inpaintSettings,
      inpaintCanUndo: inpaint.inpaintCanUndo,
      inpaintCanRedo: inpaint.inpaintCanRedo,
      inpaintInfoMessage: inpaint.inpaintInfoMessage,
      isInpainting: inpaint.isInpainting,
      setInpaintOperation: inpaint.setInpaintOperation,
      setInpaintSettings: inpaint.setInpaintSettings,
      setInpaintInfoMessage: inpaint.setInpaintInfoMessage,
      handleInpaintModeChange: inpaint.handleInpaintModeChange,
      handleInpaintUndo: inpaint.handleInpaintUndo,
      handleInpaintRedo: inpaint.handleInpaintRedo,
      handleInpaintClear: inpaint.handleInpaintClear,
      handleInpaintProcess: inpaint.handleInpaintProcess,
    },
    ai: {
      depthMode: ai.depthMode,
      depthSettings: ai.depthSettings,
      depthMapData: ai.depthMapData,
      isDepthProcessing: ai.isDepthProcessing,
      setDepthMode: ai.setDepthMode,
      setDepthSettings: ai.setDepthSettings,
      handleDepthProcess: ai.handleDepthProcess,
      enhanceSettings: ai.enhanceSettings,
      setEnhanceSettings: ai.setEnhanceSettings,
      isEnhanceProcessing: ai.isEnhanceProcessing,
      activeEnhanceAction: ai.activeEnhanceAction,
      captionText: ai.captionText,
      isCaptionLoading: ai.isCaptionLoading,
      samCanSegment: ai.samCanSegment,
      samPointsCount: ai.samPointsCount,
      isSamSegmenting: ai.isSamSegmenting,
      handleUpscale: ai.handleUpscale,
      handleFaceRestore: ai.handleFaceRestore,
      handleDenoise: ai.handleDenoise,
      handleCaption: ai.handleCaption,
      handleGenerateSegmentMask: ai.handleGenerateSegmentMask,
      handleClearSegmentPoints: ai.handleClearSegmentPoints,
    },
    transform: {
      currentRatio: transform.currentRatio,
      hasCropSelection: transform.hasCropSelection,
      straightenAngle: transform.straightenAngle,
      handleCropEvent: transform.handleCropEvent,
      handleApplyCrop: transform.handleApplyCrop,
      handleResetCrop: transform.handleResetCrop,
      handleRotate: transform.handleRotate,
      handleSetAspectRatio: transform.handleSetAspectRatio,
      handleReady: transform.handleReady,
      handleFlipH: transform.handleFlipH,
      handleFlipV: transform.handleFlipV,
      handleStraighten: transform.handleStraighten,
    },
    raw: { settings: rawSettings, onChange: handleRawSettingsChange },
    isColorMatching, isAutoEnhancing: exporter.isAutoEnhancing,
    handleAdjChange, handleRawSettingsChange,
    handleApplyColorMatch, handleAutoEnhance,
    setInpaintMask: inpaint.setInpaintMask, setActiveTool,
    flipH, flipV, setFlipH, setFlipV,
    faces: faces.faces,
    selectedFaceIndex: faces.selectedFaceIndex,
    setSelectedFaceIndex: faces.setSelectedFaceIndex,
    activeTool,
  } as unknown as PanelCtx;

  return (
    <div className="fixed inset-0 z-[100] oled-bg flex flex-col font-sans overflow-hidden bg-[var(--bg-primary)]">
      <TopBarSection
        onClose={exit.handleRequestClose}
        isSaving={exporter.isSaving}
        handleSave={exporter.handleSave}
        handleCopy={exporter.handleCopy}
        isComparing={isComparing}
        onCompareToggle={() => setIsComparing(c => !c)}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleHistory={() => setIsHistoryOpen(prev => !prev)}
        isHistoryOpen={isHistoryOpen}
        historyCount={history.history.filter(e => e.type !== 'initial').length}
        exportProgress={exporter.exportProgress}
        onCopyEdits={handleCopyEdits}
        onPasteEdits={handlePasteEdits}
        hasCopiedEdits={useEditStore(s => s.copiedAdjustments !== null)}
        draft={draft}
      />

      <div className="flex-1 flex min-w-0 overflow-hidden relative isolate">
        <ToolsSidebar
          activeTool={activeTool}
          setActiveTool={setActiveTool as React.Dispatch<React.SetStateAction<ToolId | null>>}
          ctx={panelCtx}
        />

        <div className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <CanvasArea
            currentImageSrc={currentImageSrc}
            filterString={filterString}
            cropperRef={cropperRef}
            cropRect={transform.cropRect}
            onCropChange={transform.onCropChange}
            aspectRatio={transform.currentRatio}
            handleCropEvent={transform.handleCropEvent}
            handleReady={transform.handleReady}
            activeTool={activeTool}
            adjustments={adjustments}
            isSaving={exporter.isSaving}
            curvesTable={curvesTable}
            isComparing={isComparing}
            inpaintMode={inpaint.inpaintMode}
            inpaintCanvasRef={inpaintCanvasRef}
            inpaintMask={inpaint.inpaintMask}
            brushSize={inpaint.inpaintSettings.brushSize}
            brushHardness={inpaint.inpaintSettings.brushHardness}
            onInpaintMaskChange={inpaint.setInpaintMask}
            onInpaintStrokeComplete={inpaint.handleInpaintStrokeComplete}
            onInteractivePointsChange={ai.handleInteractivePointsChange}
            showMaskPreview={inpaint.inpaintSettings.showMask}
            maskOpacity={inpaint.inpaintSettings.maskOpacity}
            annotations={ann.annotations}
            onAnnotationsChange={ann.updateAnnotations}
            onStartGesture={ann.onStartGesture}
            onEndGesture={ann.onEndGesture}
            activeDrawTool={activeDrawTool}
            setActiveDrawTool={setActiveDrawTool}
            activeColor={activeColor}
            strokeWidth={strokeWidth}
            eraserSize={brushSize}
            selectedAnnId={ann.selectedAnnId}
            setSelectedAnnId={ann.setSelectedAnnId}
            selectedAnnIds={ann.selectedAnnIds}
            setSelectedAnnIds={ann.setSelectedAnnIds}
            userChangedStyleRef={userChangedStyleRef}

            fontFamily={ann.fontFamily}
            setFontFamily={ann.setFontFamily}
            fontSize={ann.fontSize}
            setFontSize={ann.setFontSize}
            fontWeight={ann.fontWeight}
            setWeight={ann.setWeight}
            fontStyle={ann.fontStyle}
            setStyle={ann.setStyle}
            textDecoration={ann.textDecoration}
            setDecoration={ann.setDecoration}
            textAlign={ann.textAlign}
            setTextAlign={ann.setTextAlign}
            lineHeight={ann.lineHeight}
            setLineHeight={ann.setLineHeight}
            letterSpacing={ann.letterSpacing}
            setLetterSpacing={ann.setLetterSpacing}
            onUpdateTextProps={ann.onUpdateTextProps}

            doodleText={ann.doodleText}
            setDoodleText={ann.setDoodleText}
            doodleFontSize={ann.doodleFontSize}
            setDoodleFontSize={ann.setDoodleFontSize}
            doodleFontFamily={ann.doodleFontFamily}
            setDoodleFontFamily={ann.setDoodleFontFamily}
            showDoodleGuide={ann.showDoodleGuide}
            setShowDoodleGuide={ann.setShowDoodleGuide}
            penSettings={penSettings}
            healingSettings={healingSettings}
            healingCanvasRef={healingCanvasRef}
            onHealingStrokeComplete={() => setHealingHasStrokes(true)}
            lassoState={lassoState}
            onLassoStateChange={setLassoState}
            palettePickingIndex={palettePickingIndex}
            onPaletteColorPicked={handlePaletteColorPicked}
            onCancelPalettePicking={() => setPalettePickingIndex(null)}
            faces={faces.faces}
            selectedFaceIndex={faces.selectedFaceIndex}
            onSelectFace={faces.setSelectedFaceIndex}
            liquifySettings={liquifySettings}
            liquifyCanvasRef={liquifyCanvasRef}
          />

          <AiModelLoadingOverlay
            isLoading={isAnyAiProcessing}
            operationName={currentOperationName}
            detailMessage={aiStore.detailMessage}
            curveType={aiStore.curveType}
          />
        </div>

        <HistoryOverlay
          open={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history.history}
          currentHistoryIndex={history.currentHistoryIndex}
          onToggleHide={history.toggleHideHistoryEntry}
          onDelete={history.deleteHistoryEntry}
          onJump={history.jumpToHistoryEntry}
          onResetAll={() => history.jumpToHistoryEntry(0)}
          setActiveTool={setActiveTool}
        />
      </div>

      <ToastNotification message={toastMessage} />
      <ExitConfirmDialog
        open={exit.showExitConfirm}
        onKeep={exit.handleKeepDraftAndClose}
        onDiscard={exit.handleDiscardAndClose}
        onCancel={() => exit.setShowExitConfirm(false)}
      />
    </div>
  );
};
