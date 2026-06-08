import React, { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Adjustments, DEFAULT_ADJUSTMENTS } from './filterEngine';
import { CurveEditor, CurveState, DEFAULT_CURVE } from './CurveEditor';

// UI Group Definitions
// Note: 'curves' is intentionally NOT a numeric slider here — it has its own
// editor (`<CurveEditor />`) rendered separately below the numeric controls.

export type EffectsSliderKey = 'vignette';

export interface EffectsItem {
  key:   EffectsSliderKey;
  label: string;
  min:   number;
  max:   number;
}

export interface EffectsGroup {
  label: string;
  items: EffectsItem[];
}

export const EFFECTS_GROUPS: EffectsGroup[] = [
  {
    label: 'Effects',
    items: [
      { key: 'vignette', label: 'Vignette', min: -100, max: 100 },
    ],
  },
];

export const DEFAULT_EFFECTS_SLIDERS: Pick<Adjustments, EffectsSliderKey> = {
  vignette: 0,
};

interface EffectsPanelProps {
  adjustments: Adjustments;
  onChange:    (adj: Adjustments) => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ adjustments, onChange }) => {
  const isDefault =
    adjustments.ambiance === DEFAULT_ADJUSTMENTS.ambiance &&
    adjustments.curves === DEFAULT_CURVE &&
    adjustments.vignette === DEFAULT_EFFECTS_SLIDERS.vignette;

  const handleResetEffects = () => {
    onChange({
      ...adjustments,
      ...DEFAULT_EFFECTS_SLIDERS,
      curves: DEFAULT_CURVE,
    });
  };

  const handleChange = useCallback(
    (key: EffectsSliderKey, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

  const handleCurvesChange = useCallback((val: CurveState) => {
    onChange({ ...adjustments, curves: val });
  }, [adjustments, onChange]);

  const items = useMemo(() => EFFECTS_GROUPS.flatMap(group => group.items), []);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Action buttons ── */}
      <div className="px-4 pt-4 pb-3 flex gap-2">
        <button
          onClick={handleResetEffects}
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

      {/* ── Numeric Sliders ── */}
      <div className="px-4 pb-5 space-y-5">
        {items.map(item => {
          const val       = (adjustments[item.key] as number) ?? 0;
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
                  htmlFor={`effects-${item.key}`}
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
                  id={`effects-${item.key}`}
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

      {/* ── Curves Editor (own block, not a numeric slider) ── */}
      <div className="px-4 pb-5">
        <div className="pt-2 pb-4">
          <CurveEditor
            value={adjustments.curves}
            onChange={handleCurvesChange}
          />
        </div>
      </div>
    </div>
  );
};
