/**
 * BlendPanel.tsx
 * Controls for Double Exposure blending.
 */

import React, { useMemo } from 'react';
import { RotateCcw, Image, Trash2, FolderOpen } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';
import { resolveUrl } from '../../constants';

interface BlendPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'difference', label: 'Difference' },
];

export const BlendPanel: React.FC<BlendPanelProps> = ({ adjustments, onChange }) => {
  const blend = adjustments.blend ?? {
    photoId: null,
    blendImageSrc: null,
    mode: 'screen',
    opacity: 50,
    fit: 'cover',
  };

  const isDefault = useMemo(() => {
    return blend.blendImageSrc === null;
  }, [blend]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      blend: {
        photoId: null,
        blendImageSrc: null,
        mode: 'screen',
        opacity: 50,
        fit: 'cover',
      },
    });
  };

  const handlePickImage = async () => {
    const result = await openFileFolderBrowser({
      title: 'Select Overlay Image',
      multiple: false,
      directoryOnly: false,
    });

    if (result && result.paths.length > 0) {
      const filePath = result.paths[0];
      // Resolve using local:// file scheme
      const resolvedSrc = resolveUrl('local://' + filePath);
      
      onChange({
        ...adjustments,
        blend: {
          ...blend,
          photoId: 1, // dummy active photoId to signal we have selected something
          blendImageSrc: resolvedSrc,
        },
      });
    }
  };

  const handleRemoveImage = () => {
    onChange({
      ...adjustments,
      blend: {
        ...blend,
        photoId: null,
        blendImageSrc: null,
      },
    });
  };

  const handleModeChange = (mode: GlobalCompositeOperation) => {
    onChange({
      ...adjustments,
      blend: { ...blend, mode },
    });
  };

  const handleOpacityChange = (opacity: number) => {
    onChange({
      ...adjustments,
      blend: { ...blend, opacity },
    });
  };

  const handleFitChange = (fit: 'cover' | 'contain' | 'center') => {
    onChange({
      ...adjustments,
      blend: { ...blend, fit },
    });
  };

  const opacityPct = blend.opacity;

  // Extract filename from source
  const filename = useMemo(() => {
    if (!blend.blendImageSrc) return '';
    try {
      const decoded = decodeURIComponent(blend.blendImageSrc);
      const parts = decoded.split('/');
      return parts[parts.length - 1] || 'overlay_image';
    } catch {
      return 'overlay_image';
    }
  }, [blend.blendImageSrc]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Double Exposure
        </span>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors"
          >
            <RotateCcw size={9} /> Reset
          </button>
        )}
      </div>

      {/* ── Image Selector Card ── */}
      <div className="px-4 pb-5 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          Overlay Image
        </p>

        {!blend.blendImageSrc ? (
          <button
            onClick={handlePickImage}
            className="w-full aspect-video rounded-2xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white/60 transition-all cursor-pointer group"
          >
            <FolderOpen size={24} className="stroke-[1.5] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Browse Files...</span>
          </button>
        ) : (
          <div className="relative rounded-2xl border border-white/10 bg-black/40 p-3 flex gap-3 items-center group">
            {/* Image Thumbnail */}
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-white/5 shrink-0">
              <img
                src={blend.blendImageSrc}
                alt="Overlay preview"
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 font-medium truncate leading-tight mb-1" title={filename}>
                {filename}
              </p>
              <button
                onClick={handlePickImage}
                className="text-[10px] text-primary/80 hover:text-primary font-bold uppercase tracking-wider"
              >
                Change...
              </button>
            </div>

            {/* Remove button */}
            <button
              onClick={handleRemoveImage}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
              title="Remove overlay"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Blending Controls ── */}
      {blend.blendImageSrc && (
        <div className="px-4 pt-5 pb-6 space-y-5">
          {/* Blend Mode Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-white/40 leading-none select-none">
              Blend Mode
            </label>
            <select
              value={blend.mode}
              onChange={e => handleModeChange(e.target.value as GlobalCompositeOperation)}
              className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 select-none cursor-pointer"
            >
              {BLEND_MODES.map(mode => (
                <option key={mode.value} value={mode.value} className="bg-[#141414]">
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {/* Opacity Slider */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Overlay Opacity
              </label>
              <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                {blend.opacity}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${opacityPct}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={blend.opacity}
                onChange={e => handleOpacityChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {/* Fit Mode Toggle */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-white/40">Fit Mode</span>
            <div className="flex bg-white/[0.02] border border-white/5 rounded-xl p-0.5 w-full">
              {(['cover', 'contain', 'center'] as const).map(fit => {
                const isActive = blend.fit === fit;
                return (
                  <button
                    key={fit}
                    onClick={() => handleFitChange(fit)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/5 shadow-inner'
                        : 'text-white/30 hover:text-white/50 border border-transparent'
                    }`}
                  >
                    {fit}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
