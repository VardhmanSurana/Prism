/**
 * CanvasArea.tsx
 * Orchestrator: composes the extracted hooks (zoom, pan, compare, image loader,
 * cropper setup) and mounts the overlay sub-components over the cropper viewport.
 */
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import 'cropperjs/dist/cropper.css';
import { ToolId } from '../Sidebar';
import { Adjustments } from '../filterEngine';
import type { InpaintCanvasHandle } from '@plugins/ai-vision-studio';
import type { Annotation, DrawToolId } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { drawFilteredImageToCanvas } from '../canvasDrawing';
import type { CanvasAreaProps } from '../CanvasArea.types';

import { useCanvasZoom } from '../useCanvasZoom';
import { useCtrlPan } from '../useCtrlPan';
import { useCompareSlider } from '../useCompareSlider';
import { useImageLoader } from '../useImageLoader';
import { useCropperSetup } from '../useCropperSetup';
import {
  AnnotationsOverlay,
  BeforeImageLayer,
  CanvasFilters,
  CanvasSavingOverlay,
  CompareOverlay,
  FaceBBoxOverlayHost,
  HealingOverlay,
  InpaintOverlay,
  LassoOverlay,
  LivePreviewCanvas,
  LiquifyOverlay,
  PaletteEyedropperOverlayHost,
  useImageRectSync,
  ZoomControlsHost,
  type ImageRect,
} from './index';
import type { HealingCanvasRef } from '../HealingCanvas';
import type { LiquifyCanvasRef } from '../LiquifyCanvas';

