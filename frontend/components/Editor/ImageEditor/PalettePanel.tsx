/**
 * PalettePanel.tsx
 * Extracts dominant colors from the image using client-side median-cut quantization.
 * Allows locking swatches and copying hex values.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Lock, Unlock, ClipboardCheck, RefreshCw } from 'lucide-react';

interface PalettePanelProps {
  imageSrc?: string;
}

export const PalettePanel: React.FC<PalettePanelProps> = ({ imageSrc }) => {
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [lockedColors, setLockedColors] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [toastColor, setToastColor] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Median Cut Extractor
  const extractColors = async (src: string) => {
    if (!src) return;
    setIsExtracting(true);
    try {
      const colors = await runMedianCut(src, 6);
      setExtractedColors(colors);
    } catch (err) {
      console.error('Failed to extract palette:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Re-run color extraction when image changes
  useEffect(() => {
    if (imageSrc) {
      extractColors(imageSrc);
    }
  }, [imageSrc]);

  // Combine extracted colors and locked colors
  const finalColors = useMemo(() => {
    const palette = [...extractedColors];
    // Pad to 6 if needed
    while (palette.length < 6) palette.push('#808080');

    return lockedColors.map((locked, idx) => {
      return locked !== null ? locked : palette[idx];
    });
  }, [extractedColors, lockedColors]);

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color);
    setToastColor(color);
    setTimeout(() => {
      setToastColor(null);
    }, 2000);
  };

  const handleToggleLock = (idx: number, color: string) => {
    const nextLocked = [...lockedColors];
    if (nextLocked[idx] === null) {
      nextLocked[idx] = color;
    } else {
      nextLocked[idx] = null;
    }
    setLockedColors(nextLocked);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Color Palette
        </span>
        {imageSrc && (
          <button
            onClick={() => extractColors(imageSrc)}
            disabled={isExtracting}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/65 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw size={9} className={isExtracting ? 'animate-spin' : ''} />
            Re-sample
          </button>
        )}
      </div>

      <div className="px-4 pb-6 space-y-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
          Dominant Colors
        </p>

        {/* Toast confirmation */}
        {toastColor && (
          <div className="flex items-center gap-2 p-2 px-3 bg-[#181818] border border-white/5 rounded-xl transition-all animate-fade-in duration-300">
            <ClipboardCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] text-white/80 font-medium truncate">
              Hex <span className="font-mono font-bold text-emerald-400">{toastColor}</span> copied to clipboard!
            </span>
          </div>
        )}

        {/* Swatch List */}
        <div className="space-y-3">
          {finalColors.map((color, idx) => {
            const isLocked = lockedColors[idx] !== null;
            return (
              <div
                key={idx}
                className="group/swatch flex items-center justify-between p-2 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Swatch color bubble */}
                  <div
                    className="w-10 h-10 rounded-xl border border-white/10 shrink-0 shadow-inner"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-bold text-white/90 uppercase select-all">
                      {color}
                    </span>
                    <span className="block text-[9px] text-white/20 font-medium">
                      Swatch {idx + 1} {isLocked && '• Locked'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(color)}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 text-white/40 hover:text-white/80 transition-all cursor-pointer"
                    title="Copy hex code"
                  >
                    <Copy size={12} />
                  </button>

                  {/* Lock/Unlock Button */}
                  <button
                    onClick={() => handleToggleLock(idx, color)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isLocked
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/10 text-white/40 hover:text-white/80'
                    }`}
                    title={isLocked ? 'Unlock swatch' : 'Lock swatch'}
                  >
                    {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info panel */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <p className="text-[9px] text-white/20 leading-relaxed">
            💡 Median-cut quantization extracts the 6 most prominent colors by grouping pixels with similar hue, saturation and value. Copy and save them for editing palettes.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Quantization Logic ────────────────────────────────────────────────────────

function runMedianCut(imgSrc: string, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
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
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          pixels.push([r, g, b]);
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
        console.error(err);
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = imgSrc;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
