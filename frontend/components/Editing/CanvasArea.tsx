import React from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { Check, Loader2 } from 'lucide-react';
import { ToolId } from './Sidebar';
import { Adjustments, getStringHash, HslBand, toFilterString } from './filterEngine';
import { DEFAULT_CURVE, isIdentityCurve } from './curves';
import { InpaintCanvas } from './InpaintCanvas';
import { InpaintMode } from './InpaintPanel';
import { ZoomControls } from './ZoomControls';
import { AnnotationCanvas } from './AnnotationCanvas';
import { Annotation, DrawToolId } from './AnnotationsPanel';
import { applyHslToImageData } from './hslEngine';
import {
  applySplitToning,
  applyGrain,
  applyLightLeak,
  applyTiltShift,
  applyVignette,
  drawBlendOverlay,
  applyUnsharpMask,
  applyCurveLutsToCanvas,
  applyBlur,
} from './exportPipeline';
import { isCtxFilterSupported, applyBaseFiltersToImageData, applyNonLinearHighlightsAndShadows } from './filterFallback';

interface CanvasAreaProps {
  currentImageSrc: string;
  filterString: string;
  cropperRef: React.RefObject<ReactCropperElement>;
  handleCropEvent: () => void;
  handleReady: () => void;
  hasCropSelection: boolean;
  activeTool: ToolId | null;
  handleApplyCrop: () => void;
  adjustments: Adjustments;
  isSaving: boolean;
  curvesTable: { r: string; g: string; b: string };
  isComparing?: boolean;

  // Inpaint props
  inpaintMode?: InpaintMode;
  brushSize?: number;
  brushHardness?: number;
  onInpaintMaskChange?: (maskDataUrl: string) => void;
  showMaskPreview?: boolean;
  maskOpacity?: number;

  // Annotations props
  annotations?: Annotation[];
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  activeDrawTool?: DrawToolId;
  setActiveDrawTool?: (tool: DrawToolId) => void;
  activeColor?: string;
  strokeWidth?: number;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  userChangedStyleRef?: React.MutableRefObject<boolean>;

