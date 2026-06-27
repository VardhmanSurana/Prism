/**
 * TexturePanel.tsx
 * Renders controls for Film Grain, Light Leaks, Vignette, and Double Exposure blending.
 */

import React, { useMemo } from 'react';
import { RotateCcw, Trash2, FolderOpen } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { openFileFolderBrowser } from '../../services/FileFolderBrowserService';
import { resolveUrl } from '../../constants';

interface TexturePanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const LEAKS = [
  {
    id: 'warm-left',
    name: 'Warm Left',
    background: 'linear-gradient(to right, rgba(251, 146, 60, 0.5), transparent)',
  },
  {
    id: 'cool-top',
    name: 'Cool Top',
    background: 'linear-gradient(to bottom, rgba(56, 189, 248, 0.5), transparent)',
  },
  {
    id: 'rainbow-corner',
    name: 'Rainbow',
    background: 'radial-gradient(circle at top right, rgba(236, 72, 153, 0.5) 0%, rgba(59, 130, 246, 0.4) 40%, transparent 80%)',
  },
  {
    id: 'soft-glow',
    name: 'Soft Glow',
    background: 'radial-gradient(circle at center, rgba(253, 224, 71, 0.4) 0%, transparent 70%)',
  },
  {
    id: 'sunset-bleed',
    name: 'Sunset Bleed',
    background: 'radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.5) 0%, rgba(249, 115, 22, 0.3) 50%, transparent 90%)',
  },
  {
    id: 'vintage-haze',
    name: 'Vintage Haze',
    background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.4), rgba(16, 185, 129, 0.2) 60%, transparent)',
  },
];

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

