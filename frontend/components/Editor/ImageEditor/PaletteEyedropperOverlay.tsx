import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pipette, X } from 'lucide-react';
import { rgbToHex } from './utils/colorUtils';
import { loadCanvasImage } from './utils/imageUtils';

interface PaletteEyedropperOverlayProps {
  width: number;
  height: number;
  sourceImage: HTMLImageElement | null;
  imageSrc?: string;
  targetSwatchIndex: number;
  onColorPicked: (hex: string, targetIdx: number) => void;
  onCancel: () => void;
}

export const PaletteEyedropperOverlay: React.FC<PaletteEyedropperOverlayProps> = ({
  width,
  height,
  sourceImage,
  imageSrc,
  targetSwatchIndex,
  onColorPicked,
  onCancel,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackImgRef = useRef<HTMLImageElement | null>(null);

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoverColor, setHoverColor] = useState<string>('#FFFFFF');
  const [hoverRgb, setHoverRgb] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  const [pixelGrid, setPixelGrid] = useState<string[][]>([]);

  // Render full source image onto offscreen sampling canvas
  const initSampleCanvas = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      sampleCanvasRef.current = canvas;
    }
  }, [width, height]);

  // Load fallback image if sourceImage is missing or detached
  useEffect(() => {
    if (!imageSrc) return;
    let isMounted = true;
    loadCanvasImage(imageSrc).then(img => {
      if (!isMounted) return;
      fallbackImgRef.current = img;
      initSampleCanvas(img);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [imageSrc, initSampleCanvas]);

  useEffect(() => {
    if (sourceImage && sourceImage.naturalWidth > 0) {
      initSampleCanvas(sourceImage);
    }
  }, [sourceImage, initSampleCanvas]);

  // Escape key listener to dismiss eyedropper
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Sample pixel color and 7x7 pixel grid under cursor
  const sampleAt = useCallback((x: number, y: number) => {
    const canvas = sampleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const clampedX = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
    const clampedY = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));

    try {
      // 1. Sample central pixel
      const pixel = ctx.getImageData(clampedX, clampedY, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const hex = rgbToHex(r, g, b);
      setHoverColor(hex);
      setHoverRgb({ r, g, b });

      // 2. Sample 7x7 loupe neighborhood grid
      const gridRadius = 3;
      const gridSize = 7;
      const startX = Math.max(0, clampedX - gridRadius);
      const startY = Math.max(0, clampedY - gridRadius);
      const readW = Math.min(canvas.width - startX, gridSize);
      const readH = Math.min(canvas.height - startY, gridSize);

      const areaData = ctx.getImageData(startX, startY, readW, readH).data;
      const grid: string[][] = [];

      for (let gy = 0; gy < readH; gy++) {
        const row: string[] = [];
        for (let gx = 0; gx < readW; gx++) {
          const idx = (gy * readW + gx) * 4;
          row.push(rgbToHex(areaData[idx], areaData[idx + 1], areaData[idx + 2]));
        }
        grid.push(row);
      }
      setPixelGrid(grid);
    } catch {
      // Canvas read error fallback
    }
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setMousePos({ x, y });
    sampleAt(x, y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const canvas = sampleCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
          onColorPicked(hex, targetSwatchIndex);
          return;
        } catch {}
      }
    }

    onColorPicked(hoverColor, targetSwatchIndex);
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30 cursor-crosshair select-none touch-none"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => setMousePos(null)}
    >
      {/* Top Banner Guide */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#12141a]/90 backdrop-blur-md border border-primary/40 shadow-2xl text-white text-xs font-medium z-40 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150">
        <Pipette size={13} className="text-primary animate-pulse" />
        <span>Click anywhere on photo to sample Swatch {targetSwatchIndex + 1}</span>
        <button
          onClick={onCancel}
          className="ml-2 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Cancel (Esc)"
        >
          <X size={10} />
        </button>
      </div>

      {/* Floating Loupe Magnifier */}
      {mousePos && (
        <div
          className="absolute pointer-events-none z-40 -translate-x-1/2 -translate-y-[135%]"
          style={{
            left: mousePos.x,
            top: mousePos.y,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Loupe Circle */}
            <div
              className="w-20 h-20 rounded-full border-4 shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden relative flex items-center justify-center bg-black/80 backdrop-blur-sm"
              style={{ borderColor: hoverColor }}
            >
              {/* Magnified Pixel Grid (7x7) */}
              <div className="grid grid-cols-7 w-full h-full">
                {pixelGrid.map((row, ry) =>
                  row.map((cellHex, rx) => (
                    <div
                      key={`${ry}-${rx}`}
                      style={{ backgroundColor: cellHex }}
                      className="w-full h-full border-[0.5px] border-white/5"
                    />
                  ))
                )}
              </div>

              {/* Center Target Crosshair Box */}
              <div
                className="absolute w-3.5 h-3.5 border-2 border-white rounded-sm shadow-md pointer-events-none"
                style={{ backgroundColor: hoverColor }}
              />
            </div>

            {/* Hex and RGB Readout Pill */}
            <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-[#12141a]/95 border border-white/15 backdrop-blur-md shadow-xl flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: hoverColor }}
              />
              <span className="font-mono text-[11px] font-bold text-white tracking-wider">
                {hoverColor}
              </span>
              <span className="font-mono text-[9px] text-white/50">
                {hoverRgb.r},{hoverRgb.g},{hoverRgb.b}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

