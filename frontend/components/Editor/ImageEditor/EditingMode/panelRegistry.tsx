/**
 * panelRegistry.tsx
 * Static config of every tool panel and its props. Keeps the EditingMode
 * orchestrator from being a 200-line prop-pipe.
 */
import React from 'react';
import { ToolId } from '../Sidebar';
import { Adjustments, DEFAULT_BACKGROUND_ADJUSTMENTS } from '../filterEngine';
import { AdjustPanel } from '../AdjustPanel';
import { DetailPanel } from '../DetailPanel';
import { TransformPanel } from '../TransformPanel';
import { HslPanel } from '../HslPanel';
import { TemplatesPanel } from '../TemplatesPanel';
import { PalettePanel } from '../PalettePanel';
import { HealingPanel } from '../HealingPanel';
import { LayersPanel } from '../LayersPanel';
import { RawEnginePanel } from '../RawEnginePanel';
import { LiquifyPanel } from '../LiquifyPanel';
import { LassoPanel } from '../LassoPanel';
import type { FaceBBox } from '@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay';
import type { DrawToolId, PenSettings, Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import type { HealingCanvasRef } from '../HealingCanvas';
import type { LiquifyCanvasRef } from '../LiquifyCanvas';
import type { InpaintCanvasHandle, InpaintMode, InpaintOperation, InpaintSettings, DepthMode, DepthSettings, EnhanceSettings, EnhanceAction, CaptionTask } from '@plugins/ai-vision-studio';
import { HealingSettings } from '../healingEngine';
import { RawSettings } from '../rawEngine';
import { DEFAULT_LIQUIFY_SETTINGS } from '../liquifyEngine';
import { LassoState } from '../lassoEngine';

const BackgroundPanelLazy = React.lazy(() =>
  import('@plugins/ai-vision-studio/BackgroundPanel').then((m) => ({ default: m.BackgroundPanel })),
);
const MagicEraserPanelLazy = React.lazy(() =>
  import('@plugins/ai-vision-studio/MagicEraserPanel').then((m) => ({ default: m.MagicEraserPanel })),
);
const DepthPanelLazy = React.lazy(() =>
  import('@plugins/ai-vision-studio/DepthPanel').then((m) => ({ default: m.DepthPanel })),
);
const EnhancePanelLazy = React.lazy(() =>
  import('@plugins/ai-vision-studio/EnhancePanel').then((m) => ({ default: m.EnhancePanel })),
);
const PortraitPanelLazy = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/PortraitPanel').then((m) => ({ default: m.PortraitPanel })),
);
const ColorMatchPanelLazy = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/ColorMatchPanel').then((m) => ({ default: m.ColorMatchPanel })),
);
const AnnotationsPanelLazy = React.lazy(() =>
  import('@plugins/retouch-metadata-studio/AnnotationsPanel').then((m) => ({ default: m.AnnotationsPanel })),
);
const LutPanelLazy = React.lazy(() =>
  import('@plugins/creative-color-studio/LutPanel').then((m) => ({ default: m.LutPanel })),
);
const TexturePanelLazy = React.lazy(() =>
  import('@plugins/creative-color-studio/TexturePanel').then((m) => ({ default: m.TexturePanel })),
);
const FramesPanelLazy = React.lazy(() =>
  import('@plugins/creative-color-studio/FramesPanel').then((m) => ({ default: m.FramesPanel })),
);

