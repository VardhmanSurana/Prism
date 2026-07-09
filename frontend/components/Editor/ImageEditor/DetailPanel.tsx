/**
 * DetailPanel.tsx
 * Renders Detail controls (Clarity, Sharpness, Noise Reduction) + Tilt-Shift depth blur.
 */

import React, { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';

// UI Group Definitions

type DetailKey = 'clarity' | 'sharpness' | 'noiseReduction';

interface DetailItem {
  key:   DetailKey;
  label: string;
  min:   number;
  max:   number;
}

interface DetailGroup {
  label: string;
  items: DetailItem[];
}

export const DETAIL_GROUPS: DetailGroup[] = [
  {
    label: 'Detail',
    items: [
      { key: 'clarity',        label: 'Clarity',         min: -100, max: 100 },
      { key: 'sharpness',      label: 'Sharpness',       min: -150, max: 150 },
      { key: 'noiseReduction', label: 'Noise Reduction', min: 0,    max: 100 },
    ],
  },
];

export const DEFAULT_DETAIL: Pick<Adjustments, DetailKey> = {
  clarity:        0,
  sharpness:      0,
  noiseReduction: 0,
};

interface DetailPanelProps {
  adjustments: Adjustments;
  onChange:    (adj: Adjustments) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ adjustments, onChange }) => {
  const tiltShift = adjustments.tiltShift ?? {
    enabled: false,
    mode: 'linear',
    blurStrength: 30,
    focusPosition: 50,
    focusWidth: 30,
  };

  const isDefault = useMemo(() => {
    return (
      adjustments.clarity === DEFAULT_DETAIL.clarity &&
      adjustments.sharpness === DEFAULT_DETAIL.sharpness &&
      adjustments.noiseReduction === DEFAULT_DETAIL.noiseReduction &&
      !tiltShift.enabled
    );
  }, [adjustments, tiltShift]);

  const handleResetDetail = () => {
    onChange({
      ...adjustments,
      ...DEFAULT_DETAIL,
      tiltShift: {
        enabled: false,
        mode: 'linear',
        blurStrength: 30,
        focusPosition: 50,
        focusWidth: 30,
      },
    });
  };

  const handleChange = useCallback(
    (key: DetailKey, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

  // ── Tilt-Shift handlers ──
  const handleTiltShiftToggle = () => {
    onChange({
      ...adjustments,
      tiltShift: { ...tiltShift, enabled: !tiltShift.enabled },
    });
  };

  const handleModeChange = (mode: 'linear' | 'radial') => {
    onChange({
      ...adjustments,
      tiltShift: { ...tiltShift, mode },
    });
  };

  const handleTiltShiftSliderChange = (key: 'blurStrength' | 'focusPosition' | 'focusWidth', val: number) => {
    onChange({
      ...adjustments,
      tiltShift: { ...tiltShift, [key]: val },
    });
  };

  const items = useMemo(() => DETAIL_GROUPS.flatMap(group => group.items), []);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Action buttons ── */}
      <div className="px-4 pt-4 pb-3 flex gap-2">
        <button
          onClick={handleResetDetail}
          disabled={isDefault}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${
            !isDefault
              ? 'border-white/10 text-white/50 hover:text-white hover:bg-white/5 cursor-pointer'
              : 'border-transparent text-white/15 cursor-default'
          }`}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* ── Detail Sliders ── */}
      <div className="px-4 pb-5 space-y-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Detail Controls
        </p>

        {items.map(item => {
          const val       = adjustments[item.key] ?? 0;
          const range     = item.max - item.min;
          const pct       = ((val - item.min) / range) * 100;
          const isCentered = item.min < 0;
          const isChanged  = val !== 0;

          const fillLeft  = isCentered ? `${Math.min(50, pct)}%` : '0%';
          const fillWidth = isCentered
            ? `${Math.abs(pct - 50)}%`
            : `${pct}%`;

          return (
            <div key={item.key} className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label
                  htmlFor={`detail-${item.key}`}
                  className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors"
                >
                  {item.label}
                </label>
                <span
                  className={`text-[10px] font-mono tabular-nums w-10 text-right leading-none transition-all duration-200 ${
                    isChanged ? 'text-primary scale-110' : 'text-white/20'
                  }`}
                >
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>

              <div className="relative h-4 flex items-center group/slider">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  aria-hidden
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                  style={{
                    left:       fillLeft,
                    width:      fillWidth,
                    background: `rgb(var(--color-primary) / ${isChanged ? 0.8 : 0.2})`,
                    boxShadow: isChanged ? `0 0 8px rgb(var(--color-primary) / 0.3)` : 'none',
                  }}
                />
                <input
                  id={`detail-${item.key}`}
                  type="range"
                  min={item.min}
                  max={item.max}
                  value={val}
                  onChange={e => handleChange(item.key, Number(e.target.value))}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tilt-Shift Section ── */}
      <div className="px-4 pt-2 pb-6 border-t border-white/5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
            Tilt-Shift
          </span>
        </div>

        {/* Enable Toggle */}
        <div className="pb-5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/80">Enable Tilt-Shift Blur</span>
          <button
            onClick={handleTiltShiftToggle}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
              tiltShift.enabled ? 'bg-primary' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                tiltShift.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Adjustments */}
        {tiltShift.enabled && (
          <div className="pt-5 space-y-5">
            {/* Mode Toggle */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-white/40">Blur Type</span>
              <div className="flex bg-white/[0.02] border border-white/5 rounded-xl p-0.5 w-full">
                {(['linear', 'radial'] as const).map(mode => {
                  const isActive = tiltShift.mode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => handleModeChange(mode)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-white/10 text-white border border-white/5 shadow-inner'
                          : 'text-white/30 hover:text-white/50 border border-transparent'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blur Strength Slider */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                  Blur Strength
                </label>
                <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                  {tiltShift.blurStrength}%
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                  style={{
                    left: '0%',
                    width: `${tiltShift.blurStrength}%`,
                    boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={tiltShift.blurStrength}
                  onChange={e => handleTiltShiftSliderChange('blurStrength', Number(e.target.value))}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>

            {/* Focus Position Slider */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                  Focus Position
                </label>
                <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                  {tiltShift.focusPosition}%
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                  style={{
                    left: '0%',
                    width: `${tiltShift.focusPosition}%`,
                    boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={tiltShift.focusPosition}
                  onChange={e => handleTiltShiftSliderChange('focusPosition', Number(e.target.value))}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>

            {/* Focus Width Slider */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 leading-none select-none cursor-pointer transition-colors">
                  Focus Range
                </label>
                <span className="text-[10px] font-mono text-primary scale-110 font-bold tabular-nums">
                  {tiltShift.focusWidth}%
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                <div
                  className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300 bg-primary/80"
                  style={{
                    left: '0%',
                    width: `${tiltShift.focusWidth}%`,
                    boxShadow: '0 0 8px rgba(var(--color-primary), 0.3)',
                  }}
                />
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={tiltShift.focusWidth}
                  onChange={e => handleTiltShiftSliderChange('focusWidth', Number(e.target.value))}
                  className="adjustment-slider slider-thumb-premium"
                />
              </div>
            </div>

            {/* Tilt Shift Description */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-[9px] text-white/20 leading-relaxed">
                Tilt-shift creates a miniature effect by applying a shallow depth-of-field blur. Linear mode is great for landscapes/cityscapes, while radial mode focuses on subjects/objects in a circle.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
