/**
 * PalettePanel.tsx
 * Extracts dominant colors from the image and allows picking colors directly from the image into palette swatches.
 */

import React, { useState, useEffect } from 'react';
import {
  Pipette,
  Copy,
  Lock,
  Unlock,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';

interface PalettePanelProps {
  imageSrc?: string;
  swatches?: string[];
  locked?: boolean[];
  onSwatchesChange?: (s: string[]) => void;
  onLockedChange?: (l: boolean[]) => void;
  onStartEyedropper?: (targetIdx: number) => void;
  activeEyedropperIndex?: number | null;
}

export const PalettePanel: React.FC<PalettePanelProps> = ({
  imageSrc,
  swatches: propSwatches,
  locked: propLocked,
  onSwatchesChange,
  onLockedChange,
  onStartEyedropper,
  activeEyedropperIndex,
}) => {
  const [localSwatches, setLocalSwatches] = useState<string[]>([
    '#808080', '#808080', '#808080', '#808080', '#808080', '#808080'
  ]);
  const [localLocked, setLocalLocked] = useState<boolean[]>([
    false, false, false, false, false, false
  ]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  const swatches = propSwatches || localSwatches;
  const locked = propLocked || localLocked;

  const updateSwatches = (next: string[]) => {
    if (onSwatchesChange) onSwatchesChange(next);
    else setLocalSwatches(next);
  };

  const updateLocked = (next: boolean[]) => {
    if (onLockedChange) onLockedChange(next);
    else setLocalLocked(next);
  };

  // Extract 6 dominant colors from the image
  const extractColors = async (src: string) => {
    if (!src) return;
    setIsExtracting(true);
    try {
      const extracted = await runMedianCut(src, 6);
      const next = swatches.map((current, idx) => {
        if (locked[idx]) return current;
        return extracted[idx] || current;
      });
      updateSwatches(next);
    } catch (err) {
      console.error('Failed to extract palette:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    if (imageSrc) {
      extractColors(imageSrc);
    }
  }, [imageSrc]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color);
    showToast(`Hex ${color} copied to clipboard!`);
  };

  const handleToggleLock = (idx: number) => {
    const next = [...locked];
    next[idx] = !next[idx];
    updateLocked(next);
  };

  // Pick color from the image using the in-canvas Loupe Eyedropper or native Eyedropper
  const handlePickColor = async (targetIdx?: number) => {
    const idxToSet = typeof targetIdx === 'number'
      ? targetIdx
      : locked.findIndex(isLock => !isLock) !== -1
      ? locked.findIndex(isLock => !isLock)
      : 0;

    if (onStartEyedropper) {
      onStartEyedropper(idxToSet);
      return;
    }

    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const hex = result.sRGBHex.toUpperCase();
          const next = [...swatches];
          next[idxToSet] = hex;
          updateSwatches(next);

          const nextLocked = [...locked];
          nextLocked[idxToSet] = true;
          updateLocked(nextLocked);

          showToast(`Sampled ${hex} into Swatch ${idxToSet + 1}!`);
        }
      } catch {}
    }
  };

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14] text-white select-none">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Color Palette
        </span>
        {imageSrc && (
          <button
            onClick={() => extractColors(imageSrc)}
            disabled={isExtracting}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/30 hover:text-white/80 disabled:opacity-40 transition-colors cursor-pointer"
            title="Resample unlocked colors from image"
          >
            <RefreshCw size={9} className={isExtracting ? 'animate-spin' : ''} />
            Re-sample
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Toast confirmation */}
        {toastMessage && (
          <div className="flex items-center gap-2 p-2.5 px-3 bg-[#181a20] border border-primary/30 rounded-xl shadow-xl transition-all animate-in fade-in duration-200">
            <ClipboardCheck size={14} className="text-primary shrink-0" />
            <span className="text-[10px] text-white/90 font-medium truncate">
              {toastMessage}
            </span>
          </div>
        )}

        {/* Eyedropper Action Button */}
        <button
          onClick={() => handlePickColor()}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
            typeof activeEyedropperIndex === 'number'
              ? 'bg-white text-black border border-white shadow-[0_0_20px_rgba(255,255,255,0.35)]'
              : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
          }`}
        >
          <Pipette size={14} strokeWidth={2.5} />
          <span>
            {typeof activeEyedropperIndex === 'number'
              ? `Sampling Swatch ${activeEyedropperIndex + 1}...`
              : 'Pick Color from Image'}
          </span>
        </button>

        {/* 6 Palette Swatches */}
        <div className="space-y-2 pt-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
            Palette Swatches
          </p>

          <div className="space-y-2">
            {swatches.map((color, idx) => {
              const isLocked = locked[idx];
              const isPickingThis = activeEyedropperIndex === idx;
              const rgb = hexToRgb(color);

              return (
                <div
                  key={idx}
                  className={`group/swatch flex items-center justify-between p-2 rounded-2xl border transition-all duration-150 ${
                    isPickingThis
                      ? 'border-white bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                      : isLocked
                      ? 'border-white/20 bg-white/[0.04]'
                      : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Swatch color bubble */}
                    <div
                      className="w-9 h-9 rounded-xl border border-white/10 shrink-0 shadow-inner"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-mono font-bold text-white/90 uppercase select-all block">
                        {color}
                      </span>
                      <span className="block text-[9px] font-mono text-white/30 truncate">
                        {rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `Swatch ${idx + 1}`}
                        {isLocked && ' • Locked'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Eyedropper Pick for this slot */}
                    <button
                      onClick={() => handlePickColor(idx)}
                      className={`editor-btn editor-chip-btn ${
                        isPickingThis ? 'active' : ''
                      } p-1.5`}
                      title={`Pick color from image into Swatch ${idx + 1}`}
                    >
                      <Pipette size={12} />
                    </button>

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(color)}
                      className="editor-btn editor-chip-btn p-1.5"
                      title="Copy hex code"
                    >
                      <Copy size={12} />
                    </button>

                    {/* Lock/Unlock Button */}
                    <button
                      onClick={() => handleToggleLock(idx)}
                      className={`editor-btn editor-chip-btn ${
                        isLocked ? 'active' : ''
                      } p-1.5`}
                      title={isLocked ? 'Unlock swatch' : 'Lock swatch'}
                    >
                      {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Helpful instructions */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <p className="text-[9px] text-white/30 leading-relaxed">
            💡 Click the eyedropper icon on any swatch, then click anywhere on your photo to sample that exact color with a live pixel loupe.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Quantization Logic ────────────────────────────────────────────────────────

function runMedianCut(imgSrc: string, count: number): Promise<string[]> {
  return new Promise(resolve => {
    const processImage = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([]);
        return;
      }
      ctx.drawImage(img, 0, 0, 100, 100);
      try {
        const imgData = ctx.getImageData(0, 0, 100, 100);
        const data = imgData.data;
        const pixels: [number, number, number][] = [];
        for (let i = 0; i < data.length; i += 4) {
          pixels.push([data[i], data[i + 1], data[i + 2]]);
        }

        const buckets = [pixels];
        while (buckets.length < count) {
          let maxBucketIdx = -1;
          let maxBucketSize = -1;
          for (let i = 0; i < buckets.length; i++) {
            if (buckets[i].length > maxBucketSize) {
              maxBucketSize = buckets[i].length;
              maxBucketIdx = i;
            }
          }
          if (maxBucketIdx === -1 || maxBucketSize <= 1) break;
          const bucketToSplit = buckets.splice(maxBucketIdx, 1)[0];

          let minR = 255, maxR = 0;
          let minG = 255, maxG = 0;
          let minB = 255, maxB = 0;
          for (const p of bucketToSplit) {
            if (p[0] < minR) minR = p[0];
            if (p[0] > maxR) maxR = p[0];
            if (p[1] < minG) minG = p[1];
            if (p[1] > maxG) maxG = p[1];
            if (p[2] < minB) minB = p[2];
            if (p[2] > maxB) maxB = p[2];
          }
          const rangeR = maxR - minR;
          const rangeG = maxG - minG;
          const rangeB = maxB - minB;

          let sortChannel = 0;
          if (rangeG >= rangeR && rangeG >= rangeB) sortChannel = 1;
          else if (rangeB >= rangeR && rangeB >= rangeG) sortChannel = 2;

          bucketToSplit.sort((a, b) => a[sortChannel] - b[sortChannel]);
          const median = Math.floor(bucketToSplit.length / 2);
          const b1 = bucketToSplit.slice(0, median);
          const b2 = bucketToSplit.slice(median);
          buckets.push(b1);
          buckets.push(b2);
        }

        const colors = buckets.map(bucket => {
          let sumR = 0, sumG = 0, sumB = 0;
          for (const p of bucket) {
            sumR += p[0];
            sumG += p[1];
            sumB += p[2];
          }
          const len = bucket.length || 1;
          const r = Math.round(sumR / len);
          const g = Math.round(sumG / len);
          const b = Math.round(sumB / len);
          return rgbToHex(r, g, b);
        });

        while (colors.length < count) {
          colors.push('#808080');
        }
        resolve(colors.slice(0, count));
      } catch (err) {
        resolve([]);
      }
    };

    if (imgSrc.startsWith('blob:') || imgSrc.startsWith('data:')) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => processImage(img);
      img.onerror = () => resolve([]);
      img.src = imgSrc;
      return;
    }

    fetch(imgSrc, { mode: 'cors' })
      .then(res => (res.ok ? res.blob() : null))
      .then(blob => {
        if (!blob) {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => processImage(img);
          img.onerror = () => resolve([]);
          img.src = imgSrc;
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          processImage(img);
          URL.revokeObjectURL(blobUrl);
        };
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          resolve([]);
        };
        img.src = blobUrl;
      })
      .catch(() => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => processImage(img);
        img.onerror = () => resolve([]);
        img.src = imgSrc;
      });
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
