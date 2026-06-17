/**
 * TexturePanel.tsx
 * Renders controls for Film Grain and Light Leaks.
 */

import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';

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

export const TexturePanel: React.FC<TexturePanelProps> = ({ adjustments, onChange }) => {
  const grain = adjustments.grain ?? { amount: 0, size: 'medium', colored: false };
  const lightLeak = adjustments.lightLeak ?? { preset: null, opacity: 50 };

  const isDefault = useMemo(() => {
    return grain.amount === 0 && lightLeak.preset === null;
  }, [grain, lightLeak]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      grain: { amount: 0, size: 'medium', colored: false },
      lightLeak: { preset: null, opacity: 50 },
    });
  };

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

  // Compute fill track percentages
  const grainPct = grain.amount;
  const leakPct = lightLeak.opacity;

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
      <div className="px-4 pt-5 pb-6">
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
    </div>
  );
};
