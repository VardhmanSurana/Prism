/**
 * SplitToningPanel.tsx
 * Allows separate color toning for Highlights and Shadows, with a balance slider.
 */

import React, { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';

interface SplitToningPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

const PRESETS = [
  {
    name: 'Teal & Orange',
    highlights: { hue: 35, saturation: 25 },
    shadows: { hue: 210, saturation: 30 },
    balance: 0,
  },
  {
    name: 'Warm & Cool',
    highlights: { hue: 45, saturation: 20 },
    shadows: { hue: 220, saturation: 20 },
    balance: 10,
  },
  {
    name: 'Sepia Tone',
    highlights: { hue: 40, saturation: 15 },
    shadows: { hue: 35, saturation: 35 },
    balance: -20,
  },
  {
    name: 'Cyberpunk',
    highlights: { hue: 320, saturation: 40 },
    shadows: { hue: 190, saturation: 45 },
    balance: 0,
  },
];

export const SplitToningPanel: React.FC<SplitToningPanelProps> = ({ adjustments, onChange }) => {
  const splitToning = adjustments.splitToning ?? {
    shadows: { hue: 0, saturation: 0 },
    highlights: { hue: 0, saturation: 0 },
    balance: 0,
  };

  const isDefault = useMemo(() => {
    return (
      splitToning.shadows.saturation === 0 &&
      splitToning.highlights.saturation === 0 &&
      splitToning.balance === 0
    );
  }, [splitToning]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      splitToning: {
        shadows: { hue: 0, saturation: 0 },
        highlights: { hue: 0, saturation: 0 },
        balance: 0,
      },
    });
  };

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    onChange({
      ...adjustments,
      splitToning: {
        highlights: { ...preset.highlights },
        shadows: { ...preset.shadows },
        balance: preset.balance,
      },
    });
  };

  const updateHighlights = useCallback((key: 'hue' | 'saturation', value: number) => {
    onChange({
      ...adjustments,
      splitToning: {
        ...splitToning,
        highlights: {
          ...splitToning.highlights,
          [key]: value,
        },
      },
    });
  }, [splitToning, adjustments, onChange]);

  const updateShadows = useCallback((key: 'hue' | 'saturation', value: number) => {
    onChange({
      ...adjustments,
      splitToning: {
        ...splitToning,
        shadows: {
          ...splitToning.shadows,
          [key]: value,
        },
      },
    });
  }, [splitToning, adjustments, onChange]);

  const updateBalance = useCallback((value: number) => {
    onChange({
      ...adjustments,
      splitToning: {
        ...splitToning,
        balance: value,
      },
    });
  }, [splitToning, adjustments, onChange]);

  // Color previews
  const highlightsColor = `hsl(${splitToning.highlights.hue}, ${splitToning.highlights.saturation}%, 50%)`;
  const shadowsColor = `hsl(${splitToning.shadows.hue}, ${splitToning.shadows.saturation}%, 50%)`;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Split Toning
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

      {/* ── Presets Grid ── */}
      <div className="px-4 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-2.5">
          Quick Looks
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(preset => {
            const isPresetActive =
              splitToning.highlights.hue === preset.highlights.hue &&
              splitToning.highlights.saturation === preset.highlights.saturation &&
              splitToning.shadows.hue === preset.shadows.hue &&
              splitToning.shadows.saturation === preset.shadows.saturation &&
              splitToning.balance === preset.balance;

            return (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset)}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-medium transition-all text-left flex flex-col justify-between h-[48px] border ${
                  isPresetActive
                    ? 'border-primary bg-primary/5 text-white'
                    : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                <span>{preset.name}</span>
                <div className="flex gap-1 items-center mt-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-white/10"
                    style={{ backgroundColor: `hsl(${preset.highlights.hue}, ${preset.highlights.saturation}%, 50%)` }}
                    title="Highlights Tint"
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-white/10"
                    style={{ backgroundColor: `hsl(${preset.shadows.hue}, ${preset.shadows.saturation}%, 50%)` }}
                    title="Shadows Tint"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Highlights Toning ── */}
      <div className="px-4 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-3 h-3 rounded-full border border-white/10 shadow-sm transition-all duration-300"
            style={{ backgroundColor: splitToning.highlights.saturation > 0 ? highlightsColor : 'rgba(255,255,255,0.1)' }}
          />
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
            Highlights
          </p>
        </div>

        <div className="space-y-4">
          {/* Hue */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Hue
              </label>
              <span className="text-[10px] font-mono text-white/20 tabular-nums">
                {splitToning.highlights.hue}°
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div
                className="absolute w-full h-[3px] rounded-full"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
              />
              <input
                type="range"
                min={0}
                max={360}
                value={splitToning.highlights.hue}
                onChange={e => updateHighlights('hue', Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium relative z-10"
              />
            </div>
          </div>

          {/* Saturation */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Saturation
              </label>
              <span
                className={`text-[10px] font-mono tabular-nums leading-none transition-all duration-200 ${
                  splitToning.highlights.saturation > 0 ? 'text-primary scale-110' : 'text-white/20'
                }`}
              >
                {splitToning.highlights.saturation}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div
                className="absolute w-full h-[3px] rounded-full"
                style={{
                  background: `linear-gradient(to right, #808080, hsl(${splitToning.highlights.hue}, 100%, 50%))`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={splitToning.highlights.saturation}
                onChange={e => updateHighlights('saturation', Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium relative z-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Shadows Toning ── */}
      <div className="px-4 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-3 h-3 rounded-full border border-white/10 shadow-sm transition-all duration-300"
            style={{ backgroundColor: splitToning.shadows.saturation > 0 ? shadowsColor : 'rgba(255,255,255,0.1)' }}
          />
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">
            Shadows
          </p>
        </div>

        <div className="space-y-4">
          {/* Hue */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Hue
              </label>
              <span className="text-[10px] font-mono text-white/20 tabular-nums">
                {splitToning.shadows.hue}°
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div
                className="absolute w-full h-[3px] rounded-full"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
              />
              <input
                type="range"
                min={0}
                max={360}
                value={splitToning.shadows.hue}
                onChange={e => updateShadows('hue', Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium relative z-10"
              />
            </div>
          </div>

          {/* Saturation */}
          <div className="group/item">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                Saturation
              </label>
              <span
                className={`text-[10px] font-mono tabular-nums leading-none transition-all duration-200 ${
                  splitToning.shadows.saturation > 0 ? 'text-primary scale-110' : 'text-white/20'
                }`}
              >
                {splitToning.shadows.saturation}%
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              <div
                className="absolute w-full h-[3px] rounded-full"
                style={{
                  background: `linear-gradient(to right, #808080, hsl(${splitToning.shadows.hue}, 100%, 50%))`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={splitToning.shadows.saturation}
                onChange={e => updateShadows('saturation', Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium relative z-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Balance ── */}
      <div className="px-4 pb-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Balance
        </p>

        <div className="group/item">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
              Balance (Shadows vs Highlights)
            </label>
            <span
              className={`text-[10px] font-mono tabular-nums w-10 text-right leading-none transition-all duration-200 ${
                splitToning.balance !== 0 ? 'text-primary scale-110' : 'text-white/20'
              }`}
            >
              {splitToning.balance > 0 ? `+${splitToning.balance}` : splitToning.balance}
            </span>
          </div>

          <div className="relative h-4 flex items-center">
            {/* Background track */}
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            
            {/* Coloured fill */}
            <div
              aria-hidden
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
              style={{
                left: splitToning.balance < 0 ? `${(splitToning.balance + 100) / 2}%` : '50%',
                width: `${Math.abs(splitToning.balance) / 2}%`,
                boxShadow: splitToning.balance !== 0 ? `0 0 8px rgba(var(--color-primary), 0.3)` : 'none',
              }}
            />
            <input
              type="range"
              min={-100}
              max={100}
              value={splitToning.balance}
              onChange={e => updateBalance(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
