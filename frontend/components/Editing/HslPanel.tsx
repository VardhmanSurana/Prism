/**
 * HslPanel.tsx
 * Per-band HSL Color Mixer panel.
 *
 * 8 color band chips across the top. Active band shows 3 sliders:
 * Hue shift, Saturation, Luminance.
 * A dot badge appears on band chips when they have non-zero values.
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

// ── Component ────────────────────────────────────────────────────────────────

interface HslPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const HslPanel: React.FC<HslPanelProps> = ({ adjustments, onChange }) => {
  const [activeBand, setActiveBand] = useState<HslBand>('reds');

  const hsl: HslAdjustments = adjustments.hsl ?? { ...HSL_BAND_DEFAULTS };

  const isAllDefault = useMemo(() =>
    (Object.keys(hsl) as HslBand[]).every(b =>
      hsl[b].hue === 0 && hsl[b].saturation === 0 && hsl[b].luminance === 0
    ), [hsl]);

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
    onChange({ ...adjustments, hsl: { ...HSL_BAND_DEFAULTS } });
  }, [adjustments, onChange]);

  const currentBand = hsl[activeBand];
  const activeMeta = BANDS.find(b => b.id === activeBand)!;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">


      {/* ── Band chip selector ── */}
      <div className="px-4 pt-1 pb-4">
        <div className="flex gap-1.5 flex-wrap">
          {BANDS.map(band => {
            const isActive = activeBand === band.id;
            const isModified = isBandModified(band.id);
            return (
              <div
                key={band.id}
                onClick={() => setActiveBand(band.id)}
                className={`relative flex items-center justify-center w-9 h-9 rounded-xl text-[10px] font-bold transition-all duration-200 select-none ${
                  isActive
                    ? 'text-white shadow-lg scale-110'
                    : 'bg-white/[0.03] text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                style={isActive ? {
                  background: band.color,
                  boxShadow: `0 0 16px ${band.color}60`,
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
              </div>
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
    </div>
  );
};
