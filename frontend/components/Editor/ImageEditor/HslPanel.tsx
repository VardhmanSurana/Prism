/**
 * HslPanel.tsx
 * Per-band HSL Color Mixer panel + Split Toning.
 *
 * 8 color band chips across the top. Active band shows 3 sliders:
 * Hue shift, Saturation, Luminance.
 * A dot badge appears on band chips when they have non-zero values.
 * Split Toning section at the bottom for highlight/shadow color toning.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments, HslBand, HSL_BAND_DEFAULTS, HslAdjustments } from './filterEngine';

// ── Band metadata ────────────────────────────────────────────────────────────

interface BandMeta {
  id: HslBand;
  label: string;
  color: string; // Tailwind-compatible or raw CSS color for the chip dot
}

const BANDS: BandMeta[] = [
  { id: 'reds',    label: 'R',  color: '#ef4444' },
  { id: 'oranges', label: 'Or', color: '#f97316' },
  { id: 'yellows', label: 'Y',  color: '#eab308' },
  { id: 'greens',  label: 'G',  color: '#22c55e' },
  { id: 'aquas',   label: 'Aq', color: '#06b6d4' },
  { id: 'blues',   label: 'B',  color: '#3b82f6' },
  { id: 'purples', label: 'Pu', color: '#a855f7' },
  { id: 'pinks',   label: 'Pk', color: '#ec4899' },
];

interface SliderDef {
  key: 'hue' | 'saturation' | 'luminance';
  label: string;
  min: number;
  max: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'hue',        label: 'Hue',        min: -180, max: 180 },
  { key: 'saturation', label: 'Saturation',  min: -100, max: 100 },
  { key: 'luminance',  label: 'Luminance',   min: -100, max: 100 },
];

// ── Split Toning Presets ─────────────────────────────────────────────────────

const SPLIT_PRESETS = [
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

// ── Component ────────────────────────────────────────────────────────────────

interface HslPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const HslPanel: React.FC<HslPanelProps> = ({ adjustments, onChange }) => {
  const [activeBand, setActiveBand] = useState<HslBand>('reds');

  const hsl: HslAdjustments = adjustments.hsl ?? { ...HSL_BAND_DEFAULTS };
  const splitToning = adjustments.splitToning ?? {
    shadows: { hue: 0, saturation: 0 },
    highlights: { hue: 0, saturation: 0 },
    balance: 0,
  };

  const isAllDefault = useMemo(() =>
    (Object.keys(hsl) as HslBand[]).every(b =>
      hsl[b].hue === 0 && hsl[b].saturation === 0 && hsl[b].luminance === 0
    ) && splitToning.shadows.saturation === 0 &&
      splitToning.highlights.saturation === 0 &&
      splitToning.balance === 0,
    [hsl, splitToning]);

  const isBandModified = useCallback((band: HslBand) => {
    const b = hsl[band];
    return b.hue !== 0 || b.saturation !== 0 || b.luminance !== 0;
  }, [hsl]);

  const handleSliderChange = useCallback((key: 'hue' | 'saturation' | 'luminance', value: number) => {
    const newHsl: HslAdjustments = {
      ...hsl,
      [activeBand]: { ...hsl[activeBand], [key]: value },
    };
    onChange({ ...adjustments, hsl: newHsl });
  }, [hsl, activeBand, adjustments, onChange]);

  const handleResetBand = useCallback(() => {
    const newHsl: HslAdjustments = {
      ...hsl,
      [activeBand]: { hue: 0, saturation: 0, luminance: 0 },
    };
    onChange({ ...adjustments, hsl: newHsl });
  }, [hsl, activeBand, adjustments, onChange]);

  const handleResetAll = useCallback(() => {
    onChange({
      ...adjustments,
      hsl: { ...HSL_BAND_DEFAULTS },
      splitToning: {
        shadows: { hue: 0, saturation: 0 },
        highlights: { hue: 0, saturation: 0 },
        balance: 0,
      },
    });
  }, [adjustments, onChange]);

  // ── Split Toning handlers ──
  const handleSplitPresetClick = (preset: typeof SPLIT_PRESETS[0]) => {
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

  const currentBand = hsl[activeBand];
  const activeMeta = BANDS.find(b => b.id === activeBand)!;

  const highlightsColor = `hsl(${splitToning.highlights.hue}, ${splitToning.highlights.saturation}%, 50%)`;
  const shadowsColor = `hsl(${splitToning.shadows.hue}, ${splitToning.shadows.saturation}%, 50%)`;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">


      {/* ── Band chip selector ── */}
      <div className="px-4 pt-1 pb-4">
        <div className="flex gap-1.5 flex-wrap">
          {BANDS.map(band => {
            const isActive = activeBand === band.id;
            const isModified = isBandModified(band.id);
            return (
              <button
                key={band.id}
                onClick={() => setActiveBand(band.id)}
                className={`relative flex items-center justify-center w-9 h-8 rounded border transition-all duration-150 select-none cursor-pointer text-[10.5px] font-semibold tracking-wide ${
                  isActive
                    ? 'text-white font-bold'
                    : 'bg-[#12141a] border-white/5 text-white/50 hover:text-white hover:bg-[#181b24] hover:border-white/10'
                }`}
                style={isActive ? {
                  background: band.color,
                  borderColor: band.color,
                  boxShadow: `0 0 8px ${band.color}50`,
                } : {}}
                title={band.id.charAt(0).toUpperCase() + band.id.slice(1)}
              >
                {band.label}
                {isModified && !isActive && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: band.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active band label + reset ── */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: activeMeta.color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
            {activeBand.charAt(0).toUpperCase() + activeBand.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBandModified(activeBand) && (
            <button
              onClick={handleResetBand}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/60 transition-colors"
            >
              <RotateCcw size={9} /> Reset Band
            </button>
          )}
          {!isAllDefault && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/15 hover:text-red-400 transition-colors"
            >
              All
            </button>
          )}
        </div>
      </div>

      {/* ── Sliders ── */}
      <div className="px-4 pb-6 space-y-5">
        {SLIDERS.map(slider => {
          const val = currentBand[slider.key];
          const range = slider.max - slider.min;
          const pct = ((val - slider.min) / range) * 100;
          const isCentered = slider.min < 0;
          const isChanged = val !== 0;

          const fillLeft  = isCentered ? `${Math.min(50, pct)}%` : '0%';
          const fillWidth = isCentered ? `${Math.abs(pct - 50)}%` : `${pct}%`;

          return (
            <div key={slider.key} className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none transition-colors">
                  {slider.label}
                </label>
                <span
                  className={`text-[10px] font-mono tabular-nums w-10 text-right leading-none transition-all duration-200 ${
                    isChanged ? 'scale-110' : 'text-white/20'
                  }`}
                  style={isChanged ? { color: activeMeta.color } : {}}
                >
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>

              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  aria-hidden
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                  style={{
                    left: fillLeft,
                    width: fillWidth,
                    background: isChanged ? activeMeta.color : `rgba(255,255,255,0.1)`,
                    boxShadow: isChanged ? `0 0 8px ${activeMeta.color}60` : 'none',
                  }}
                />
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={1}
                  value={val}
                  onChange={e => handleSliderChange(slider.key, Number(e.target.value))}
                  className="adjustment-slider"
                  style={{
                    // Tint the thumb with the band's color when changed
                    ['--thumb-color' as string]: isChanged ? activeMeta.color : 'white',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Info tip ── */}
      <div className="mx-4 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <p className="text-[9px] text-white/25 leading-relaxed">
          Adjustments target only pixels within the selected color range. Other colors are unaffected.
        </p>
      </div>

      {/* ── Split Toning Section ── */}
      <div className="px-4 pt-2 pb-6 border-t border-white/5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
            Split Toning
          </span>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {SPLIT_PRESETS.map(preset => {
            const isPresetActive =
              splitToning.highlights.hue === preset.highlights.hue &&
              splitToning.highlights.saturation === preset.highlights.saturation &&
              splitToning.shadows.hue === preset.shadows.hue &&
              splitToning.shadows.saturation === preset.shadows.saturation &&
              splitToning.balance === preset.balance;

            return (
              <button
                key={preset.name}
                onClick={() => handleSplitPresetClick(preset)}
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

        {/* Highlights Toning */}
        <div className="mb-5">
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

        {/* Shadows Toning */}
        <div className="mb-5">
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

        {/* Balance */}
        <div>
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
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
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
    </div>
  );
};