  // Text layer settings
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  fontSize?: number;
  setFontSize?: (size: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (w: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (s: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (val: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (val: number) => void;
  onUpdateTextProps?: (updatedProps: Partial<Annotation>) => void;

  // Text doodle settings
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  currentImageSrc,
  filterString,
  cropperRef,
  handleCropEvent,
  handleReady,
  hasCropSelection,
  activeTool,
  handleApplyCrop,
  adjustments,
  isSaving,
  curvesTable,
  isComparing = false,
  inpaintMode = 'brush',
  brushSize = 50,
  brushHardness = 80,
  onInpaintMaskChange = (_mask: string): void => {},
  showMaskPreview = true,
  maskOpacity = 60,
  annotations = [],
  onAnnotationsChange = (_ann: Annotation[]): void => {},
  activeDrawTool = 'freehand',
  setActiveDrawTool,
  activeColor = '#ef4444',
  strokeWidth = 4,
  selectedAnnId = null,
  setSelectedAnnId = (_id: string | null): void => {},
  userChangedStyleRef,

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
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [currentMask, setCurrentMask] = React.useState<string | null>(null);
  const [imageRect, setImageRect] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [zoomPercent, setZoomPercent] = React.useState(100);

  const [sourceImg, setSourceImg] = React.useState<HTMLImageElement | null>(null);
  const [blendImg, setBlendImg] = React.useState<HTMLImageElement | null>(null);
  // canvasDrawKey bumps whenever imageRect changes so the draw effect re-runs
  // even when no other dep changed (e.g. first mount after imageRect is set).
  const [canvasDrawKey, setCanvasDrawKey] = React.useState(0);
  const liveCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (!currentImageSrc) {
      setSourceImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setSourceImg(img);
    };
    img.onerror = () => {
      if (active) setSourceImg(null);
    };
    img.src = currentImageSrc;
    return () => {
      active = false;
    };
  }, [currentImageSrc]);

  React.useEffect(() => {
    const src = adjustments.blend?.blendImageSrc;
    if (!src) {
      setBlendImg(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (active) setBlendImg(img);
    };
    img.onerror = () => {
      if (active) setBlendImg(null);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [adjustments.blend?.blendImageSrc]);

  React.useEffect(() => {
    if (activeTool !== 'annotations') {
      setIsCtrlPressed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
          cropper.setDragMode('move');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
          cropper.setDragMode('none');
        }
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
      const cropper = cropperRef.current?.cropper;
      if (cropper) {
        cropper.setDragMode('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeTool, cropperRef]);

  React.useEffect(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas || !sourceImg || activeTool === 'transform') return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 1. Calculate internal resolution (max bounding size of 1000px for speed)
    const maxDim = 1000;
    let drawW = sourceImg.naturalWidth;
    let drawH = sourceImg.naturalHeight;
    if (drawW > maxDim || drawH > maxDim) {
      if (drawW > drawH) {
        drawH = Math.round((drawH * maxDim) / drawW);
        drawW = maxDim;
      } else {
        drawW = Math.round((drawW * maxDim) / drawH);
        drawH = maxDim;
      }
    }

    if (canvas.width !== drawW || canvas.height !== drawH) {
      canvas.width = drawW;
      canvas.height = drawH;
    }

    ctx.clearRect(0, 0, drawW, drawH);

    // 2. Build a canvas-safe filter string with guarded adjustments.
    const noise = adjustments.noiseReduction || 0;
    const sharp = adjustments.sharpness || 0;
    const effectiveNoise = Math.max(0, noise - sharp * 0.5);
    const effectiveSharp = sharp > 0 ? Math.max(0, sharp - noise * 0.5) : sharp;

    const effectiveAdj = {
      ...adjustments,
      noiseReduction: effectiveNoise,
      sharpness: effectiveSharp,
    };

    const localFilterString = isComparing ? 'none' : toFilterString(effectiveAdj);
    const canvasSafeFilter = localFilterString
      .replace(/url\([^)]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'none';

    // 3. Draw base image with CSS filters.
    //    Use a FRESH temporary canvas (no willReadFrequently) for the filter draw.
    //    Chrome silently ignores ctx.filter on willReadFrequently canvases in
    //    software-rendering mode — a fresh canvas always uses the GPU path.
    if (isComparing || canvasSafeFilter === 'none') {
      ctx.drawImage(sourceImg, 0, 0, drawW, drawH);
    } else if (isCtxFilterSupported()) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = drawW;
      tempCanvas.height = drawH;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.filter = canvasSafeFilter;
      tempCtx.drawImage(sourceImg, 0, 0, drawW, drawH);
      tempCtx.filter = 'none';
      ctx.drawImage(tempCanvas, 0, 0);
    } else {
      ctx.drawImage(sourceImg, 0, 0, drawW, drawH);
      const imgData = ctx.getImageData(0, 0, drawW, drawH);
      applyBaseFiltersToImageData(imgData, effectiveAdj);
      ctx.putImageData(imgData, 0, 0);
    }

    if (isComparing) {
      return; // Show original only — skip all effects
    }

    // 3.5. Apply Non-linear Highlights and Shadows
    if (adjustments.highlights !== 0 || adjustments.shadows !== 0) {
      const imgData = ctx.getImageData(0, 0, drawW, drawH);
      applyNonLinearHighlightsAndShadows(imgData, adjustments.highlights, adjustments.shadows);
      ctx.putImageData(imgData, 0, 0);
    }

    // 4. Noise reduction — strip was already included in canvasSafeFilter as blur().
    //    If sharpness is negative (soften), apply extra blur that matches the export.
    if (effectiveSharp < 0) {
      const softenBlur = Math.abs(effectiveSharp) / 100 * 1.5;
      applyBlur(canvas, softenBlur);
    }

    // 5. Sharpness — unsharp-mask (replaces the SVG url(#sharpness-filter) we stripped)
    if (effectiveSharp > 0) {
      applyUnsharpMask(canvas, effectiveSharp, 1.2, 2.5);
    }

    // 6. Curves — LUT pixel pass (replaces url(#curves-filter-HASH) we stripped)
    applyCurveLutsToCanvas(canvas, adjustments);

    // 7. HSL Color Mixer — per-band pixel shifts
    if (adjustments.hsl) {
      const activeBands = (Object.keys(adjustments.hsl) as HslBand[]).filter(band => {
        const b = adjustments.hsl![band];
        return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
      });
      if (activeBands.length > 0) {
        const imgData = ctx.getImageData(0, 0, drawW, drawH);
        applyHslToImageData(imgData, adjustments.hsl);
        ctx.putImageData(imgData, 0, 0);
      }
    }

    // 8. Split Toning
    applySplitToning(canvas, adjustments);

    // 9. Film Grain
    applyGrain(canvas, adjustments);

    // 10. Light Leaks
    applyLightLeak(canvas, adjustments);

    // 11. Double Exposure (synchronous — blendImg already pre-loaded)
    if (adjustments.blend && blendImg) {
      drawBlendOverlay(canvas, blendImg, adjustments.blend);
    }

    // 12. Tilt-Shift depth blur
    applyTiltShift(canvas, adjustments);

    // 13. Vignette
    applyVignette(canvas, adjustments.vignette);

    // 14. Frame border preview — simplified in-bounds rendering
    //     (Export expands canvas dimensions; here we draw borders over image edges)
    const frame = adjustments.frame;
    if (frame && frame.style !== 'none') {
      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        ctx2.save();
        const w = canvas.width;
        const h = canvas.height;
        // Scale thickness to canvas size (matches export formula)
        const border = Math.max(w, h) * (frame.thickness / 100) * 0.6;

        if (frame.style === 'polaroid') {
          // Cream-white borders: equal sides, thick bottom
          ctx2.fillStyle = '#f8f8f6';
          ctx2.fillRect(0, 0, w, border);               // top
          ctx2.fillRect(0, h - border * 3.5, w, border * 3.5); // thick bottom
          ctx2.fillRect(0, 0, border, h);               // left
          ctx2.fillRect(w - border, 0, border, h);      // right
        } else if (frame.style === 'matte') {
          ctx2.fillStyle = frame.color;
          ctx2.fillRect(0, 0, w, border);
          ctx2.fillRect(0, h - border, w, border);
          ctx2.fillRect(0, 0, border, h);
          ctx2.fillRect(w - border, 0, border, h);
        } else if (frame.style === 'filmstrip') {
          const barH = Math.round(h * 0.12);
          ctx2.fillStyle = '#080808';
          ctx2.fillRect(0, 0, w, barH);
          ctx2.fillRect(0, h - barH, w, barH);
          // Sprocket holes
          const spW = Math.max(8, w * 0.018);
          const spH = barH * 0.45;
          const gap = spW * 1.5;
          ctx2.fillStyle = '#1c1c1c';
          for (let x = gap / 2; x < w; x += spW + gap) {
            ctx2.beginPath();
            ctx2.roundRect(x, barH * 0.25, spW, spH, 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.roundRect(x, h - barH * 0.7, spW, spH, 2);
            ctx2.fill();
          }
        } else if (frame.style === 'rounded') {
          const r = Math.min(w, h) * 0.05;
          ctx2.globalCompositeOperation = 'destination-in';
          ctx2.beginPath();
          ctx2.roundRect(0, 0, w, h, r);
          ctx2.fill();
        } else if (frame.style === 'thinline') {
          ctx2.strokeStyle = frame.color;
          ctx2.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
          ctx2.strokeRect(0, 0, w, h);
        } else if (frame.style === 'shadowbox') {
          // Floating shadow effect — dark vignette border
          const grad = ctx2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.65);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.45)');
          ctx2.globalCompositeOperation = 'source-over';
          ctx2.fillStyle = grad;
          ctx2.fillRect(0, 0, w, h);
        }
        ctx2.restore();
      }
    }
  }, [
    sourceImg,
    blendImg,
    adjustments,
    filterString,
    activeTool,
    isComparing,
    curvesTable,
    canvasDrawKey,
  ]);

  const updateImageRect = React.useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const canvasData = cropper.getCanvasData();
      // Only update if dimensions actually changed to avoid loop.
      // When the rect changes (including first set), bump canvasDrawKey so the
      // draw effect re-runs even if no other dep changed.
      setImageRect(prev => {
        if (prev && 
            prev.left === canvasData.left && 
            prev.top === canvasData.top && 
            prev.width === canvasData.width && 
            prev.height === canvasData.height) {
          return prev;
        }
        // Bump the draw key on next tick so the canvas has been committed to
        // the DOM before we try to draw into it.
        setTimeout(() => setCanvasDrawKey(k => k + 1), 0);
        return {
          left: canvasData.left,
          top: canvasData.top,
          width: canvasData.width,
          height: canvasData.height,
        };
      });
    }
  }, [cropperRef]);

  const handleMaskChange = React.useCallback((maskDataUrl: string) => {
    setCurrentMask(maskDataUrl);
    onInpaintMaskChange(maskDataUrl);
  }, [onInpaintMaskChange]);

  // ── Zoom helpers ────────────────────────────────────────────────────────
  const syncZoom = React.useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    try {
      const imageData  = cropper.getImageData();
      const canvasData = cropper.getCanvasData();
      if (imageData.naturalWidth > 0) {
        const pct = (canvasData.width / imageData.naturalWidth) * 100;
        setZoomPercent(Math.round(pct));
      }
    } catch { /* cropper not ready */ }
  }, [cropperRef]);

