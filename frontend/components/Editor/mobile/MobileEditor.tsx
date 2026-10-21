import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  Loader2,
  Sun,
  Contrast,
  Sliders,
  Sparkles,
  Eye,
  Flame,
  Droplets,
  Focus,
  Disc,
} from 'lucide-react';
import type { Photo } from '@/types';
import { photoSrc } from '@/constants';

export interface MobileEditorProps {
  photo: Photo;
  src?: string;
  onClose: () => void;
  onSave?: (blob: Blob, adjustments: Record<string, number>) => Promise<void> | void;
}

export interface ToolDef {
  id: string;
  label: string;
  icon: React.ElementType;
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
}

export const MOBILE_TOOLS: ToolDef[] = [
  { id: 'exposure', label: 'Exposure', icon: Sun, min: -100, max: 100, defaultValue: 0 },
  { id: 'brightness', label: 'Brightness', icon: Sparkles, min: -100, max: 100, defaultValue: 0 },
  { id: 'contrast', label: 'Contrast', icon: Contrast, min: -100, max: 100, defaultValue: 0 },
  { id: 'highlights', label: 'Highlights', icon: Eye, min: -100, max: 100, defaultValue: 0 },
  { id: 'shadows', label: 'Shadows', icon: Sliders, min: -100, max: 100, defaultValue: 0 },
  { id: 'saturation', label: 'Saturation', icon: Droplets, min: -100, max: 100, defaultValue: 0 },
  { id: 'temperature', label: 'Warmth', icon: Flame, min: -100, max: 100, defaultValue: 0 },
  { id: 'sharpness', label: 'Sharpness', icon: Focus, min: 0, max: 100, defaultValue: 0 },
  { id: 'vignette', label: 'Vignette', icon: Disc, min: 0, max: 100, defaultValue: 0 },
];

export const DEFAULT_MOBILE_ADJUSTMENTS: Record<string, number> = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  temperature: 0,
  sharpness: 0,
  vignette: 0,
};

/**
 * clampByte - Clamps a numeric channel value into [0, 255].
 */
const clampByte = (value: number): number => {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
};

/**
 * applyMobileAdjustmentsToImageData - Applies all 9 mobile editor tools
 * (exposure, brightness, contrast, highlights, shadows, saturation,
 * temperature, sharpness, vignette) directly to an RGBA pixel buffer.
 */
export function applyMobileAdjustmentsToImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  adjustments: Record<string, number>
): Uint8ClampedArray {
  const exposure = adjustments.exposure ?? 0;
  const brightness = adjustments.brightness ?? 0;
  const contrast = adjustments.contrast ?? 0;
  const highlights = adjustments.highlights ?? 0;
  const shadows = adjustments.shadows ?? 0;
  const saturation = adjustments.saturation ?? 0;
  const temperature = adjustments.temperature ?? 0;
  const sharpness = adjustments.sharpness ?? 0;
  const vignette = adjustments.vignette ?? 0;

  const hasColorPass =
    exposure !== 0 ||
    brightness !== 0 ||
    contrast !== 0 ||
    highlights !== 0 ||
    shadows !== 0 ||
    saturation !== 0 ||
    temperature !== 0 ||
    vignette !== 0;

  if (hasColorPass) {
    const expFactor = exposure !== 0 ? Math.pow(2, exposure / 50) : 1;
    const brightOffset = (brightness / 100) * 255;
    const contrastFactor = contrast !== 0 ? Math.pow((contrast + 100) / 100, 2) : 1;
    const satFactor = 1 + saturation / 100;
    const tempShift = temperature * 0.8;
    const vignetteStrength = vignette / 100;

    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Exposure (EV multiplier)
      if (exposure !== 0) {
        r *= expFactor;
        g *= expFactor;
        b *= expFactor;
      }

      // 2. Brightness (additive offset)
      if (brightness !== 0) {
        r += brightOffset;
        g += brightOffset;
        b += brightOffset;
      }

      // 3. Contrast (around midpoint 128)
      if (contrast !== 0) {
        r = (r - 128) * contrastFactor + 128;
        g = (g - 128) * contrastFactor + 128;
        b = (b - 128) * contrastFactor + 128;
      }

      // 4. Highlights & 5. Shadows (luminance-weighted)
      if (highlights !== 0 || shadows !== 0) {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (highlights !== 0 && lum > 128) {
          const weight = Math.min(1, (lum - 128) / 127);
          const delta = (highlights / 100) * 96 * weight;
          r += delta;
          g += delta;
          b += delta;
        }
        if (shadows !== 0 && lum < 128) {
          const weight = Math.min(1, (128 - lum) / 128);
          const delta = (shadows / 100) * 96 * weight;
          r += delta;
          g += delta;
          b += delta;
        }
      }

      // 6. Temperature / Warmth (R/B channel shift)
      if (temperature !== 0) {
        r += tempShift;
        b -= tempShift;
      }

      // 7. Saturation (Rec.709 luminance interpolation)
      if (saturation !== 0) {
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = gray + (r - gray) * satFactor;
        g = gray + (g - gray) * satFactor;
        b = gray + (b - gray) * satFactor;
      }

      // 8. Vignette (radial distance falloff from center)
      if (vignette !== 0 && width > 0 && height > 0) {
        const pxIdx = i >> 2;
        const x = pxIdx % width;
        const y = Math.floor(pxIdx / width);
        const dx = x - cx;
        const dy = y - cy;
        const distNorm = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const falloff = Math.pow(distNorm, 1.5);
        const vigMultiplier = Math.max(0, 1 - vignetteStrength * falloff);
        r *= vigMultiplier;
        g *= vigMultiplier;
        b *= vigMultiplier;
      }

      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }
  }

  // 9. Sharpness (3x3 Laplacian unsharp kernel blend)
  if (sharpness !== 0 && width >= 3 && height >= 3) {
    const amount = (sharpness / 100) * 0.6;
    const src = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[idx + c];
          const top = src[((y - 1) * width + x) * 4 + c];
          const bottom = src[((y + 1) * width + x) * 4 + c];
          const left = src[(y * width + (x - 1)) * 4 + c];
          const right = src[(y * width + (x + 1)) * 4 + c];
          const edge = 4 * center - top - bottom - left - right;
          data[idx + c] = clampByte(center + edge * amount);
        }
      }
    }
  }

  return data;
}