export interface PanelCtx {
  photoId?: number | string;
  src: string;
  currentImageSrc: string;
  filterString: string;
  adjustments: Adjustments;
  ann: ReturnType<typeof import('./useAnnotationsState').useAnnotationsState>;
  activeDrawTool: DrawToolId;
  setActiveDrawTool: React.Dispatch<React.SetStateAction<DrawToolId>>;
  activeColor: string;
  setActiveColor: React.Dispatch<React.SetStateAction<string>>;
  setActiveOpacity: React.Dispatch<React.SetStateAction<number>>;
  strokeWidth: number;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  penSettings: PenSettings;
  setPenSettings: React.Dispatch<React.SetStateAction<PenSettings>>;
  userChangedStyleRef: React.MutableRefObject<boolean>;
  healing: {
    settings: HealingSettings;
    setSettings: React.Dispatch<React.SetStateAction<HealingSettings>>;
    canvasRef: React.MutableRefObject<HealingCanvasRef | null>;
    onClearStrokes: () => void;
    hasStrokes: boolean;
  };
  liquify: {
    settings: typeof DEFAULT_LIQUIFY_SETTINGS;
    setSettings: React.Dispatch<React.SetStateAction<typeof DEFAULT_LIQUIFY_SETTINGS>>;
    canvasRef: React.MutableRefObject<LiquifyCanvasRef | null>;
    onResetMesh: () => void;
  };
  lasso: {
    state: LassoState;
    setState: React.Dispatch<React.SetStateAction<LassoState>>;
    onConvertToInpaintMask: (maskUrl: string) => void;
  };
  layers: {
    activeLayerId: string | null;
    setActiveLayerId: React.Dispatch<React.SetStateAction<string | null>>;
  };
  palette: {
    swatches: string[];
    locked: boolean[];
    setSwatches: React.Dispatch<React.SetStateAction<string[]>>;
    setLocked: React.Dispatch<React.SetStateAction<boolean[]>>;
    pickingIndex: number | null;
    onStartPicking: (idx: number) => void;
  };
  inpaint: {
    inpaintMode: InpaintMode;
    inpaintOperation: InpaintOperation;
    inpaintSettings: InpaintSettings;
    inpaintCanUndo: boolean;
    inpaintCanRedo: boolean;
    inpaintInfoMessage: string | null;
    isInpainting: boolean;
    setInpaintOperation: React.Dispatch<React.SetStateAction<InpaintOperation>>;
    setInpaintSettings: React.Dispatch<React.SetStateAction<InpaintSettings>>;
    setInpaintInfoMessage: React.Dispatch<React.SetStateAction<string | null>>;
    handleInpaintModeChange: (mode: InpaintMode) => void;
    handleInpaintUndo: () => void;
    handleInpaintRedo: () => void;
    handleInpaintClear: () => void;
    handleInpaintProcess: () => Promise<void>;
  };
  ai: {
    depthMode: DepthMode;
    depthSettings: DepthSettings;
    depthMapData: string | null;
    isDepthProcessing: boolean;
    setDepthMode: (m: DepthMode) => void;
    setDepthSettings: React.Dispatch<React.SetStateAction<DepthSettings>>;
    handleDepthProcess: () => Promise<void>;
    enhanceSettings: EnhanceSettings;
    setEnhanceSettings: React.Dispatch<React.SetStateAction<EnhanceSettings>>;
    isEnhanceProcessing: boolean;
    activeEnhanceAction: EnhanceAction | null;
    captionText: string | null;
    isCaptionLoading: boolean;
    samCanSegment: boolean;
    samPointsCount?: number;
    isSamSegmenting: boolean;
    handleUpscale: () => void;
    handleFaceRestore: () => void;
    handleDenoise: () => void;
    handleCaption: (task: CaptionTask) => Promise<void>;
    handleGenerateSegmentMask: () => Promise<void>;
    handleClearSegmentPoints: () => void;
  };
  transform: {
    currentRatio: number;
    hasCropSelection: boolean;
    straightenAngle: number;
    handleCropEvent: () => void;
    handleApplyCrop: () => void;
    handleResetCrop: () => void;
    handleRotate: (deg: number) => void;
    handleSetAspectRatio: (r: number) => void;
    handleReady: () => void;
    handleFlipH: () => void;
    handleFlipV: () => void;
    handleStraighten: (angle: number) => void;
  };
  raw: {
    settings: RawSettings;
    onChange: (raw: RawSettings) => void;
  };
  isColorMatching: boolean;
  isAutoEnhancing: boolean;
  handleAdjChange: (a: Adjustments) => void;
  handleRawSettingsChange: (raw: RawSettings) => void;
  handleApplyColorMatch: (refSrc: string, strength: number) => Promise<void>;
  handleAutoEnhance: () => Promise<void>;
  setInpaintMask: (m: string | null) => void;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolId | null>>;
  flipH: boolean;
  flipV: boolean;
  setFlipH: React.Dispatch<React.SetStateAction<boolean>>;
  setFlipV: React.Dispatch<React.SetStateAction<boolean>>;
  faces: FaceBBox[];
  selectedFaceIndex: number | null;
  setSelectedFaceIndex: React.Dispatch<React.SetStateAction<number | null>>;
  activeTool: ToolId | null;
}

