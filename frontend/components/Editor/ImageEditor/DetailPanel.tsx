/**
 * DetailPanel.tsx
 * Renders Detail controls (Clarity, Sharpness, Noise Reduction) + Tilt-Shift depth blur.
 */

import React, { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { EditorSlider } from './ui/EditorSlider';

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

const DETAIL_GROUPS: DetailGroup[] = [
  {
    label: 'Detail',
    items: [
      { key: 'clarity',        label: 'Clarity',         min: -100, max: 100 },
      { key: 'sharpness',      label: 'Sharpness',       min: -150, max: 150 },
      { key: 'noiseReduction', label: 'Noise Reduction', min: 0,    max: 100 },
    ],
  },
];

const DEFAULT_DETAIL: Pick<Adjustments, DetailKey> = {
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
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">
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
        {DETAIL_GROUPS[0].items.map(item => (
          <EditorSlider
            key={item.key}
            label={item.label}
            value={adjustments[item.key] ?? 0}
            onChange={val => handleChange(item.key, val)}
            min={item.min}
            max={item.max}
            defaultValue={0}
            bipolar={item.min < 0}
          />
        ))}
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
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none cursor-pointer ${
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
          <div className="pt-4 space-y-4">
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
                      className={`editor-btn editor-chip-btn ${
                        isActive ? 'active' : ''
                      } flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blur Strength Slider */}
            <EditorSlider
              label="Blur Strength"
              value={tiltShift.blurStrength}
              onChange={val => handleTiltShiftSliderChange('blurStrength', val)}
              min={0}
              max={100}
              defaultValue={50}
              unit="%"
            />

            {/* Focus Position Slider */}
            <EditorSlider
              label="Focus Position"
              value={tiltShift.focusPosition}
              onChange={val => handleTiltShiftSliderChange('focusPosition', val)}
              min={0}
              max={100}
              defaultValue={50}
              unit="%"
            />

            {/* Focus Width Slider */}
            <EditorSlider
              label="Focus Range"
              value={tiltShift.focusWidth}
              onChange={val => handleTiltShiftSliderChange('focusWidth', val)}
              min={10}
              max={80}
              defaultValue={30}
              unit="%"
            />

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