  const handleZoomIn = React.useCallback(() => {
    cropperRef.current?.cropper.zoom(0.1);
    setTimeout(() => { syncZoom(); updateImageRect(); }, 80);
  }, [cropperRef, syncZoom, updateImageRect]);

  const handleZoomOut = React.useCallback(() => {
    cropperRef.current?.cropper.zoom(-0.1);
    setTimeout(() => { syncZoom(); updateImageRect(); }, 80);
  }, [cropperRef, syncZoom, updateImageRect]);

  const handleZoomReset = React.useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const containerData = cropper.getContainerData();
    const imageData     = cropper.getImageData();
    const scale = Math.min(
      (containerData.width  * 0.80) / imageData.naturalWidth,
      (containerData.height * 0.80) / imageData.naturalHeight,
    );
    cropper.zoomTo(scale);
    setTimeout(() => { syncZoom(); updateImageRect(); }, 80);
  }, [cropperRef, syncZoom, updateImageRect]);
  // ──────────────────────────────────────────────────────────────────────

  const onCropperReady = React.useCallback(() => {
    handleReady();
    updateImageRect();
    syncZoom();
  }, [handleReady, updateImageRect, syncZoom]);

  // Sync rect on container resize
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      // Small delay to allow cropperjs to finish its internal update
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
          // Guard: cropper internals may not be mounted yet, causing "container.offsetWidth" crash
          const innerContainer = (cropper as any).$container;
          if (innerContainer && innerContainer.offsetWidth > 0) {
            (cropper as any).resize();
          }
        }
        updateImageRect();
      }, 50);
    });
    
    observer.observe(containerRef.current);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [updateImageRect, cropperRef]);

  // Handle tool changes and cropper state
  React.useEffect(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    if (activeTool === 'transform') {
      cropper.enable();
      cropper.setDragMode('crop');
      cropper.crop();
      syncZoom();
    } else {
      // For inpaint and other tools, keep it enabled so it handles resize
      // but disable interaction and clearing crop box
      cropper.enable();
      cropper.setDragMode('none');
      cropper.clear();
      // Defer updateImageRect to allow cropper to update internal state after clear()
      setTimeout(() => {
        updateImageRect();
        syncZoom();
      }, 50);
    }
  }, [activeTool, cropperRef, updateImageRect, syncZoom]);

  // Scroll-to-zoom (disabled in transform/crop mode to not conflict with cropperjs)
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (activeTool === 'transform') return; // let cropperjs handle its own mode
      e.preventDefault();
      const cropper = cropperRef.current?.cropper;
      if (!cropper) return;
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      cropper.zoom(delta);
      setTimeout(() => { syncZoom(); updateImageRect(); }, 80);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [activeTool, cropperRef, syncZoom, updateImageRect]);

  // The effective filter: blank when comparing so user sees original
  const effectiveFilter = isComparing ? 'none' : filterString;

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative bg-[#0a0a0a] overflow-hidden ${activeTool !== 'transform' ? 'hide-crop-ui' : ''} ${(activeTool !== 'transform' && sourceImg !== null) ? 'hide-cropper-image' : ''}`}
      style={{
        '--cropper-filter': effectiveFilter,
        '--vignette-opacity': isComparing ? 0 : Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100)),
        '--vignette-color': adjustments.vignette < 0 ? '0, 0, 0' : '255, 255, 255',
        '--vignette-blend-mode': adjustments.vignette < 0 ? 'multiply' : 'normal',
      } as React.CSSProperties}
    >
      
      <Cropper
        src={currentImageSrc}
        style={{ height: '100%', width: '100%' }}
        initialAspectRatio={NaN}
        guides={activeTool === 'transform'}
        viewMode={1}
        dragMode={activeTool === 'transform' ? "crop" : "none"}
        ref={cropperRef}
        background={false}
        responsive={true}
        autoCrop={activeTool === 'transform'}
        autoCropArea={1}
        checkOrientation={false}
        rotatable={true}
        crossOrigin="anonymous"
        zoomable={true}
        zoomOnWheel={false}
        zoomOnTouch={false}
        toggleDragModeOnDblclick={false}
        cropBoxMovable={activeTool === 'transform'}
        cropBoxResizable={activeTool === 'transform'}
        center={activeTool === 'transform'}
        highlight={activeTool === 'transform'}
        crop={() => {
          handleCropEvent();
          updateImageRect();
        }}
        ready={onCropperReady}
        className={adjustments.vignette !== 0 && !isComparing ? 'with-vignette' : ''}
      />

      {/* ── Live Preview Canvas Overlay ── */}
      {activeTool !== 'transform' && imageRect && sourceImg !== null && (
        <canvas
          ref={liveCanvasRef}
          className="absolute pointer-events-none z-10"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
          }}
        />
      )}

      {/* ── Annotations Overlay (Drawing or Read-Only display) ── */}
      {annotations && annotations.length > 0 && activeTool !== 'annotations' && imageRect && !isComparing && (
        <div
          className="absolute pointer-events-none z-25"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
          }}
        >
          <AnnotationCanvas
            annotations={annotations}
            onChange={() => {}}
            activeDrawTool="freehand"
            activeColor=""
            strokeWidth={1}
            readOnly={true}
          />
        </div>
      )}

      {activeTool === 'annotations' && imageRect && !isComparing && (
        <div
          className="absolute z-30"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            pointerEvents: isCtrlPressed ? 'none' : 'auto',
          }}
        >
          <AnnotationCanvas
            annotations={annotations}
            onChange={onAnnotationsChange}
            activeDrawTool={activeDrawTool}
            setActiveDrawTool={setActiveDrawTool}
            activeColor={activeColor}
            strokeWidth={strokeWidth}
            readOnly={false}
            selectedAnnId={selectedAnnId}
            setSelectedAnnId={setSelectedAnnId}
            userChangedStyleRef={userChangedStyleRef}

            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontWeight={fontWeight}
            setWeight={setWeight}
            fontStyle={fontStyle}
            setStyle={setStyle}
            textDecoration={textDecoration}
            setDecoration={setDecoration}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            lineHeight={lineHeight}
            setLineHeight={setLineHeight}
            letterSpacing={letterSpacing}
            setLetterSpacing={setLetterSpacing}
            onUpdateTextProps={onUpdateTextProps}

            doodleText={doodleText}
            setDoodleText={setDoodleText}
            doodleFontSize={doodleFontSize}
            setDoodleFontSize={setDoodleFontSize}
            doodleFontFamily={doodleFontFamily}
            setDoodleFontFamily={setDoodleFontFamily}
            showDoodleGuide={showDoodleGuide}
            setShowDoodleGuide={setShowDoodleGuide}
          />
        </div>
      )}

      {/* Inpaint Canvas Overlay */}
      {activeTool === 'inpaint' && imageRect && (
        <>
          <div 
            className="absolute z-20"
            style={{
              left: imageRect.left,
              top: imageRect.top,
              width: imageRect.width,
              height: imageRect.height,
            }}
          >
            <InpaintCanvas
              imageUrl={currentImageSrc}
              mode={inpaintMode}
              brushSize={brushSize}
              brushHardness={brushHardness}
              onMaskChange={handleMaskChange}
              showMaskPreview={showMaskPreview}
              maskOpacity={maskOpacity}
            />
          </div>
        </>
      )}




      {isSaving && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-sm font-medium tracking-wide uppercase">Applying Edits…</p>
        </div>
      )}

      {/* Before/After overlay label */}
      {isComparing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">Original</span>
        </div>
      )}

      {/* Zoom HUD */}
      {!isSaving && (
        <ZoomControls
          zoomPercent={zoomPercent}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleZoomReset}
        />
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
                  // We boost the multiplier to 2.5 for a "pro" aggressive look
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

          {adjustments.regions && adjustments.regions.map(region => {
            const regHash = getStringHash(JSON.stringify(region.adjustments));
            return (
              <filter key={region.id} id={`region-filter-${region.id}-${regHash}`} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
                {/* 1. Extract Mask and convert Red channel to Alpha */}
                <feImage
                  href={region.maskUrl}
                  result="rawMask"
                  crossOrigin="anonymous"
                  preserveAspectRatio="none"
                  x="0" y="0" width="100%" height="100%"
                />
                <feColorMatrix in="rawMask" result="alphaMask" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" />

                {/* 2. Soften the mask edges */}
                <feGaussianBlur in="alphaMask" stdDeviation="3" result="featheredMask" />

                {/* 3. Adjustments (Applied to SourceGraphic). 
                    Luminance-preserving saturation is applied first, followed by
                    midpoint-centered contrast, brightness, and warmth/temperature offsets. */}
                <feColorMatrix
                  in="SourceGraphic"
                  result="saturated"
                  type="saturate"
                  values={((): string => {
                    const sat = 1 + (region.adjustments.saturation || 0) / 100;
                    return sat.toFixed(4);
                  })()}
                />

                <feColorMatrix
                  in="saturated"
                  result="adjusted"
                  type="matrix"
                  values={((): string => {
                    const br = (region.adjustments.brightness || 0) / 100 * 0.5;
                    const ct = 1 + (region.adjustments.contrast   || 0) / 100;

                    // Warmth (Temperature): warm → add to R, subtract from B.
                    const warmth = (region.adjustments.warmth || 0) / 100 * 0.15;

                    // Contrast is scaled around the 0.5 gray midpoint, while brightness and warmth are offset additions
                    return `
                      ${ct} 0 0 0 ${0.5 * (1 - ct) + br + warmth}
                      0 ${ct} 0 0 ${0.5 * (1 - ct) + br}
                      0 0 ${ct} 0 ${0.5 * (1 - ct) + br - warmth}
                      0 0 0 1 0
                    `;
                  })()}
                />

                {/* Blur (Optional) - Capped at stdDeviation 20 to keep the SVG
                    filter pipeline cheap on large images. */}
                {region.adjustments.blur && region.adjustments.blur > 0 && (
                  <feGaussianBlur in="adjusted" result="adjustedBlur" stdDeviation={Math.min(20, region.adjustments.blur / 2.5)} />
                )}

                {/* 4. Mask the adjusted version using the feathered mask so the
                    transition is soft instead of hard-edged. */}
                <feComposite
                  in={region.adjustments.blur && region.adjustments.blur > 0 ? "adjustedBlur" : "adjusted"}
                  in2="featheredMask"
                  operator="in"
                  result="maskedEffect"
                />

                {/* 5. Place adjusted region OVER the original */}
                <feMerge>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="maskedEffect" />
                </feMerge>
              </filter>
            );
          })}

          <radialGradient id="vignette-mask" r="65%" cx="50%" cy="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity={Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100))} />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};