export const CanvasArea: React.FC<CanvasAreaProps> = (p) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [canvasDrawKey, setCanvasDrawKey] = useState(0);
  const [hasDrawnCanvas, setHasDrawnCanvas] = useState(false);

  // Overlay container refs
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeImageRef = useRef<HTMLImageElement | null>(null);
  const annotationsContainerRef = useRef<HTMLDivElement | null>(null);
  const inpaintContainerRef = useRef<HTMLDivElement | null>(null);
  const healingContainerRef = useRef<HTMLDivElement | null>(null);
  const lassoContainerRef = useRef<HTMLDivElement | null>(null);
  const paletteContainerRef = useRef<HTMLDivElement | null>(null);
  const faceBBoxContainerRef = useRef<HTMLDivElement | null>(null);
  const liquifyContainerRef = useRef<HTMLDivElement | null>(null);
  const beforeLabelRef = useRef<HTMLDivElement | null>(null);
  const afterLabelRef = useRef<HTMLDivElement | null>(null);
  const compareDividerRef = useRef<HTMLDivElement | null>(null);
  const latestComparePercentRef = useRef<number>(50);

  const handleCanvasRedrawRequest = useCallback(() => setCanvasDrawKey(k => k + 1), []);

  const { updateImageRect, imageRect, isDraggingSliderRef } = useImageRectSync({
    cropperRef: p.cropperRef,
    currentImageSrc: p.currentImageSrc,
    overlays: {
      liveCanvasRef, beforeImageRef, annotationsContainerRef,
      inpaintContainerRef, healingContainerRef, lassoContainerRef,
      paletteContainerRef, faceBBoxContainerRef, liquifyContainerRef,
      beforeLabelRef, afterLabelRef, compareDividerRef,
    },
    latestComparePercentRef,
    onCanvasRedrawRequest: handleCanvasRedrawRequest,
  });

  const { sourceImg, blendImg, backgroundMaskImg, customBackdropImg, portraitMasksRef } = useImageLoader({
    currentImageSrc: p.currentImageSrc,
    adjustments: p.adjustments,
  });

  const { zoomPercent, handleZoomIn, handleZoomOut, handleZoomReset, handleZoomToPercent, syncZoom } = useCanvasZoom({
    cropperRef: p.cropperRef,
    updateImageRect,
  });

  const { isCtrlPressed, isDragging } = useCtrlPan({
    cropperRef: p.cropperRef,
    containerRef,
    updateImageRect,
  });

  const { comparePercent, handleComparePointerDown, handleComparePointerMove, handleComparePointerUp } = useCompareSlider({
    containerRef,
    latestImageRectRef: { current: imageRect } as React.MutableRefObject<ImageRect | null>,
  });

  useCropperSetup({
    imgRef,
    containerRef,
    cropperRef: p.cropperRef,
    currentImageSrc: p.currentImageSrc,
    activeTool: p.activeTool,
    handleCropEvent: p.handleCropEvent,
    handleReady: p.handleReady,
    updateImageRect,
    syncZoom,
  });

  useEffectLatestComparePercent(comparePercent, latestComparePercentRef);

  // Effective image rect (with fallback when cropper hasn't reported yet)
  const effectiveImageRect: ImageRect | null = useMemo(() => {
    if (imageRect && imageRect.width > 0 && imageRect.height > 0) return imageRect;
    if (sourceImg && sourceImg.naturalWidth > 0 && sourceImg.naturalHeight > 0 && containerRef.current) {
      const cw = containerRef.current.clientWidth || window.innerWidth;
      const ch = containerRef.current.clientHeight || window.innerHeight;
      if (cw > 0 && ch > 0) {
        const scale = Math.min((cw * 0.95) / sourceImg.naturalWidth, (ch * 0.95) / sourceImg.naturalHeight);
        const w = Math.round(sourceImg.naturalWidth * scale);
        const h = Math.round(sourceImg.naturalHeight * scale);
        return { left: Math.round((cw - w) / 2), top: Math.round((ch - h) / 2), width: w, height: h };
      }
    }
    return null;
  }, [imageRect, sourceImg]);

  useEffectRedrawCanvas({
    activeTool: p.activeTool, sourceImg, blendImg, backgroundMaskImg, customBackdropImg,
    adjustments: p.adjustments, curvesTable: p.curvesTable, isDraggingSliderRef,
    portraitMasksRef, layers: p.adjustments.layers ?? null, canvasDrawKey,
    imageRect, effectiveImageRect, liveCanvasRef, onDrawn: () => setHasDrawnCanvas(true),
  });

  useEffectResetHasDrawn(p.currentImageSrc, setHasDrawnCanvas);

  // Disable annotations live update when not active
  const isAnnotationsActive = p.activeTool === 'annotations';
  const annotationsHaveContent = (p.annotations?.length ?? 0) > 0;
  const showAnnotations =
    !!effectiveImageRect &&
    Number.isFinite(effectiveImageRect.width) && effectiveImageRect.width > 0 &&
    Number.isFinite(effectiveImageRect.height) && effectiveImageRect.height > 0 &&
    !p.isComparing &&
    (isAnnotationsActive || (annotationsHaveContent && p.activeTool !== 'transform'));

  const showHealing =
    !!effectiveImageRect &&
    Number.isFinite(effectiveImageRect.width) && effectiveImageRect.width > 0 &&
    Number.isFinite(effectiveImageRect.height) && effectiveImageRect.height > 0 &&
    !p.isComparing &&
    p.activeTool !== 'transform';

  const showLiquify = showHealing; // same condition as healing for visibility

  const showLasso = p.activeTool === 'lasso' && !!effectiveImageRect && !!p.lassoState && !!p.onLassoStateChange;
  const showPalette = typeof p.palettePickingIndex === 'number' && !!effectiveImageRect && !!p.onPaletteColorPicked;
  const showFaceBBox =
    !!p.faces && p.faces.length > 0 &&
    !!effectiveImageRect &&
    !p.isComparing &&
    (p.activeTool === 'portrait' || p.activeTool === 'liquify' || p.activeTool === 'adjust');

  const effectiveFilter = p.isComparing ? 'none' : p.filterString;
  const isTransparentBg =
    p.adjustments.background?.enabled && p.adjustments.background?.backdrop === 'transparent';
  const vignetteOpacity = p.isComparing ? 0 : Math.min(0.9, Math.abs((p.adjustments.vignette || 0) / 100));
  const vignetteColor = (p.adjustments.vignette ?? 0) < 0 ? '0, 0, 0' : '255, 255, 255';
  const vignetteBlend = (p.adjustments.vignette ?? 0) < 0 ? 'multiply' : 'normal';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)] overflow-hidden">
      <div
        ref={containerRef}
        className={`flex-1 min-w-0 relative bg-[var(--bg-primary)] overflow-hidden ${
          p.activeTool !== 'transform' ? 'hide-crop-ui' : ''
        } ${
          (p.activeTool !== 'transform' && hasDrawnCanvas && !p.isComparing) ? 'hide-cropper-image' : ''
        } ${
          isCtrlPressed ? (isDragging ? 'ctrl-grabbing-active' : 'ctrl-grab-active') : ''
        }`}
        style={{
          '--cropper-filter': effectiveFilter,
          '--vignette-opacity': vignetteOpacity,
          '--vignette-color': vignetteColor,
          '--vignette-blend-mode': vignetteBlend,
        } as React.CSSProperties}
      >
        <img
          ref={imgRef}
          src={p.currentImageSrc}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', opacity: 0 }}
          crossOrigin="anonymous"
          className={p.adjustments.vignette !== 0 && !p.isComparing ? 'with-vignette' : ''}
        />

        {p.isComparing && effectiveImageRect && (
          <BeforeImageLayer
            rect={effectiveImageRect}
            src={p.currentImageSrc}
            adjustments={p.adjustments}
            beforeImageRef={beforeImageRef}
          />
        )}

        {p.activeTool !== 'transform' && effectiveImageRect && sourceImg && (
          <LivePreviewCanvas
            rect={effectiveImageRect}
            sourceWidth={sourceImg.naturalWidth}
            sourceHeight={sourceImg.naturalHeight}
            adjustments={p.adjustments}
            hasDrawn={hasDrawnCanvas}
            comparePercent={p.isComparing ? comparePercent : null}
            canvasRef={liveCanvasRef}
          />
        )}

        {showAnnotations && effectiveImageRect && (
          <AnnotationsOverlay
            rect={effectiveImageRect}
            containerRef={annotationsContainerRef}
            activeTool={p.activeTool as string}
            annotations={p.annotations ?? []}
            onAnnotationsChange={p.onAnnotationsChange ?? (() => {})}
            onStartGesture={p.onStartGesture}
            onEndGesture={p.onEndGesture}
            activeDrawTool={p.activeDrawTool ?? 'freehand'}
            setActiveDrawTool={p.setActiveDrawTool as ((t: DrawToolId) => void) | undefined}
            activeColor={p.activeColor ?? '#ef4444'}
            strokeWidth={p.strokeWidth ?? 4}
            eraserSize={p.eraserSize ?? 35}
            selectedAnnId={p.selectedAnnId ?? null}
            setSelectedAnnId={p.setSelectedAnnId as ((id: string | null) => void) | undefined}
            userChangedStyleRef={p.userChangedStyleRef ?? { current: false }}
            fontFamily={p.fontFamily}
            setFontFamily={p.setFontFamily}
            fontSize={p.fontSize}
            setFontSize={p.setFontSize}
            fontWeight={p.fontWeight}
            setWeight={p.setWeight}
            fontStyle={p.fontStyle}
            setStyle={p.setStyle}
            textDecoration={p.textDecoration}
            setDecoration={p.setDecoration}
            textAlign={p.textAlign}
            setTextAlign={p.setTextAlign}
            lineHeight={p.lineHeight}
            setLineHeight={p.setLineHeight}
            letterSpacing={p.letterSpacing}
            setLetterSpacing={p.setLetterSpacing}
            onUpdateTextProps={p.onUpdateTextProps}
            doodleText={p.doodleText}
            setDoodleText={p.setDoodleText}
            doodleFontSize={p.doodleFontSize}
            setDoodleFontSize={p.setDoodleFontSize}
            doodleFontFamily={p.doodleFontFamily}
            setDoodleFontFamily={p.setDoodleFontFamily}
            showDoodleGuide={p.showDoodleGuide}
            setShowDoodleGuide={p.setShowDoodleGuide}
            penSettings={p.penSettings}
          />
        )}

        {p.activeTool === 'inpaint' && effectiveImageRect && (
          <InpaintOverlay
            rect={effectiveImageRect}
            imageUrl={p.currentImageSrc}
            mode={p.inpaintMode ?? 'brush'}
            brushSize={p.brushSize ?? 50}
            brushHardness={p.brushHardness ?? 80}
            canvasRef={p.inpaintCanvasRef as React.Ref<InpaintCanvasHandle>}
            onMaskChange={p.onInpaintMaskChange ?? (() => {})}
            onStrokeComplete={p.onInpaintStrokeComplete}
            onInteractivePointsChange={p.onInteractivePointsChange}
            showMaskPreview={p.showMaskPreview ?? true}
            maskOpacity={p.maskOpacity ?? 60}
            containerRef={inpaintContainerRef}
          />
        )}

        {showHealing && effectiveImageRect && (
          <HealingOverlay
            rect={effectiveImageRect}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={p.currentImageSrc}
            settings={p.healingSettings}
            canvasRef={p.healingCanvasRef as React.Ref<HealingCanvasRef>}
            onStrokeComplete={p.onHealingStrokeComplete}
            readOnly={p.activeTool !== 'healing'}
            pointerActive={p.activeTool === 'healing' && !isCtrlPressed}
            containerRef={healingContainerRef}
          />
        )}

        {showLasso && effectiveImageRect && (
          <LassoOverlay
            rect={effectiveImageRect}
            imageSrc={p.currentImageSrc}
            state={p.lassoState!}
            onChange={p.onLassoStateChange!}
            onSelectionComplete={p.onLassoSelectionComplete}
            pointerActive={!isCtrlPressed}
            containerRef={lassoContainerRef}
          />
        )}

        {showPalette && effectiveImageRect && (
          <PaletteEyedropperOverlayHost
            rect={effectiveImageRect}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={p.currentImageSrc}
            targetSwatchIndex={p.palettePickingIndex!}
            onColorPicked={p.onPaletteColorPicked!}
            onCancel={p.onCancelPalettePicking ?? (() => {})}
            pointerActive={!isCtrlPressed}
            containerRef={paletteContainerRef}
          />
        )}

        {showFaceBBox && effectiveImageRect && (
          <FaceBBoxOverlayHost
            rect={effectiveImageRect}
            faces={p.faces!}
            naturalWidth={sourceImg?.naturalWidth || imgRef.current?.naturalWidth || effectiveImageRect.width}
            naturalHeight={sourceImg?.naturalHeight || imgRef.current?.naturalHeight || effectiveImageRect.height}
            selectedFaceIndex={p.selectedFaceIndex ?? null}
            onSelectFace={p.onSelectFace}
            showLandmarks={p.activeTool === 'liquify' || p.activeTool === 'portrait'}
            active={!isCtrlPressed && p.activeTool !== 'liquify'}
            containerRef={faceBBoxContainerRef}
          />
        )}

        {showLiquify && effectiveImageRect && (
          <LiquifyOverlay
            rect={effectiveImageRect}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={p.currentImageSrc}
            settings={p.liquifySettings}
            faces={p.faces}
            selectedFaceIndex={p.selectedFaceIndex ?? null}
            canvasRef={p.liquifyCanvasRef as React.Ref<LiquifyCanvasRef>}
            readOnly={p.activeTool !== 'liquify'}
            visible={p.activeTool === 'liquify'}
            pointerActive={p.activeTool === 'liquify' && !isCtrlPressed}
            containerRef={liquifyContainerRef}
          />
        )}

        <CanvasSavingOverlay visible={p.isSaving} />

        {p.isComparing && effectiveImageRect && (
          <CompareOverlay
            rect={effectiveImageRect}
            comparePercent={comparePercent}
            beforeLabelRef={beforeLabelRef}
            afterLabelRef={afterLabelRef}
            compareDividerRef={compareDividerRef}
            onPointerDown={handleComparePointerDown}
            onPointerMove={handleComparePointerMove}
            onPointerUp={handleComparePointerUp}
          />
        )}

        <CanvasFilters adjustments={p.adjustments} curvesTable={p.curvesTable} />

        <ZoomControlsHost
          visible={!p.isSaving}
          zoomPercent={zoomPercent}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleZoomReset}
          onZoomTo={handleZoomToPercent}
        />
      </div>
    </div>
  );
};

