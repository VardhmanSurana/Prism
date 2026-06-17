/**
 * TiltShiftPanel.tsx
 * Controls for Tilt-Shift / Depth Blur adjustments.
 */

import React, { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';

interface TiltShiftPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const TiltShiftPanel: React.FC<TiltShiftPanelProps> = ({ adjustments, onChange }) => {
  const tiltShift = adjustments.tiltShift ?? {
    enabled: false,
    mode: 'linear',
    blurStrength: 30,
    focusPosition: 50,
    focusWidth: 30,
  };

  const isDefault = useMemo(() => {
    return !tiltShift.enabled;
  }, [tiltShift]);

  const handleReset = () => {
    onChange({
      ...adjustments,
      tiltShift: {
        enabled: false,
        mode: 'linear',
        blurStrength: 30,
        focusPosition: 50,
        focusWidth: 30,
      },
    });
  };

  const handleEnabledToggle = () => {
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

  const handleSliderChange = (key: 'blurStrength' | 'focusPosition' | 'focusWidth', val: number) => {
    onChange({
      ...adjustments,
      tiltShift: { ...tiltShift, [key]: val },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Tilt-Shift
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

      {/* ── Enable Toggle ── */}
      <div className="px-4 pb-5 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Enable Tilt-Shift Blur</span>
        <button
          onClick={handleEnabledToggle}
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

      {/* ── Adjustments ── */}
      {tiltShift.enabled && (
        <div className="px-4 pt-5 pb-6 space-y-5">
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
                onChange={e => handleSliderChange('blurStrength', Number(e.target.value))}
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
                onChange={e => handleSliderChange('focusPosition', Number(e.target.value))}
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
                onChange={e => handleSliderChange('focusWidth', Number(e.target.value))}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>

          {/* Tilt Shift Description */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[9px] text-white/20 leading-relaxed">
              💡 Tilt-shift creates a miniature effect by applying a shallow depth-of-field blur. Linear mode is great for landscapes/cityscapes, while radial mode focuses on subjects/objects in a circle.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