export const TexturePanel: React.FC<TexturePanelProps> = ({ adjustments, onChange }) => {
  const grain = adjustments.grain ?? { amount: 0, size: 'medium', colored: false };
  const lightLeak = adjustments.lightLeak ?? { preset: null, opacity: 50 };
  const vignette = adjustments.vignette ?? 0;
  const blend = adjustments.blend ?? {
    photoId: null,
    blendImageSrc: null,
    mode: 'screen',
    opacity: 50,
    fit: 'cover',
  };

  const isDefault = useMemo(() => {
    return (
      grain.amount === 0 &&
      lightLeak.preset === null &&
      vignette === 0 &&
      blend.blendImageSrc === null
    );
  }, [grain, lightLeak, vignette, blend]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      grain: { amount: 0, size: 'medium', colored: false },
      lightLeak: { preset: null, opacity: 50 },
      vignette: 0,
      blend: {
        photoId: null,
        blendImageSrc: null,
        mode: 'screen',
        opacity: 50,
        fit: 'cover',
      },
    });
  };

  // ── Grain handlers ──
  const handleGrainAmountChange = (val: number) => {
    onChange({
      ...adjustments,
      grain: { ...grain, amount: val },
    });
  };

  const handleGrainSizeChange = (size: 'fine' | 'medium' | 'coarse') => {
    onChange({
      ...adjustments,
      grain: { ...grain, size },
    });
  };

  const handleGrainColorToggle = () => {
    onChange({
      ...adjustments,
      grain: { ...grain, colored: !grain.colored },
    });
  };

  // ── Light Leaks handlers ──
  const handleLeakClick = (presetId: string) => {
    onChange({
      ...adjustments,
      lightLeak: {
        ...lightLeak,
        preset: lightLeak.preset === presetId ? null : presetId,
      },
    });
  };

  const handleLeakOpacityChange = (val: number) => {
    onChange({
      ...adjustments,
      lightLeak: { ...lightLeak, opacity: val },
    });
  };

  // ── Vignette handler ──
  const handleVignetteChange = (val: number) => {
    onChange({ ...adjustments, vignette: val });
  };

  // ── Blend handlers ──
  const handlePickImage = async () => {
    const result = await openFileFolderBrowser({
      title: 'Select Overlay Image',
      multiple: false,
      directoryOnly: false,
    });

    if (result && result.paths.length > 0) {
      const filePath = result.paths[0];
      const resolvedSrc = resolveUrl('local://' + filePath);
      
      onChange({
        ...adjustments,
        blend: {
          ...blend,
          photoId: 1,
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

  const handleBlendModeChange = (mode: GlobalCompositeOperation) => {
    onChange({
      ...adjustments,
      blend: { ...blend, mode },
    });
  };

  const handleBlendOpacityChange = (opacity: number) => {
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

  const blendFilename = useMemo(() => {
    if (!blend.blendImageSrc) return '';
    try {
      const decoded = decodeURIComponent(blend.blendImageSrc);
      const parts = decoded.split('/');
      return parts[parts.length - 1] || 'overlay_image';
    } catch {
      return 'overlay_image';
    }
  }, [blend.blendImageSrc]);

  // Compute fill track percentages
  const grainPct = grain.amount;
  const leakPct = lightLeak.opacity;
  const vignettePct = ((vignette + 100) / 200) * 100;
  const vignetteFillLeft = vignette < 0 ? `${50 + vignette / 2}%` : '50%';
  const vignetteFillWidth = `${Math.abs(vignette) / 2}%`;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Texture & Effects
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

      {/* ── Film Grain Section ── */}
      <div className="px-4 pb-6 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Film Grain
        </p>

        <div className="space-y-4">
          {/* Amount slider */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Amount
              </label>
              <span
                className={`text-[10px] font-mono tabular-nums leading-none transition-all duration-200 ${
                  grain.amount > 0 ? 'text-primary scale-110' : 'text-white/20'
                }`}
              >
                {grain.amount}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${grainPct}%`,
                  boxShadow: grain.amount > 0 ? '0 0 8px rgba(var(--color-primary), 0.3)' : 'none',
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={grain.amount}
                onChange={e => handleGrainAmountChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {/* Size buttons */}
          <div className="flex justify-between items-center py-1">
            <span className="text-[11px] font-medium text-white/40">Size</span>
            <div className="flex bg-white/[0.02] border border-white/5 rounded-lg p-0.5">
              {(['fine', 'medium', 'coarse'] as const).map(size => {
                const isActive = grain.size === size;
                return (
                  <button
                    key={size}
                    onClick={() => handleGrainSizeChange(size)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/5'
                        : 'text-white/30 hover:text-white/50 border border-transparent'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color vs Mono Toggle */}
          <div className="flex justify-between items-center py-1">
            <span className="text-[11px] font-medium text-white/40">Colored Grain</span>
            <button
              onClick={handleGrainColorToggle}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
                grain.colored ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                  grain.colored ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Light Leaks Section ── */}
      <div className="px-4 pt-5 pb-6 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Light Leaks
        </p>

        {/* Leaks Grid */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {LEAKS.map(leak => {
            const isActive = lightLeak.preset === leak.id;
            return (
              <button
                key={leak.id}
                onClick={() => handleLeakClick(leak.id)}
                className={`group/leak relative aspect-square rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-end p-2 cursor-pointer ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-lg shadow-black/40'
                    : 'border-white/5 hover:border-white/20 bg-black/40'
                }`}
              >
                {/* Background Leak Gradient Preview */}
                <div
                  className="absolute inset-0 opacity-70 group-hover/leak:opacity-90 transition-opacity"
                  style={{ background: leak.background }}
                />

                {/* Mask overlay for active check */}
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-glow" />
                  </div>
                )}

                <span className="relative z-10 text-[9px] font-bold leading-none tracking-tight text-white/80 group-hover/leak:text-white transition-colors truncate w-full">
                  {leak.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Leak Opacity slider - only visible when a leak is selected */}
        {lightLeak.preset && (
          <div className="group/item transition-all duration-300">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Leak Intensity
              </label>
              <span className="text-[10px] font-mono text-primary scale-110 tabular-nums font-bold">
                {lightLeak.opacity}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                style={{
                  left: '0%',
                  width: `${leakPct}%`,
                  boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                }}
              />
              <input
                type="range"
                min={1}
                max={100}
                value={lightLeak.opacity}
                onChange={e => handleLeakOpacityChange(Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Vignette Section ── */}
      <div className="px-4 pt-5 pb-6 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Vignette
        </p>

        <div className="group/item">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
              Vignette
            </label>
            <span
              className={`text-[10px] font-mono tabular-nums w-10 text-right leading-none transition-all duration-200 ${
                vignette !== 0 ? 'text-primary scale-110' : 'text-white/20'
              }`}
            >
              {vignette > 0 ? `+${vignette}` : vignette}
            </span>
          </div>

          <div className="relative h-4 flex items-center">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              aria-hidden
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
              style={{
                left: vignetteFillLeft,
                width: vignetteFillWidth,
                background: `rgb(var(--color-primary) / ${vignette !== 0 ? 0.8 : 0.2})`,
                boxShadow: vignette !== 0 ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
              }}
            />
            <input
              type="range"
              min={-100}
              max={100}
              value={vignette}
              onChange={e => handleVignetteChange(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>
      </div>

      {/* ── Double Exposure / Blend Section ── */}
      <div className="px-4 pt-5 pb-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          Double Exposure
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
          <>
            {/* Image Thumbnail Card */}
            <div className="relative rounded-2xl border border-white/10 bg-black/40 p-3 flex gap-3 items-center group mb-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-white/5 shrink-0">
                <img
                  src={blend.blendImageSrc}
                  alt="Overlay preview"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 font-medium truncate leading-tight mb-1" title={blendFilename}>
                  {blendFilename}
                </p>
                <button
                  onClick={handlePickImage}
                  className="text-[10px] text-primary/80 hover:text-primary font-bold uppercase tracking-wider"
                >
                  Change...
                </button>
              </div>

              <button
                onClick={handleRemoveImage}
                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
                title="Remove overlay"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Blend Controls */}
            <div className="space-y-5">
              {/* Blend Mode Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-white/40 leading-none select-none">
                  Blend Mode
                </label>
                <div className="relative group">
                  <select
                    value={blend.mode}
                    onChange={e => handleBlendModeChange(e.target.value as GlobalCompositeOperation)}
                    className="w-full appearance-none bg-[#111] border border-white/10 text-white/90 text-xs rounded-xl pl-3 pr-10 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer group-hover:bg-[#161616]"
                  >
                    {BLEND_MODES.map(mode => (
                      <option key={mode.value} value={mode.value} className="bg-[#111] text-white py-2">
                        {mode.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/60 transition-colors">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
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
                      width: `${blend.opacity}%`,
                      boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={blend.opacity}
                    onChange={e => handleBlendOpacityChange(Number(e.target.value))}
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
          </>
        )}
      </div>
    </div>
  );
};