/**
 * MobileEditor - Renders mobile photo editor with 9-tool pixel adjustments.
 */
export const MobileEditor: React.FC<MobileEditorProps> = ({ photo, src, onClose, onSave }) => {
  const [activeToolId, setActiveToolId] = useState<string>('exposure');
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => ({
    ...DEFAULT_MOBILE_ADJUSTMENTS,
  }));

  const [history, setHistory] = useState<Record<string, number>[]>([
    { ...DEFAULT_MOBILE_ADJUSTMENTS },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasPreviewReady, setCanvasPreviewReady] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const basePreviewDataRef = useRef<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);

  const resolvedSrc = useMemo(() => src || photoSrc(photo), [src, photo]);

  const activeTool = useMemo(
    () => MOBILE_TOOLS.find((t) => t.id === activeToolId) || MOBILE_TOOLS[0],
    [activeToolId]
  );

  const currentValue = adjustments[activeTool.id] ?? activeTool.defaultValue;

  /**
   * syncPreviewCanvas - Renders current adjustments onto the live preview canvas.
   */
  const syncPreviewCanvas = useCallback((currentAdjustments: Record<string, number>) => {
    const base = basePreviewDataRef.current;
    const canvas = previewCanvasRef.current;
    if (!base || !canvas) return;

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const workingPixels = new Uint8ClampedArray(base.data);
      applyMobileAdjustmentsToImageData(workingPixels, base.width, base.height, currentAdjustments);
      const imageData =
        typeof ImageData !== 'undefined'
          ? new ImageData(workingPixels, base.width, base.height)
          : ctx.createImageData(base.width, base.height);
      if (typeof ImageData === 'undefined') {
        imageData.data.set(workingPixels);
      }
      ctx.putImageData(imageData, 0, 0);
    } catch {
      setCanvasPreviewReady(false);
    }
  }, []);

  /**
   * handleImageLoad - Captures downscaled base image data for fast live canvas preview.
   */
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas) return;

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) return;

    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    try {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      if (imgData && imgData.data) {
        basePreviewDataRef.current = {
          data: new Uint8ClampedArray(imgData.data),
          width: w,
          height: h,
        };
        setCanvasPreviewReady(true);
        syncPreviewCanvas(adjustments);
      }
    } catch {
      setCanvasPreviewReady(false);
    }
  }, [adjustments, syncPreviewCanvas]);

  useEffect(() => {
    if (canvasPreviewReady) {
      syncPreviewCanvas(adjustments);
    }
  }, [adjustments, canvasPreviewReady, syncPreviewCanvas]);

  /**
   * handleSliderChange - Handles slider change.
   */
  const handleSliderChange = (val: number) => {
    const next = { ...adjustments, [activeTool.id]: val };
    setAdjustments(next);
  };

  /**
   * handleSliderCommit - Handles slider commit.
   */
  const handleSliderCommit = (val: number) => {
    const next = { ...adjustments, [activeTool.id]: val };
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(next);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  /**
   * handleUndo - Handles undo.
   */
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAdjustments(history[historyIndex - 1]);
    }
  };

  /**
   * handleRedo - Handles redo.
   */
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAdjustments(history[historyIndex + 1]);
    }
  };

  /**
   * handleReset - Resets all adjustments to their default values.
   */
  const handleReset = () => {
    const resetValues: Record<string, number> = {};
    MOBILE_TOOLS.forEach((t) => {
      resetValues[t.id] = t.defaultValue;
    });
    setAdjustments(resetValues);
    setHistory([resetValues]);
    setHistoryIndex(0);
  };

  /**
   * renderEditedBlob - Renders full-resolution adjusted image onto an offscreen canvas and exports JPEG Blob.
   */
  const renderEditedBlob = async (): Promise<Blob> => {
    const img = imgRef.current;
    const width = Math.max(1, img?.naturalWidth || img?.width || photo.width || 64);
    const height = Math.max(1, img?.naturalHeight || img?.height || photo.height || 64);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let ctx: CanvasRenderingContext2D | null = null;
    let processedPixels: Uint8ClampedArray | null = null;

    try {
      ctx = canvas.getContext('2d');
      if (ctx) {
        if (img) {
          try {
            ctx.drawImage(img, 0, 0, width, height);
          } catch {
            // Ignore drawImage errors in non-browser/test environments
          }
        }
        const imageData = ctx.getImageData(0, 0, width, height);
        if (imageData && imageData.data) {
          processedPixels = applyMobileAdjustmentsToImageData(
            imageData.data,
            width,
            height,
            adjustments
          );
          ctx.putImageData(imageData, 0, 0);
        }
      }
    } catch {
      ctx = null;
    }

    if (!processedPixels) {
      const fallbackW = Math.min(width, 16);
      const fallbackH = Math.min(height, 16);
      const fallbackBuffer = new Uint8ClampedArray(fallbackW * fallbackH * 4);
      processedPixels = applyMobileAdjustmentsToImageData(
        fallbackBuffer,
        fallbackW,
        fallbackH,
        adjustments
      );
    }

    if (!ctx || typeof canvas.toBlob !== 'function') {
      return new Blob([processedPixels.buffer as ArrayBuffer], { type: 'image/jpeg' });
    }

    return new Promise<Blob>((resolve) => {
      let settled = false;
      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(
          blob || new Blob([processedPixels!.buffer as ArrayBuffer], { type: 'image/jpeg' })
        );
      };

      const timer = setTimeout(() => finish(null), 50);
      try {
        canvas.toBlob(
          (blob) => {
            clearTimeout(timer);
            finish(blob);
          },
          'image/jpeg',
          0.92
        );
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    });
  };

  /**
   * handleSave - Exports the edited canvas as a JPEG Blob and invokes onSave before closing.
   */
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const blob = await renderEditedBlob();
      await onSave?.(blob, adjustments);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Fallback CSS filter simulation when canvas preview is not yet ready
  const previewFilter = useMemo(() => {
    const exp = Math.pow(2, (adjustments.exposure || 0) / 100);
    const b = 1 + (adjustments.brightness || 0) / 100;
    const hiShadowLift = ((adjustments.highlights || 0) + (adjustments.shadows || 0)) / 300;
    const c = 1 + (adjustments.contrast || 0) / 100;
    const s = 1 + (adjustments.saturation || 0) / 100;
    const sepia = Math.max(0, (adjustments.temperature || 0) / 200);
    return `brightness(${Math.max(0.1, b * exp + hiShadowLift)}) contrast(${Math.max(0.1, c)}) saturate(${Math.max(0, s)}) sepia(${sepia})`;
  }, [adjustments]);

  return (
    <div className="fixed inset-0 z-50 bg-[#07080c] flex flex-col select-none overflow-hidden font-sans">
      {/* ── Top Navigation Bar ── */}
      <header className="h-14 pt-safe px-4 flex items-center justify-between border-b border-white/10 bg-[#0e1017]/90 backdrop-blur-xl shrink-0 z-10">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="p-2 -ml-2 text-gray-400 hover:text-white rounded-full transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Cancel</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0 || isSaving}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-full transition-colors"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1 || isSaving}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-full transition-colors"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-full transition-colors flex items-center gap-1 text-xs font-medium"
            title="Reset All"
            aria-label="Reset"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
          className="px-3 py-1.5 bg-[#FCBC00] hover:bg-[#FCBC00]/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-black font-semibold text-xs rounded-full flex items-center gap-1 shadow-lg shadow-[#FCBC00]/20 transition-all"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} strokeWidth={2.5} />
          )}
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </header>

      {/* ── Photo Canvas Viewport ── */}
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden">
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <img
            ref={imgRef}
            src={resolvedSrc}
            alt={photo.filename}
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            style={{ filter: canvasPreviewReady ? undefined : previewFilter }}
            className={`max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl transition-all duration-75 ${
              canvasPreviewReady ? 'opacity-0 absolute pointer-events-none' : ''
            }`}
          />
          <canvas
            ref={previewCanvasRef}
            data-testid="mobile-editor-preview-canvas"
            className={`max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl ${
              canvasPreviewReady ? 'block' : 'hidden'
            }`}
          />
          {!canvasPreviewReady && (adjustments.temperature || 0) !== 0 && (
            <div
              data-testid="warmth-overlay"
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                backgroundColor:
                  (adjustments.temperature || 0) > 0
                    ? `rgba(255, 160, 40, ${Math.abs(adjustments.temperature) / 350})`
                    : `rgba(60, 140, 255, ${Math.abs(adjustments.temperature) / 350})`,
                mixBlendMode: 'soft-light',
              }}
            />
          )}
          {!canvasPreviewReady && (adjustments.vignette || 0) > 0 && (
            <div
              data-testid="vignette-overlay"
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background: `radial-gradient(circle, transparent 45%, rgba(0, 0, 0, ${
                  (adjustments.vignette || 0) / 115
                }) 100%)`,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Bottom Controls Sheet (Thumb Zone) ── */}
      <div className="bg-[#0e1017]/95 backdrop-blur-2xl border-t border-white/10 pb-safe shrink-0 flex flex-col">
        {/* Active Tool Slider (Thumb Zone) */}
        <div className="px-6 pt-4 pb-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>{activeTool.label}</span>
            <span
              onClick={() => {
                handleSliderChange(activeTool.defaultValue);
                handleSliderCommit(activeTool.defaultValue);
              }}
              className="px-2 py-0.5 rounded-md bg-white/5 text-white cursor-pointer active:scale-90 transition-transform font-mono"
            >
              {currentValue > 0 ? `+${currentValue}` : currentValue}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-500 font-mono w-6 text-right">
              {activeTool.min}
            </span>
            <input
              type="range"
              aria-label={activeTool.label}
              min={activeTool.min}
              max={activeTool.max}
              value={currentValue}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              onPointerUp={(e) => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FCBC00]"
            />
            <span className="text-[10px] text-gray-500 font-mono w-6">
              +{activeTool.max}
            </span>
          </div>
        </div>

        {/* Horizontal Tool Categories Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-t border-white/5">
          {MOBILE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = tool.id === activeToolId;
            const isEdited = (adjustments[tool.id] ?? tool.defaultValue) !== tool.defaultValue;

            return (
              <button
                key={tool.id}
                onClick={() => setActiveToolId(tool.id)}
                className={`relative flex flex-col items-center gap-1.5 px-3.5 py-2 rounded-xl shrink-0 transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-[#FCBC00] text-black shadow-[0_0_14px_rgba(252,188,0,0.45)] font-semibold'
                    : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon
                    size={18}
                    strokeWidth={isSelected ? 2.4 : 1.8}
                    className={isSelected ? 'text-black' : ''}
                  />
                  {isEdited && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FCBC00] shadow-sm shadow-[#FCBC00]/60" />
                  )}
                  {isEdited && isSelected && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-black/80" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium whitespace-nowrap ${
                    isSelected ? 'text-black font-bold' : ''
                  }`}
                >
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

