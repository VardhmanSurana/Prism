import React from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Loader2 } from 'lucide-react';
import { ToolId } from './Sidebar';
import { Adjustments, getStringHash, toFilterString } from './filterEngine';
import { isIdentityCurve } from './curves';
import { InpaintCanvas } from '@plugins/ai-vision-studio';
import type { InpaintMode } from '@plugins/ai-vision-studio';
import { ZoomControls } from './ZoomControls';
import { AnnotationCanvas } from '@plugins/retouch-metadata-studio';
import type { Annotation, DrawToolId } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { drawFilteredImageToCanvas } from './canvasDrawing';
import { HealingCanvas } from './HealingCanvas';
import { LassoCanvas } from './LassoCanvas';
import { PaletteEyedropperOverlay } from './PaletteEyedropperOverlay';
import { FaceBoundingBoxOverlay } from '@plugins/retouch-metadata-studio';
import { LiquifyCanvas } from './LiquifyCanvas';
import type { CanvasAreaProps } from './CanvasArea.types';

// Extracted custom hooks
import { useCanvasZoom } from './useCanvasZoom';
import { useCtrlPan } from './useCtrlPan';
import { useCompareSlider } from './useCompareSlider';
import { useImageLoader } from './useImageLoader';
import { useCropperSetup } from './useCropperSetup';

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  currentImageSrc,
  filterString,
  cropperRef,
  handleCropEvent,
  handleReady,
  activeTool,
  adjustments,
  isSaving,
  curvesTable,
  isComparing = false,
  inpaintMode = 'brush',
  inpaintCanvasRef,
  brushSize = 50,
  onInpaintMaskChange = (_mask: string): void => {},
  onInpaintStrokeComplete,
  onInteractivePointsChange,
  showMaskPreview = true,
  maskOpacity = 60,
  annotations = [],
  onAnnotationsChange = (_ann: Annotation[]): void => {},
  activeDrawTool = 'freehand',
  setActiveDrawTool,
  activeColor = '#ef4444',
  strokeWidth = 4,
  eraserSize = 35,
  selectedAnnId = null,
  setSelectedAnnId = (_id: string | null): void => {},
  userChangedStyleRef,
  onStartGesture,
  onEndGesture,

  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  fontWeight,
  setWeight,
  fontStyle,
  setStyle,
  textDecoration,
  setDecoration,
  textAlign,
  setTextAlign,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  onUpdateTextProps,
  doodleText,
  setDoodleText,
  doodleFontSize,
  setDoodleFontSize,
  doodleFontFamily,
  setDoodleFontFamily,
  showDoodleGuide,
  setShowDoodleGuide,
  penSettings,
  healingSettings,
  healingCanvasRef,
  onHealingStrokeComplete,
  lassoState,
  onLassoStateChange,
  onLassoSelectionComplete,
  palettePickingIndex,
  onPaletteColorPicked,
  onCancelPalettePicking,
  faces,
  selectedFaceIndex,
  onSelectFace,
  liquifySettings,
  liquifyCanvasRef,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [imageRect, setImageRect] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const latestImageRectRef = React.useRef(imageRect);
  React.useEffect(() => {
    latestImageRectRef.current = imageRect;
  }, [imageRect]);

  const [hasDrawnCanvas, setHasDrawnCanvas] = React.useState(false);

  React.useEffect(() => {
    setHasDrawnCanvas(false);
  }, [currentImageSrc]);

  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debouncing timers on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const isDraggingSliderRef = React.useRef(false);

  React.useEffect(() => {
    const handleStartDrag = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range')) {
        isDraggingSliderRef.current = true;
      }
    };

    const handleEndDrag = () => {
      if (isDraggingSliderRef.current) {
        isDraggingSliderRef.current = false;
        // Trigger high-quality redraw when slider drag finishes
        setCanvasDrawKey(k => k + 1);
      }
    };

    window.addEventListener('mousedown', handleStartDrag, { passive: true });
    window.addEventListener('touchstart', handleStartDrag, { passive: true });
    window.addEventListener('mouseup', handleEndDrag, { passive: true });
    window.addEventListener('touchend', handleEndDrag, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleStartDrag);
      window.removeEventListener('touchstart', handleStartDrag);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, []);

  // Overlay container refs
  const liveCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const beforeImageRef = React.useRef<HTMLImageElement | null>(null);
  const annotationsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inpaintContainerRef = React.useRef<HTMLDivElement | null>(null);
  const healingContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lassoContainerRef = React.useRef<HTMLDivElement | null>(null);
  const paletteContainerRef = React.useRef<HTMLDivElement | null>(null);
  const faceBBoxContainerRef = React.useRef<HTMLDivElement | null>(null);
  const liquifyContainerRef = React.useRef<HTMLDivElement | null>(null);
  const beforeLabelRef = React.useRef<HTMLDivElement | null>(null);
  const afterLabelRef = React.useRef<HTMLDivElement | null>(null);
  const compareDividerRef = React.useRef<HTMLDivElement | null>(null);
  const latestComparePercentRef = React.useRef<number>(50);

  // ── Extracted hooks ────────────────────────────────────────────────────────

  const updateImageRect = React.useCallback(() => {
    const cropper = cropperRef.current;
    if (cropper) {
      const canvasData = cropper.getCanvasData();

      // Update DOM styles directly for sub-millisecond, zero-lag synchronized visual movement
      const elementsToSync = [
        liveCanvasRef.current,
        beforeImageRef.current,
        annotationsContainerRef.current,
        inpaintContainerRef.current,
        healingContainerRef.current,
        lassoContainerRef.current,
        paletteContainerRef.current,
        faceBBoxContainerRef.current,
        liquifyContainerRef.current,
      ];

      for (const el of elementsToSync) {
        if (el) {
          el.style.left = `${canvasData.left}px`;
          el.style.top = `${canvasData.top}px`;
          el.style.width = `${canvasData.width}px`;
          el.style.height = `${canvasData.height}px`;
        }
      }

      // Synchronize Before/After labels and compare divider line in zero-lag lockstep
      if (beforeLabelRef.current) {
        beforeLabelRef.current.style.left = `${canvasData.left + 16}px`;
        beforeLabelRef.current.style.top = `${canvasData.top + 16}px`;
      }
      if (afterLabelRef.current) {
        afterLabelRef.current.style.left = `${canvasData.left + canvasData.width - 64}px`;
        afterLabelRef.current.style.top = `${canvasData.top + 16}px`;
      }
      if (compareDividerRef.current) {
        const pct = latestComparePercentRef.current ?? 50;
        compareDividerRef.current.style.left = `${canvasData.left + (pct / 100) * canvasData.width}px`;
        compareDividerRef.current.style.top = `${canvasData.top}px`;
        compareDividerRef.current.style.height = `${canvasData.height}px`;
      }

      const prev = latestImageRectRef.current;
      if (!prev) {
        // First mount: set immediately to run first canvas draw
        setImageRect({
          left: canvasData.left,
          top: canvasData.top,
          width: canvasData.width,
          height: canvasData.height,
        });
        setTimeout(() => setCanvasDrawKey(k => k + 1), 0);
      } else if (
        prev.left !== canvasData.left ||
        prev.top !== canvasData.top ||
        prev.width !== canvasData.width ||
        prev.height !== canvasData.height
      ) {
        // Sub-sequent updates: debounce to avoid heavy tree re-renders
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          setImageRect({
            left: canvasData.left,
            top: canvasData.top,
            width: canvasData.width,
            height: canvasData.height,
          });
        }, 100);
      }
    }
  }, [cropperRef]);

  const { sourceImg, blendImg, backgroundMaskImg, customBackdropImg, portraitMasksRef, canvasDrawKey, setCanvasDrawKey } = useImageLoader({
    currentImageSrc,
    adjustments,
  });

  const { zoomPercent, handleZoomIn, handleZoomOut, handleZoomReset, handleZoomToPercent, syncZoom } = useCanvasZoom({
    cropperRef,
    updateImageRect,
  });

  const { isCtrlPressed, isDragging } = useCtrlPan({
    cropperRef,
    containerRef,
    updateImageRect,
  });

  const { comparePercent, handleComparePointerDown, handleComparePointerMove, handleComparePointerUp } = useCompareSlider({
    containerRef,
    latestImageRectRef,
  });

  React.useEffect(() => {
    latestComparePercentRef.current = comparePercent;
  }, [comparePercent]);

  useCropperSetup({
    imgRef,
    containerRef,
    cropperRef,
    currentImageSrc,
    activeTool,
    handleCropEvent,
    handleReady,
    updateImageRect,
    syncZoom,
  });

  // ── Canvas draw effect ─────────────────────────────────────────────────────

  React.useLayoutEffect(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas || !sourceImg || activeTool === 'transform') return;

    drawFilteredImageToCanvas(
      canvas,
      sourceImg,
      blendImg,
      adjustments,
      curvesTable,
      isDraggingSliderRef.current,
      portraitMasksRef.current ?? undefined,
      backgroundMaskImg,
      customBackdropImg,
    );

    setHasDrawnCanvas(true);
  }, [
    sourceImg,
    blendImg,
    backgroundMaskImg,
    customBackdropImg,
    adjustments,
    filterString,
    activeTool,
    isComparing,
    curvesTable,
    canvasDrawKey,
    imageRect,
  ]);

  const handleMaskChange = React.useCallback((maskDataUrl: string) => {
    onInpaintMaskChange(maskDataUrl);
  }, [onInpaintMaskChange]);

  // The effective filter: blank when comparing so user sees original
  const effectiveFilter = isComparing ? 'none' : filterString;

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)] overflow-hidden">
      <div
        ref={containerRef}
        className={`flex-1 min-w-0 relative bg-[var(--bg-primary)] overflow-hidden ${
          activeTool !== 'transform' ? 'hide-crop-ui' : ''
        } ${
          (activeTool !== 'transform' && hasDrawnCanvas && !isComparing) ? 'hide-cropper-image' : ''
        } ${
          isCtrlPressed ? (isDragging ? 'ctrl-grabbing-active' : 'ctrl-grab-active') : ''
        }`}
        style={{
          '--cropper-filter': effectiveFilter,
          '--vignette-opacity': isComparing ? 0 : Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100)),
          '--vignette-color': adjustments.vignette < 0 ? '0, 0, 0' : '255, 255, 255',
          '--vignette-blend-mode': adjustments.vignette < 0 ? 'multiply' : 'normal',
        } as React.CSSProperties}
      >
      
      <img
        ref={imgRef}
        src={currentImageSrc}
        alt=""
        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', opacity: 0 }}
        crossOrigin="anonymous"
        className={adjustments.vignette !== 0 && !isComparing ? 'with-vignette' : ''}
      />

      {/* ── Base Before Original Image Layer (Visible during Split Compare) ── */}
      {isComparing && imageRect && (
        <img
          ref={beforeImageRef}
          src={currentImageSrc}
          alt="Original"
          className="absolute pointer-events-none z-0 object-contain select-none"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            transform: (adjustments.perspective !== 0 || adjustments.verticalPerspective !== 0)
              ? `perspective(1000px) rotateY(${adjustments.perspective * 0.3}deg) rotateX(${adjustments.verticalPerspective * 0.3}deg)`
              : undefined,
          }}
          crossOrigin="anonymous"
        />
      )}

      {/* ── Live Preview Canvas Overlay ── */}
      {activeTool !== 'transform' && imageRect && sourceImg !== null && (
        <canvas
          ref={liveCanvasRef}
          width={sourceImg.naturalWidth || 1}
          height={sourceImg.naturalHeight || 1}
          className="absolute pointer-events-none z-10"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            opacity: hasDrawnCanvas ? 1 : 0,
            transform: (adjustments.perspective !== 0 || adjustments.verticalPerspective !== 0)
              ? `perspective(1000px) rotateY(${adjustments.perspective * 0.3}deg) rotateX(${adjustments.verticalPerspective * 0.3}deg)`
              : undefined,
            clipPath: isComparing 
              ? `polygon(${comparePercent}% 0, 100% 0, 100% 100%, ${comparePercent}% 100%)` 
              : undefined,
          }}
        />
      )}

      {/* ── Annotations Overlay (Preserved across tab switches to prevent unmounting issues) ── */}
      {imageRect && Number.isFinite(imageRect.width) && imageRect.width > 0 && Number.isFinite(imageRect.height) && imageRect.height > 0 && !isComparing && (activeTool === 'annotations' || (annotations && annotations.length > 0 && activeTool !== 'transform')) && (
        <div
          ref={annotationsContainerRef}
          className={`absolute ${activeTool === 'annotations' ? '' : 'pointer-events-none'}`}
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: activeTool === 'annotations' ? 'auto' : 'none',
            zIndex: activeTool === 'annotations' ? 30 : 20,
          }}
        >
          <AnnotationCanvas
            annotations={annotations}
            onChange={activeTool === 'annotations' ? onAnnotationsChange : () => {}}
            onStartGesture={activeTool === 'annotations' ? onStartGesture : undefined}
            onEndGesture={activeTool === 'annotations' ? onEndGesture : undefined}
            activeDrawTool={activeTool === 'annotations' ? activeDrawTool : 'freehand'}
            setActiveDrawTool={activeTool === 'annotations' ? setActiveDrawTool : undefined}
            activeColor={activeTool === 'annotations' ? activeColor : ''}
            strokeWidth={activeTool === 'annotations' ? strokeWidth : 1}
            eraserSize={activeTool === 'annotations' ? eraserSize : 35}
            readOnly={activeTool !== 'annotations'}
            selectedAnnId={activeTool === 'annotations' ? selectedAnnId : null}
            setSelectedAnnId={activeTool === 'annotations' ? setSelectedAnnId : undefined}
            userChangedStyleRef={activeTool === 'annotations' ? userChangedStyleRef : undefined}

            fontFamily={activeTool === 'annotations' ? fontFamily : undefined}
            setFontFamily={activeTool === 'annotations' ? setFontFamily : undefined}
            fontSize={activeTool === 'annotations' ? fontSize : undefined}
            setFontSize={activeTool === 'annotations' ? setFontSize : undefined}
            fontWeight={activeTool === 'annotations' ? fontWeight : undefined}
            setWeight={activeTool === 'annotations' ? setWeight : undefined}
            fontStyle={activeTool === 'annotations' ? fontStyle : undefined}
            setStyle={activeTool === 'annotations' ? setStyle : undefined}
            textDecoration={activeTool === 'annotations' ? textDecoration : undefined}
            setDecoration={activeTool === 'annotations' ? setDecoration : undefined}
            textAlign={activeTool === 'annotations' ? textAlign : undefined}
            setTextAlign={activeTool === 'annotations' ? setTextAlign : undefined}
            lineHeight={activeTool === 'annotations' ? lineHeight : undefined}
            setLineHeight={activeTool === 'annotations' ? setLineHeight : undefined}
            letterSpacing={activeTool === 'annotations' ? letterSpacing : undefined}
            setLetterSpacing={activeTool === 'annotations' ? setLetterSpacing : undefined}
            onUpdateTextProps={activeTool === 'annotations' ? onUpdateTextProps : undefined}

            doodleText={activeTool === 'annotations' ? doodleText : undefined}
            setDoodleText={activeTool === 'annotations' ? setDoodleText : undefined}
            doodleFontSize={activeTool === 'annotations' ? doodleFontSize : undefined}
            setDoodleFontSize={activeTool === 'annotations' ? setDoodleFontSize : undefined}
            doodleFontFamily={activeTool === 'annotations' ? doodleFontFamily : undefined}
            setDoodleFontFamily={activeTool === 'annotations' ? setDoodleFontFamily : undefined}
            showDoodleGuide={activeTool === 'annotations' ? showDoodleGuide : undefined}
            setShowDoodleGuide={activeTool === 'annotations' ? setShowDoodleGuide : undefined}
            penSettings={activeTool === 'annotations' ? penSettings : undefined}
          />
        </div>
      )}

      {/* Inpaint Canvas Overlay */}
      {activeTool === 'inpaint' && imageRect && (
        <>
          <div 
            ref={inpaintContainerRef}
            className="absolute z-20"
            style={{
              left: imageRect.left,
              top: imageRect.top,
              width: imageRect.width,
              height: imageRect.height,
              pointerEvents: 'auto',
            }}
          >
            <InpaintCanvas
              ref={inpaintCanvasRef}
              imageUrl={currentImageSrc}
              mode={inpaintMode}
              brushSize={brushSize}
              onMaskChange={handleMaskChange}
              onStrokeComplete={onInpaintStrokeComplete}
              onInteractivePointsChange={onInteractivePointsChange}
              showMaskPreview={showMaskPreview}
              maskOpacity={maskOpacity}
            />
          </div>
        </>
      )}

      {/* ── Healing Brush / Clone Stamp overlay (Preserved across tool switches to prevent disappearing strokes/unmounting) ── */}
      {imageRect && Number.isFinite(imageRect.width) && imageRect.width > 0 && Number.isFinite(imageRect.height) && imageRect.height > 0 && !isComparing && activeTool !== 'transform' && (
        <div
          ref={healingContainerRef}
          className={`absolute z-20 ${activeTool === 'healing' && !isCtrlPressed ? '' : 'pointer-events-none'}`}
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: activeTool === 'healing' && !isCtrlPressed ? 'auto' : 'none',
          }}
        >
          <HealingCanvas
            ref={healingCanvasRef}
            width={Math.round(imageRect.width)}
            height={Math.round(imageRect.height)}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={currentImageSrc}
            mode={healingSettings?.mode || 'clone-stamp'}
            brushSize={healingSettings?.brushSize || 30}
            hardness={healingSettings?.hardness || 50}
            opacity={healingSettings?.opacity || 100}
            onStrokeComplete={onHealingStrokeComplete}
            readOnly={activeTool !== 'healing'}
          />
        </div>
      )}

      {/* ── Lasso & Intelligent Scissors Selection Overlay ── */}
      {activeTool === 'lasso' && imageRect && lassoState && onLassoStateChange && (
        <div
          ref={lassoContainerRef}
          className="absolute z-20"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: isCtrlPressed ? 'none' : 'auto',
          }}
        >
          <LassoCanvas
            width={Math.round(imageRect.width)}
            height={Math.round(imageRect.height)}
            imageSrc={currentImageSrc}
            state={lassoState}
            onChange={onLassoStateChange}
            onSelectionComplete={onLassoSelectionComplete}
          />
        </div>
      )}

      {/* ── In-Canvas Loupe Eyedropper Overlay for Palette Sampling ── */}
      {typeof palettePickingIndex === 'number' && imageRect && onPaletteColorPicked && (
        <div
          ref={paletteContainerRef}
          className="absolute z-30"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: isCtrlPressed ? 'none' : 'auto',
          }}
        >
          <PaletteEyedropperOverlay
            width={Math.round(imageRect.width)}
            height={Math.round(imageRect.height)}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={currentImageSrc}
            targetSwatchIndex={palettePickingIndex}
            onColorPicked={onPaletteColorPicked}
            onCancel={onCancelPalettePicking || (() => {})}
          />
        </div>
      )}

      {/* ── Face Bounding Box & Landmark Overlay (Portrait / Liquify / Face Tools) ── */}
      {faces && faces.length > 0 && imageRect && !isComparing && (activeTool === 'portrait' || activeTool === 'liquify' || activeTool === 'adjust') && (
        <div
          ref={faceBBoxContainerRef}
          className="absolute z-20 pointer-events-none"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: 'none',
          }}
        >
          <FaceBoundingBoxOverlay
            faces={faces}
            naturalWidth={sourceImg?.naturalWidth || imgRef.current?.naturalWidth || imageRect.width}
            naturalHeight={sourceImg?.naturalHeight || imgRef.current?.naturalHeight || imageRect.height}
            containerWidth={Math.round(imageRect.width)}
            containerHeight={Math.round(imageRect.height)}
            selectedFaceIndex={selectedFaceIndex}
            onSelectFace={onSelectFace}
            showLandmarks={activeTool === 'liquify' || activeTool === 'portrait'}
            active={!isCtrlPressed && activeTool !== 'liquify'}
          />
        </div>
      )}

      {/* ── Liquify & Reshape Mesh Canvas Overlay (Preserved across tool switches) ── */}
      {imageRect && Number.isFinite(imageRect.width) && imageRect.width > 0 && Number.isFinite(imageRect.height) && imageRect.height > 0 && !isComparing && activeTool !== 'transform' && (
        <div
          ref={liquifyContainerRef}
          className={`absolute z-30 ${activeTool === 'liquify' && !isCtrlPressed ? '' : 'pointer-events-none hidden'}`}
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: activeTool === 'liquify' && !isCtrlPressed ? 'auto' : 'none',
            display: activeTool === 'liquify' ? 'block' : 'none',
            zIndex: 30,
          }}
        >
          <LiquifyCanvas
            ref={liquifyCanvasRef}
            width={Math.round(imageRect.width)}
            height={Math.round(imageRect.height)}
            sourceImage={sourceImg || imgRef.current}
            imageSrc={currentImageSrc}
            settings={liquifySettings}
            faces={faces}
            selectedFaceIndex={selectedFaceIndex}
            readOnly={activeTool !== 'liquify'}
          />
        </div>
      )}

      {isSaving && (
        <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-sm font-medium tracking-wide uppercase">Applying Edits…</p>
        </div>
      )}

      {/* Before/After split comparison slider and labels */}
      {isComparing && imageRect && (
        <>
          <div 
            ref={beforeLabelRef}
            className="absolute z-20 pointer-events-none px-2.5 py-1 rounded bg-[#0D0F14]/75 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-white/50"
            style={{
              left: imageRect.left + 16,
              top: imageRect.top + 16,
            }}
          >
            Before
          </div>
          <div 
            ref={afterLabelRef}
            className="absolute z-20 pointer-events-none px-2.5 py-1 rounded bg-primary/25 border border-primary/35 text-[9px] font-bold uppercase tracking-wider text-primary shadow-[0_2px_12px_rgba(var(--color-primary),0.15)]"
            style={{
              left: imageRect.left + imageRect.width - 64,
              top: imageRect.top + 16,
            }}
          >
            After
          </div>

          <div
            ref={compareDividerRef}
            className="absolute z-30 select-none cursor-ew-resize flex flex-col items-center justify-center touch-none"
            style={{
              left: imageRect.left + (comparePercent / 100) * imageRect.width,
              top: imageRect.top,
              height: imageRect.height,
              width: 40,
              transform: 'translateX(-50%)',
            }}
            onPointerDown={handleComparePointerDown}
            onPointerMove={handleComparePointerMove}
            onPointerUp={handleComparePointerUp}
          >
            <div className="w-[2px] h-full bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" />
            <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0D0F14] border-2 border-primary flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
              <span className="text-[10px] font-bold text-primary select-none">↔</span>
            </div>
          </div>
        </>
      )}



      {/* ── Hidden SVG filters ── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
        <defs>

          {!isIdentityCurve(adjustments.curves) && (
            <filter id={`curves-filter-${getStringHash(JSON.stringify(adjustments.curves))}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues={curvesTable.r} />
                <feFuncG type="table" tableValues={curvesTable.g} />
                <feFuncB type="table" tableValues={curvesTable.b} />
              </feComponentTransfer>
            </filter>
          )}

          {adjustments.sharpness > 0 && (
            <filter id="sharpness-filter" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
              <feComposite 
                in="SourceGraphic" 
                in2="blur" 
                operator="arithmetic" 
                k2={((): number => {
                  // USM Formula: Original + Amount * (Original - Blur)
                  const amount = (adjustments.sharpness / 100) * 2.5;
                  return 1 + amount;
                })()}
                k3={((): number => {
                  const amount = (adjustments.sharpness / 100) * 2.5;
                  return -amount;
                })()}
              />
            </filter>
          )}

          <radialGradient id="vignette-mask" r="65%" cx="50%" cy="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity={Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100))} />
          </radialGradient>
        </defs>
      </svg>

      {/* Floating In-Canvas Zoom Controls HUD */}
      {!isSaving && (
        <ZoomControls
          zoomPercent={zoomPercent}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleZoomReset}
          onZoomTo={handleZoomToPercent}
          minZoom={10}
          maxZoom={500}
        />
      )}
      </div>
    </div>
  );
};
