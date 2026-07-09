/**
 * AdjustPanel.tsx
 * Renders all adjustment sliders, grouped by category.
 * Completely stateless — parent owns the Adjustments object.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { API_BASE } from '../../../constants';
import { Histogram } from './Histogram';
import { CurveEditor } from './CurveEditor';
import { CurveState, DEFAULT_CURVE, isIdentityCurve } from './curves';

type AdjustSliderKey =
  | 'brightness' | 'contrast'   | 'exposure'
  | 'highlights' | 'shadows'    | 'whites'    | 'blacks'
  | 'vibrance'   | 'saturation' | 'hue'       | 'temperature'
  | 'ambiance'   | 'dehaze';

interface AdjItem {
  key:   AdjustSliderKey;
  label: string;
  min:   number;
  max:   number;
  step?: number;
}

interface AdjGroup {
  label: string;
  items: AdjItem[];
}

export const ADJUSTMENT_GROUPS: AdjGroup[] = [
  {
    label: 'Tone',
    items: [
      { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
      { key: 'contrast',   label: 'Contrast',   min: -100, max: 100 },
      { key: 'exposure',   label: 'Exposure',   min: -100, max: 100 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
      { key: 'shadows',    label: 'Shadows',    min: -100, max: 100 },
      { key: 'whites',     label: 'White',      min: -100, max: 100 },
      { key: 'blacks',     label: 'Black',      min: -100, max: 100 },
      { key: 'ambiance',   label: 'Ambiance',   min: -100, max: 100 },
      { key: 'dehaze',     label: 'Dehaze',     min: -100, max: 100 },
    ],
  },
  {
    label: 'Color',
    items: [
      { key: 'vibrance',    label: 'Vibrance',     min: -100, max: 100 },
      { key: 'saturation',  label: 'Saturation',   min: -100, max: 100 },
      { key: 'hue',         label: 'Hue',          min: -180, max: 180 },
      { key: 'temperature', label: 'Temperature',  min: -100, max: 100 },
    ],
  },
];

export const DEFAULT_ADJUST_SLIDERS: Pick<Adjustments, AdjustSliderKey> = {
  brightness:  0,
  contrast:    0,
  exposure:    0,
  highlights:  0,
  shadows:     0,
  whites:      0,
  blacks:      0,
  vibrance:    0,
  saturation:  0,
  hue:         0,
  temperature: 0,
  ambiance:    0,
  dehaze:      0,
};

interface AdjustPanelProps {
  adjustments: Adjustments;
  onChange:    (adj: Adjustments) => void;
  photoId?:    number | string;
  imageSrc?:   string;
  filterString?: string;
}

export const AdjustPanel: React.FC<AdjustPanelProps> = ({ adjustments, onChange, photoId, imageSrc, filterString }) => {
  const [isAutoEnhancing, setIsAutoEnhancing] = useState(false);
  const items = useMemo(() => ADJUSTMENT_GROUPS.flatMap(group => group.items), []);

  const isDefault = useMemo(
    () => items.every(
      item => adjustments[item.key] === DEFAULT_ADJUST_SLIDERS[item.key as keyof typeof DEFAULT_ADJUST_SLIDERS]
    ) && isIdentityCurve(adjustments.curves),
    [items, adjustments],
  );

  const handleReset = () => {
    onChange({ ...adjustments, ...DEFAULT_ADJUST_SLIDERS, curves: DEFAULT_CURVE });
  };

  const handleCurvesChange = useCallback((val: CurveState) => {
    onChange({ ...adjustments, curves: val });
  }, [adjustments, onChange]);

  const handleAutoEnhance = async () => {
    if (!photoId) return;
    setIsAutoEnhancing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/auto-enhance/${photoId}`);
      if (res.ok) {
        const params = await res.json();
        onChange({
          ...adjustments,
          ...params
        });
      }
    } catch (e) {
      console.error("Auto enhance failed", e);
    } finally {
      setIsAutoEnhancing(false);
    }
  };

  const handleChange = useCallback(
    (key: keyof Adjustments, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

  const handleHistogramBlackPoint = useCallback((value: number) => {
    onChange({ ...adjustments, blacks: Math.max(-100, Math.min(100, (adjustments.blacks || 0) + value)) });
  }, [adjustments, onChange]);

  const handleHistogramWhitePoint = useCallback((value: number) => {
    onChange({ ...adjustments, whites: Math.max(-100, Math.min(100, (adjustments.whites || 0) + value)) });
  }, [adjustments, onChange]);

  const handleHistogramReset = useCallback(() => {
    onChange({ ...adjustments, blacks: 0, whites: 0, exposure: 0 });
  }, [adjustments, onChange]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* ── Live histogram ── */}
      {imageSrc && (
        <Histogram
          imageSrc={imageSrc}
          filterString={filterString || 'none'}
          onBlackPointSet={handleHistogramBlackPoint}
          onWhitePointSet={handleHistogramWhitePoint}
          onReset={handleHistogramReset}
        />
      )}

      {/* ── Action buttons ── */}
      <div className="px-4 pt-4 pb-3 flex gap-2">
        <button
          onClick={handleAutoEnhance}
          disabled={!photoId || isAutoEnhancing}
          className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {isAutoEnhancing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Auto Enhance
        </button>

        <button
          onClick={handleReset}
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

      {/* ── Groups ── */}
      {ADJUSTMENT_GROUPS.map(group => (
        <div key={group.label} className="px-4 pb-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
            {group.label}
          </p>

          <div className="space-y-5">
            {group.items.map(item => {
              const val       = adjustments[item.key];
              const range     = item.max - item.min;
              const pct       = ((val - item.min) / range) * 100;
              const isCentered = item.min < 0;   // slider has a centre zero point
              const isChanged  = val !== 0;

              // Fill track position & width
              const fillLeft  = isCentered ? `${Math.min(50, pct)}%` : '0%';
              const fillWidth = isCentered
                ? `${Math.abs(pct - 50)}%`
                : `${pct}%`;

              return (
                <div key={item.key} className="group/item">
                  {/* Label + value */}
                  <div className="flex justify-between items-baseline mb-2">
                    <label
                      htmlFor={`adj-${item.key}`}
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

                  {/* Slider with coloured fill track */}
                  <div className="relative h-4 flex items-center group/slider">
                    {/* Background track */}
                    <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
                    
                    {/* Coloured fill */}
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
                      id={`adj-${item.key}`}
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step ?? 1}
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
      ))}
      
      {/* ── Curves Editor ── */}
      <div className="px-4 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-4">
          Curves
        </p>
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
