/**
 * PalettePanel.tsx
 * Extracts dominant colors from the image and allows picking colors directly from the image into palette swatches.
 */

import React, { useState, useEffect } from 'react';
import { Pipette, ClipboardCheck, RefreshCw } from 'lucide-react';
import { PalettePanelProps } from './types';
import { PaletteSwatchItem } from './PaletteSwatchItem';
import { runMedianCut } from './colorQuantization';

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
            {swatches.map((color, idx) => (
              <PaletteSwatchItem
                key={idx}
                color={color}
                index={idx}
                isLocked={locked[idx]}
                isPickingThis={activeEyedropperIndex === idx}
                onPickColor={handlePickColor}
                onCopy={handleCopy}
                onToggleLock={handleToggleLock}
              />
            ))}
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

