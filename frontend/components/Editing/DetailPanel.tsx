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
    </div>
  );
};