function useEffectLatestComparePercent(value: number, ref: React.MutableRefObject<number>) {
  useLayoutEffect(() => {
    ref.current = value;
  }, [value, ref]);
}

function useEffectResetHasDrawn(src: string, setHasDrawn: (b: boolean) => void) {
  useLayoutEffect(() => {
    setHasDrawn(false);
  }, [src, setHasDrawn]);
}

interface UseEffectRedrawParams {
  activeTool: ToolId | null;
  sourceImg: HTMLImageElement | null;
  blendImg: HTMLImageElement | null;
  backgroundMaskImg: HTMLImageElement | null;
  customBackdropImg: HTMLImageElement | null;
  adjustments: Adjustments;
  curvesTable: { r: string; g: string; b: string };
  isDraggingSliderRef: React.MutableRefObject<boolean>;
  portraitMasksRef: React.MutableRefObject<unknown>;
  layers: unknown;
  canvasDrawKey: number;
  imageRect: ImageRect | null;
  effectiveImageRect: ImageRect | null;
  liveCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onDrawn: () => void;
}

function useEffectRedrawCanvas(p: UseEffectRedrawParams) {
  useLayoutEffect(() => {
    const canvas = p.liveCanvasRef.current;
    if (!canvas || !p.sourceImg || p.activeTool === 'transform') return;
    drawFilteredImageToCanvas(
      canvas,
      p.sourceImg,
      p.blendImg,
      p.adjustments,
      p.curvesTable,
      p.isDraggingSliderRef.current,
      (p.portraitMasksRef.current as any) ?? undefined,
      p.backgroundMaskImg,
      p.customBackdropImg,
      (p.layers as any) ?? null,
    );
    p.onDrawn();
  }, [
    p.sourceImg, p.blendImg, p.backgroundMaskImg, p.customBackdropImg,
    p.adjustments, p.curvesTable, p.activeTool, p.canvasDrawKey,
    p.imageRect, p.effectiveImageRect, p.liveCanvasRef, p.isDraggingSliderRef,
    p.portraitMasksRef, p.layers, p.onDrawn,
  ]);
}

// Re-export so consumers (e.g. EditingMode) keep using the same import path.
export type { CanvasAreaProps } from '../CanvasArea.types';
