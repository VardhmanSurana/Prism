/**
 * TexturePanel.tsx
 * Renders controls for Film Grain, Light Leaks (presets, custom tint, position), Vignette, and Double Exposure blending.
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { RotateCcw, Trash2, FolderOpen } from 'lucide-react';
import {
  Adjustments,
  DEFAULT_GRAIN,
  DEFAULT_LIGHT_LEAK,
  DEFAULT_BLEND,
} from './filterEngine';
import { openFileFolderBrowser } from '@/services/FileFolderBrowserService';
import { resolveUrl } from '@/constants';
import { EditorSlider } from './ui/EditorSlider';
import {
  LEAKS,
  LEAK_COLORS,
  LEAK_POSITIONS,
  BLEND_MODES,
} from './textureConstants';

interface TexturePanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const TexturePanel: React.FC<TexturePanelProps> = ({ adjustments, onChange }) => {
  const grain = adjustments.grain ?? { ...DEFAULT_GRAIN };
  const lightLeak = adjustments.lightLeak ?? { ...DEFAULT_LIGHT_LEAK };
  const vignette = adjustments.vignette ?? 0;
  const blend = adjustments.blend ?? { ...DEFAULT_BLEND };
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      grain: { ...DEFAULT_GRAIN },
      lightLeak: { ...DEFAULT_LIGHT_LEAK },
      vignette: 0,
      blend: { ...DEFAULT_BLEND },
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

  const handleLeakColorChange = (hex: string) => {
    onChange({
      ...adjustments,
      lightLeak: {
        ...lightLeak,
        color: lightLeak.color === hex ? undefined : hex,
      },
    });
  };

  const handleLeakPositionChange = (pos: any) => {
    onChange({
      ...adjustments,
      lightLeak: {
        ...lightLeak,
        position: lightLeak.position === pos ? undefined : pos,
      },
    });
  };

  // ── Vignette handler ──
  const handleVignetteChange = (val: number) => {
    onChange({ ...adjustments, vignette: val });
  };

  // ── Blend handlers ──
  const handlePickImage = useCallback(async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    
    if (isTauri) {
      try {
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
      } catch {
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [adjustments, blend, onChange]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const objectUrl = URL.createObjectURL(file);
    onChange({
      ...adjustments,
      blend: {
        ...blend,
        photoId: 1,
        blendImageSrc: objectUrl,
      },
    });
    e.target.value = '';
  }, [adjustments, blend, onChange]);

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

  const handleBlendOpacityChange = (val: number) => {
    onChange({
      ...adjustments,
      blend: { ...blend, opacity: val },
    });
  };

  const handleBlendFitChange = (fit: 'cover' | 'contain' | 'center') => {
    onChange({
      ...adjustments,
      blend: { ...blend, fit },
    });
  };

  return (
    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar text-white pb-6 select-none">
      {/* Hidden File Input for Web Mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Texture & Atmosphere
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
          <EditorSlider
            label="Amount"
            value={grain.amount}
            onChange={handleGrainAmountChange}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
          />

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
                    className={`editor-btn editor-chip-btn ${
                      isActive ? 'active' : ''
                    } px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider`}
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

        {/* Leak controls (intensity, tint, position) */}
        {lightLeak.preset && (
          <div className="space-y-4 pt-2 animate-in fade-in duration-200">
            <EditorSlider
              label="Leak Intensity"
              value={lightLeak.opacity}
              onChange={handleLeakOpacityChange}
              min={1}
              max={100}
              defaultValue={80}
              unit="%"
            />

            {/* Custom Tint Color */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-white/40">Custom Tint</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LEAK_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => handleLeakColorChange(c.hex)}
                    title={c.name}
                    className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                      lightLeak.color === c.hex
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:border-white/40'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Position Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-white/40">Position</span>
              <div className="grid grid-cols-2 gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                {LEAK_POSITIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => handleLeakPositionChange(p.value)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors text-left truncate ${
                      lightLeak.position === p.value
                        ? 'bg-primary text-black font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Vignette Section ── */}
      <div className="px-4 pt-5 pb-6 border-b border-white/5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Vignette
        </p>
        <EditorSlider
          label="Vignette"
          value={vignette}
          onChange={handleVignetteChange}
          min={-100}
          max={100}
          defaultValue={0}
        />
      </div>

      {/* ── Double Exposure (Blend) Section ── */}
      <div className="px-4 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
            Double Exposure
          </p>
          {blend.blendImageSrc && (
            <button
              onClick={handleRemoveImage}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={9} /> Remove
            </button>
          )}
        </div>

        {!blend.blendImageSrc ? (
          /* Empty / Upload State */
          <button
            onClick={handlePickImage}
            className="w-full h-24 border border-dashed border-white/10 hover:border-white/30 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
          >
            <FolderOpen
              size={18}
              className="text-white/30 group-hover:text-white/60 transition-colors"
            />
            <span className="text-[10px] font-semibold text-white/40 group-hover:text-white/80 transition-colors">
              Choose Overlay Photo
            </span>
          </button>
        ) : (
          /* Overlay Controls */
          <div className="space-y-4">
            {/* Image Preview & Change button */}
            <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2">
              <img
                src={blend.blendImageSrc}
                alt="Blend Overlay"
                className="w-10 h-10 object-cover rounded-lg border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white/80 truncate">
                  Active Overlay
                </p>
                <button
                  onClick={handlePickImage}
                  className="text-[9px] text-primary hover:underline font-medium"
                >
                  Change Image
                </button>
              </div>
            </div>

            {/* Blend Mode Selection */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-white/40">Blend Mode</span>
              <div className="grid grid-cols-2 gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                {BLEND_MODES.map(m => {
                  const isActive = blend.mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => handleBlendModeChange(m.value)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors text-left truncate ${
                        isActive
                          ? 'bg-primary text-black font-semibold'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opacity Slider */}
            <EditorSlider
              label="Overlay Opacity"
              value={blend.opacity}
              onChange={handleBlendOpacityChange}
              min={0}
              max={100}
              defaultValue={50}
              unit="%"
            />

            {/* Fit Options */}
            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] font-medium text-white/40">Fit Mode</span>
              <div className="flex bg-white/[0.02] border border-white/5 rounded-lg p-0.5">
                {(['cover', 'contain', 'center'] as const).map(fit => {
                  const isActive = blend.fit === fit;
                  return (
                    <button
                      key={fit}
                      onClick={() => handleBlendFitChange(fit)}
                      className={`editor-btn editor-chip-btn ${
                        isActive ? 'active' : ''
                      } px-2 py-1 text-[9px] font-bold uppercase tracking-wider`}
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
    </div>
  );
};
