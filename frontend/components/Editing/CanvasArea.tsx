import React from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { Check, Loader2 } from 'lucide-react';
import { ToolId } from './Sidebar';
import { Adjustments, getStringHash } from './filterEngine';
import { DEFAULT_CURVE } from './CurveEditor';

interface CanvasAreaProps {
  currentImageSrc: string;
  filterString: string;
  cropperRef: React.RefObject<ReactCropperElement>;
  handleCropEvent: () => void;
  handleReady: () => void;
  hasCropSelection: boolean;
  activeTool: ToolId;
  handleApplyCrop: () => void;
  adjustments: Adjustments;
  isSaving: boolean;
  curvesTable: { r: string; g: string; b: string };
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
}) => {
  return (
    <div
      className="flex-1 relative bg-[#0a0a0a] overflow-hidden"
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
        ready={handleReady}
        className={adjustments.vignette !== 0 ? 'with-vignette' : ''}
      />


      {isSaving && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-sm font-medium tracking-wide uppercase">Applying Edits…</p>
        </div>
      )}

      {/* ── Hidden SVG filters ── */}
      <svg className="hidden" xmlns="http://www.w3.org/2000/svg">
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

          <radialGradient id="vignette-mask" r="65%" cx="50%" cy="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity={Math.min(0.9, Math.abs((adjustments.vignette || 0) / 100))} />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};
