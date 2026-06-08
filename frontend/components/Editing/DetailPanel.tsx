import React, { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Adjustments,
} from './filterEngine';

// UI Group Definitions

export type DetailKey = 'clarity' | 'sharpness' | 'noiseReduction';

export interface DetailItem {
  key:   DetailKey;
  label: string;
  min:   number;
  max:   number;
}

export interface DetailGroup {
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
  const isDefault =
    adjustments.clarity === DEFAULT_DETAIL.clarity &&
    adjustments.sharpness === DEFAULT_DETAIL.sharpness &&
    adjustments.noiseReduction === DEFAULT_DETAIL.noiseReduction;

  const handleResetDetail = () => {
    onChange({
      ...adjustments,
      ...DEFAULT_DETAIL,
    });
  };

  const handleChange = useCallback(
    (key: DetailKey, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

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
            <div key={item.key}>
              <div className="flex justify-between items-baseline mb-2">
                <label
                  htmlFor={`detail-${item.key}`}
                  className="text-[11px] text-white/55 leading-none select-none cursor-pointer"
                >
                  {item.label}
                </label>
                <span
                  className={`text-[10px] tabular-nums w-9 text-right leading-none transition-colors duration-100 ${
                    isChanged ? 'text-primary' : 'text-white/25'
                  }`}
                >
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>

              <div className="relative h-[14px] flex items-center">
                <div
                  aria-hidden
                  className="absolute h-[2px] rounded-full pointer-events-none"
                  style={{
                    left:       fillLeft,
                    width:      fillWidth,
                    background: `rgba(var(--color-primary), ${isChanged ? 0.75 : 0.25})`,
                    transition: 'width 40ms linear, left 40ms linear',
                  }}
                />
                <input
                  id={`detail-${item.key}`}
                  type="range"
                  min={item.min}
                  max={item.max}
                  value={val}
                  onChange={e => handleChange(item.key, Number(e.target.value))}
                  className="adjustment-slider"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
