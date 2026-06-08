import React from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { Check, Loader2 } from 'lucide-react';
import { ToolId } from './Sidebar';
import { Adjustments, getStringHash } from './filterEngine';
import { DEFAULT_CURVE } from './CurveEditor';
import { InpaintCanvas } from './InpaintCanvas';
import { InpaintMode } from './InpaintPanel';

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
  
  // Inpaint props
  inpaintMode?: InpaintMode;
  brushSize?: number;
  brushHardness?: number;
  onInpaintMaskChange?: (maskDataUrl: string) => void;
  showMaskPreview?: boolean;
  maskOpacity?: number;
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
  inpaintMode = 'brush',
  brushSize = 50,
  brushHardness = 80,
  onInpaintMaskChange = (_mask: string): void => {},
  showMaskPreview = true,
  maskOpacity = 60,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [currentMask, setCurrentMask] = React.useState<string | null>(null);
  const [imageRect, setImageRect] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const updateImageRect = React.useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const canvasData = cropper.getCanvasData();
      // Only update if dimensions actually changed to avoid loop
      setImageRect(prev => {
        if (prev && 
            prev.left === canvasData.left && 
            prev.top === canvasData.top && 
            prev.width === canvasData.width && 
            prev.height === canvasData.height) {
          return prev;
        }
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

  const onCropperReady = React.useCallback(() => {
    handleReady();
    updateImageRect();
  }, [handleReady, updateImageRect]);

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
          (cropper as any).resize();
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
    } else {
      // For inpaint and other tools, keep it enabled so it handles resize
      // but disable interaction and clearing crop box
      cropper.enable();
      cropper.setDragMode('none');
      cropper.clear();
      updateImageRect();
    }
  }, [activeTool, cropperRef, updateImageRect]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative bg-[#0a0a0a] overflow-hidden ${activeTool !== 'transform' ? 'hide-crop-ui' : ''}`}
      style={{
        '--cropper-filter': filterString,
        '--vignette-opacity': Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100)),
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
        crop={handleCropEvent}
        ready={onCropperReady}
        className={adjustments.vignette !== 0 ? 'with-vignette' : ''}
      />

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

      {/* ── Hidden SVG filters ── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
        <defs>

          {adjustments.curves !== DEFAULT_CURVE && (
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