export const PANELS: Array<[ToolId, (ctx: PanelCtx) => React.ReactNode]> = [
  ['background', (c) => (
    <BackgroundPanelLazy
      photoId={c.photoId || ''}
      photoUrl={c.currentImageSrc}
      adjustments={c.adjustments}
      onChange={c.handleAdjChange}
      onResetTool={() => c.handleAdjChange({ ...c.adjustments, background: { ...DEFAULT_BACKGROUND_ADJUSTMENTS } })}
    />
  )],
  ['transform', (c) => (
    <TransformPanel
      hasCropSelection={c.transform.hasCropSelection}
      isImageCropped={c.currentImageSrc !== c.src}
      handleApplyCrop={c.transform.handleApplyCrop}
      handleResetCrop={c.transform.handleResetCrop}
      currentRatio={c.transform.currentRatio}
      handleSetAspectRatio={c.transform.handleSetAspectRatio}
      handleRotate={c.transform.handleRotate}
      straightenAngle={c.transform.straightenAngle}
      handleStraighten={c.transform.handleStraighten}
      flipH={c.flipH}
      flipV={c.flipV}
      handleFlipH={c.transform.handleFlipH}
      handleFlipV={c.transform.handleFlipV}
      adjustments={c.adjustments}
      onAdjustmentsChange={c.handleAdjChange}
    />
  )],
  ['adjust', (c) => (
    <AdjustPanel
      adjustments={c.adjustments}
      onChange={c.handleAdjChange}
      photoId={c.photoId}
      imageSrc={c.currentImageSrc}
      filterString={c.filterString}
      onAutoEnhance={c.handleAutoEnhance}
      isAutoEnhancing={c.isAutoEnhancing}
    />
  )],
  ['portrait', (c) => (
    <PortraitPanelLazy
      adjustments={c.adjustments}
      onChange={c.handleAdjChange}
      photoId={c.photoId}
      selectedFaceIndex={c.selectedFaceIndex}
      onSelectFace={c.setSelectedFaceIndex}
    />
  )],
  ['hsl', (c) => (
    <HslPanel adjustments={c.adjustments} onChange={c.handleAdjChange} />
  )],
  ['detail', (c) => (
    <DetailPanel adjustments={c.adjustments} onChange={c.handleAdjChange} />
  )],
  ['templates', (c) => (
    <TemplatesPanel adjustments={c.adjustments} onChange={c.handleAdjChange} imageSrc={c.currentImageSrc} />
  )],
  ['texture', (c) => (
    <TexturePanelLazy adjustments={c.adjustments} onChange={c.handleAdjChange} />
  )],
  ['lut', (c) => (
    <LutPanelLazy adjustments={c.adjustments} onChange={c.handleAdjChange} imageSrc={c.currentImageSrc} />
  )],
  ['healing', (c) => (
    <HealingPanel
      settings={c.healing.settings}
      onSettingsChange={c.healing.setSettings}
      onClearStrokes={c.healing.onClearStrokes}
      hasStrokes={c.healing.hasStrokes}
    />
  )],
  ['layers', (c) => (
    <LayersPanel
      layers={c.adjustments.layers ?? []}
      onChange={(updatedLayers) => c.handleAdjChange({ ...c.adjustments, layers: updatedLayers })}
      activeLayerId={c.layers.activeLayerId}
      setActiveLayerId={c.layers.setActiveLayerId}
    />
  )],
  ['raw', (c) => (
    <RawEnginePanel
      settings={c.adjustments.raw || c.raw.settings}
      onChange={c.handleRawSettingsChange}
      photoId={c.photoId}
      imageSrc={c.currentImageSrc}
    />
  )],
  ['liquify', (c) => (
    <LiquifyPanel
      settings={c.liquify.settings}
      onChange={c.liquify.setSettings}
      onResetMesh={c.liquify.onResetMesh}
    />
  )],
  ['colormatch', (c) => (
    <ColorMatchPanelLazy onApplyColorMatch={c.handleApplyColorMatch} isProcessing={c.isColorMatching} />
  )],
  ['lasso', (c) => (
    <LassoPanel
      state={c.lasso.state}
      onChange={c.lasso.setState}
      adjustments={c.adjustments}
      onAdjustmentsChange={c.handleAdjChange}
      onConvertToInpaintMask={(maskUrl) => {
        c.setInpaintMask(maskUrl);
        c.setActiveTool('inpaint');
      }}
    />
  )],
  ['frame', (c) => (
    <FramesPanelLazy
      adjustments={c.adjustments}
      onChange={c.handleAdjChange}
      handleRotate={c.transform.handleRotate}
      handleFlipH={c.transform.handleFlipH}
      handleFlipV={c.transform.handleFlipV}
      flipH={c.flipH}
      flipV={c.flipV}
      imageSrc={c.currentImageSrc}
    />
  )],
  ['palette', (c) => (
    <PalettePanel
      imageSrc={c.currentImageSrc}
      swatches={c.palette.swatches}
      locked={c.palette.locked}
      onSwatchesChange={c.palette.setSwatches}
      onLockedChange={c.palette.setLocked}
      onStartEyedropper={c.palette.onStartPicking}
      activeEyedropperIndex={c.palette.pickingIndex}
    />
  )],
  ['annotations', (c) => (
    <AnnotationsPanelLazy
      annotations={c.ann.annotations}
      onChange={c.ann.updateAnnotations}
      activeDrawTool={c.activeDrawTool}
      setActiveDrawTool={c.setActiveDrawTool}
      activeColor={c.activeColor}
      setActiveColor={c.setActiveColor}
      strokeWidth={c.strokeWidth}
      setStrokeWidth={c.setStrokeWidth}
      selectedAnnId={c.ann.selectedAnnId}
      setSelectedAnnId={c.ann.setSelectedAnnId}
      setActiveOpacity={c.setActiveOpacity}
      markStyleChanged={() => { c.userChangedStyleRef.current = true; }}
      brushSize={c.brushSize}
      setBrushSize={c.setBrushSize}
      fontFamily={c.ann.fontFamily}
      setFontFamily={c.ann.setFontFamily}
      fontSize={c.ann.fontSize}
      setFontSize={c.ann.setFontSize}
      fontWeight={c.ann.fontWeight}
      setWeight={c.ann.setWeight}
      fontStyle={c.ann.fontStyle}
      setStyle={c.ann.setStyle}
      textDecoration={c.ann.textDecoration}
      setDecoration={c.ann.setDecoration}
      textAlign={c.ann.textAlign}
      setTextAlign={c.ann.setTextAlign}
      lineHeight={c.ann.lineHeight}
      setLineHeight={c.ann.setLineHeight}
      letterSpacing={c.ann.letterSpacing}
      setLetterSpacing={c.ann.setLetterSpacing}
      onUpdateTextProps={c.ann.onUpdateTextProps}
      doodleText={c.ann.doodleText}
      setDoodleText={c.ann.setDoodleText}
      doodleFontSize={c.ann.doodleFontSize}
      setDoodleFontSize={c.ann.setDoodleFontSize}
      doodleFontFamily={c.ann.doodleFontFamily}
      setDoodleFontFamily={c.ann.setDoodleFontFamily}
      showDoodleGuide={c.ann.showDoodleGuide}
      setShowDoodleGuide={c.ann.setShowDoodleGuide}
      penSettings={c.penSettings}
      setPenSettings={c.setPenSettings}
    />
  )],
  ['inpaint', (c) => (
    <MagicEraserPanelLazy
      mode={c.inpaint.inpaintMode}
      operation={c.inpaint.inpaintOperation}
      settings={c.inpaint.inpaintSettings}
      onModeChange={c.inpaint.handleInpaintModeChange}
      onOperationChange={c.inpaint.setInpaintOperation}
      onSettingsChange={c.inpaint.setInpaintSettings}
      onUndo={c.inpaint.handleInpaintUndo}
      onRedo={c.inpaint.handleInpaintRedo}
      onClearMask={c.inpaint.handleInpaintClear}
      onProcess={c.inpaint.handleInpaintProcess}
      canUndo={c.inpaint.inpaintCanUndo}
      canRedo={c.inpaint.inpaintCanRedo}
      isProcessing={c.ai.isSamSegmenting || c.inpaint.isInpainting}
      infoMessage={c.inpaint.inpaintInfoMessage}
      onClearInfoMessage={() => c.inpaint.setInpaintInfoMessage(null)}
      onGenerateSegmentMask={c.ai.handleGenerateSegmentMask}
      canSegment={c.ai.samCanSegment}
      onClearSegmentPoints={c.ai.handleClearSegmentPoints}
      interactivePointsCount={c.ai.samPointsCount}
    />
  )],
  ['depth', (c) => (
    <DepthPanelLazy
      mode={c.ai.depthMode}
      settings={c.ai.depthSettings}
      onModeChange={c.ai.setDepthMode}
      onSettingsChange={c.ai.setDepthSettings}
      onProcess={c.ai.handleDepthProcess}
      isProcessing={c.ai.isDepthProcessing}
      depthMapData={c.ai.depthMapData}
    />
  )],
  ['enhance', (c) => (
    <EnhancePanelLazy
      settings={c.ai.enhanceSettings}
      onSettingsChange={c.ai.setEnhanceSettings}
      onUpscale={c.ai.handleUpscale}
      onFaceRestore={c.ai.handleFaceRestore}
      onDenoise={c.ai.handleDenoise}
      isProcessing={c.ai.isEnhanceProcessing}
      activeAction={c.ai.activeEnhanceAction}
    />
  )],
];
