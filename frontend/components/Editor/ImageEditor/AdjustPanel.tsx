/**
 * AdjustPanel.tsx
 * Renders all adjustment sliders, grouped by category (LIGHT, TONE CURVE, COLOR) matching the design.
 * Completely stateless — parent owns the Adjustments object.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp, Sun, Pipette } from 'lucide-react';
import { Adjustments } from './filterEngine';
import { apiClient } from '@/services/apiClient';
import { CurveEditor } from './CurveEditor';
import { CurveState, DEFAULT_CURVE, isIdentityCurve } from './curves';

export type AdjustSliderKey =
  | 'brightness' | 'contrast'   | 'exposure'
  | 'highlights' | 'shadows'    | 'whites'    | 'blacks'
  | 'vibrance'   | 'saturation' | 'hue'       | 'temperature'
  | 'tint'       | 'ambiance'   | 'dehaze';

export interface AdjItem {
  key:   AdjustSliderKey;
  label: string;
  min:   number;
  max:   number;
  step?: number;
}

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
  tint:        0,
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

  // Collapsible Accordion states
  const [lightOpen, setLightOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(true);
  const [colorOpen, setColorOpen] = useState(true);

  // Sub-collapsible sections for extra controls (keeps primary list matching screenshot)
  const [showExtraLight, setShowExtraLight] = useState(false);

  const [wbOption, setWbOption] = useState<'as_shot' | 'daylight' | 'cloudy' | 'shade' | 'tungsten' | 'fluorescent' | 'custom'>('as_shot');

  const isDefault = useMemo(() => {
    const keys: (keyof typeof DEFAULT_ADJUST_SLIDERS)[] = [
      'brightness', 'contrast', 'exposure', 'highlights', 'shadows', 'whites', 'blacks',
      'vibrance', 'saturation', 'hue', 'temperature', 'tint', 'ambiance', 'dehaze'
    ];
    return keys.every(k => adjustments[k] === DEFAULT_ADJUST_SLIDERS[k]) && isIdentityCurve(adjustments.curves);
  }, [adjustments]);

  const handleReset = useCallback(() => {
    onChange({ ...adjustments, ...DEFAULT_ADJUST_SLIDERS, curves: DEFAULT_CURVE });
    setWbOption('as_shot');
  }, [onChange, adjustments]);

  const handleCurvesChange = useCallback((val: CurveState) => {
    onChange({ ...adjustments, curves: val });
  }, [adjustments, onChange]);

  const handleAutoEnhance = useCallback(async () => {
    if (!photoId) return;
    setIsAutoEnhancing(true);
    try {
      const params = await apiClient.post<Partial<Adjustments>>(`/api/v1/photos/auto-enhance/${photoId}`, {});
      onChange({
        ...adjustments,
        ...params
      });
    } catch (e) {
      console.error("Auto enhance failed", e);
    } finally {
      setIsAutoEnhancing(false);
    }
  }, [photoId, onChange, adjustments]);

  const handleChange = useCallback(
    (key: keyof Adjustments, value: number) => {
      onChange({ ...adjustments, [key]: value });
      if (key === 'temperature' || key === 'tint') {
        setWbOption('custom');
      }
    },
    [adjustments, onChange],
  );

  const handleWbChange = useCallback((val: typeof wbOption) => {
    setWbOption(val);
    let newTemp = adjustments.temperature;
    let newTint = adjustments.tint;

    switch (val) {
      case 'daylight':
        newTemp = 0; // 5500K equivalent
        newTint = 0;
        break;
      case 'cloudy':
        newTemp = 20; // ~6500K
        newTint = 8;
        break;
      case 'shade':
        newTemp = 40; // ~7500K
        newTint = 15;
        break;
      case 'tungsten':
        newTemp = -60; // ~2800K
        newTint = -10;
        break;
      case 'fluorescent':
        newTemp = -35; // ~3800K
        newTint = -25;
        break;
      case 'as_shot':
      default:
        newTemp = 0;
        newTint = 0;
        break;
    }

    onChange({
      ...adjustments,
      temperature: newTemp,
      tint: newTint,
    });
  }, [adjustments, onChange]);

  // Sliders display helpers
  const formatExposure = (val: number) => {
    const dec = val / 100;
    if (dec > 0) return `+${dec.toFixed(2)}`;
    return dec.toFixed(2);
  };

  const formatTemperature = (val: number) => {
    // Map [-100, 100] to Kelvin [2000, 20000] centered at 5500K
    let k = 5500;
    if (val < 0) {
      k = Math.round(5500 + (val / 100) * 3500); // -100 -> 2000K
    } else {
      k = Math.round(5500 + (val / 100) * 14500); // 100 -> 20000K
    }
    return `${k}K`;
  };

  const formatGeneric = (val: number) => {
    if (val > 0) return `+${val}`;
    return String(val);
  };

  // Check if Curve Editor has any active nodes (i.e. is not straight identity diagonal)
  const hasActiveCurves = !isIdentityCurve(adjustments.curves);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#090a0d] text-white">
      {/* Premium custom range sliders style tag */}
      <style>{`
        .premium-editor-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          border-radius: 99px;
          outline: none;
          cursor: pointer;
          position: relative;
          background: rgba(255, 255, 255, 0.08);
        }
        .premium-editor-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #cccccc;
          cursor: grab;
          border: 1px solid rgba(0, 0, 0, 0.3);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          transition: transform 0.1s ease, background-color 0.1s ease;
          position: relative;
          z-index: 10;
        }
        .premium-editor-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          background: #ffffff;
        }
        .premium-editor-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.1);
          background: #ffffff;
        }
        .premium-editor-slider::-moz-range-thumb {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #cccccc;
          cursor: grab;
          border: 1px solid rgba(0, 0, 0, 0.3);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          transition: transform 0.1s ease, background-color 0.1s ease;
        }
        .premium-editor-slider::-moz-range-track {
          height: 2px;
          border-radius: 99px;
        }
      `}</style>

      {/* ── Action buttons ── */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <button
          onClick={handleAutoEnhance}
          disabled={!photoId || isAutoEnhancing}
          className="flex-[2] flex items-center justify-center gap-1.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] font-medium text-white/95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {isAutoEnhancing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-white/60" />}
          Auto Enhance
        </button>

        <button
          onClick={handleReset}
          disabled={isDefault}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all border ${
            !isDefault
              ? 'border-white/5 text-white/70 hover:text-white hover:bg-white/5 cursor-pointer bg-white/5'
              : 'border-transparent text-white/20 cursor-default'
          }`}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* ── 1. LIGHT ACCORDION ── */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setLightOpen(!lightOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-white/40" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Light</span>
          </div>
          {lightOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </button>

        {lightOpen && (
          <div className="px-4 pb-4 pt-2 space-y-4">
            {([
              { key: 'exposure', label: 'Exposure', min: -100, max: 100, formatter: formatExposure },
              { key: 'contrast', label: 'Contrast', min: -100, max: 100, formatter: formatGeneric },
              { key: 'highlights', label: 'Highlights', min: -100, max: 100, formatter: formatGeneric },
              { key: 'shadows', label: 'Shadows', min: -100, max: 100, formatter: formatGeneric },
              { key: 'whites', label: 'Whites', min: -100, max: 100, formatter: formatGeneric },
              { key: 'blacks', label: 'Blacks', min: -100, max: 100, formatter: formatGeneric },
            ] as const).map(item => {
              const val = adjustments[item.key] ?? 0;
              const pct = ((val + 100) / 200) * 100;
              const fillLeft = `${Math.min(50, pct)}%`;
              const fillWidth = `${Math.abs(pct - 50)}%`;
              const isChanged = val !== 0;

              return (
                <div key={item.key} className="group/item">
                  <div className="flex justify-between items-baseline mb-1">
                    <label htmlFor={`adj-${item.key}`} className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                      {item.label}
                    </label>
                    <span className={`text-[11px] font-mono tabular-nums leading-none ${isChanged ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                      {item.formatter(val)}
                    </span>
                  </div>
                  <div className="relative h-4 flex items-center">
                    <div className="absolute w-full h-[2px] bg-white/10 rounded-full" />
                    <div
                      className="absolute h-[2px] bg-white/70 rounded-full pointer-events-none"
                      style={{
                        left: fillLeft,
                        width: fillWidth,
                      }}
                    />
                    <input
                      id={`adj-${item.key}`}
                      type="range"
                      min={item.min}
                      max={item.max}
                      value={val}
                      onChange={e => handleChange(item.key, Number(e.target.value))}
                      className="premium-editor-slider"
                    />
                  </div>
                </div>
              );
            })}

            {/* Sub-collapsible extra options for other Tone adjusters */}
            <div className="pt-1">
              <button
                onClick={() => setShowExtraLight(!showExtraLight)}
                className="text-[10px] font-medium text-white/30 hover:text-white/50 flex items-center gap-1 cursor-pointer"
              >
                {showExtraLight ? 'Hide details' : 'Show advanced tone settings...'}
              </button>
              
              {showExtraLight && (
                <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
                  {([
                    { key: 'brightness', label: 'Brightness', min: -100, max: 100, formatter: formatGeneric },
                    { key: 'ambiance', label: 'Ambiance', min: -100, max: 100, formatter: formatGeneric },
                    { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, formatter: formatGeneric },
                  ] as const).map(item => {
                    const val = adjustments[item.key] ?? 0;
                    const pct = ((val + 100) / 200) * 100;
                    const fillLeft = `${Math.min(50, pct)}%`;
                    const fillWidth = `${Math.abs(pct - 50)}%`;
                    const isChanged = val !== 0;

                    return (
                      <div key={item.key} className="group/item">
                        <div className="flex justify-between items-baseline mb-1">
                          <label htmlFor={`adj-${item.key}`} className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                            {item.label}
                          </label>
                          <span className={`text-[11px] font-mono tabular-nums leading-none ${isChanged ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                            {item.formatter(val)}
                          </span>
                        </div>
                        <div className="relative h-4 flex items-center">
                          <div className="absolute w-full h-[2px] bg-white/10 rounded-full" />
                          <div
                            className="absolute h-[2px] bg-white/70 rounded-full pointer-events-none"
                            style={{
                              left: fillLeft,
                              width: fillWidth,
                            }}
                          />
                          <input
                            id={`adj-${item.key}`}
                            type="range"
                            min={item.min}
                            max={item.max}
                            value={val}
                            onChange={e => handleChange(item.key, Number(e.target.value))}
                            className="premium-editor-slider"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. TONE CURVE ACCORDION ── */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setCurvesOpen(!curvesOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-white/40" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Tone Curve</span>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveCurves && <span className="text-[10px] text-white/35 font-bold select-none mr-1 font-sans">✓</span>}
            {curvesOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
          </div>
        </button>

        {curvesOpen && (
          <div className="px-4 pb-5 pt-1">
            <CurveEditor
              value={adjustments.curves}
              onChange={handleCurvesChange}
              imageSrc={imageSrc}
              filterString={filterString}
            />
          </div>
        )}
      </div>

      {/* ── 3. COLOR ACCORDION ── */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setColorOpen(!colorOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border border-white/20 bg-gradient-to-tr from-[#ef4444] via-[#22c55e] to-[#3b82f6] opacity-60" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Color</span>
          </div>
          {colorOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </button>

        {colorOpen && (
          <div className="px-4 pb-6 pt-2 space-y-4">
            
            {/* White Balance Select */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[11px] font-medium text-white/50 select-none">White Balance</label>
                <div className="flex items-center gap-2">
                  <button className="text-white/40 hover:text-white/80 transition-colors p-0.5 cursor-pointer">
                    <Pipette size={12} />
                  </button>
                </div>
              </div>
              <div className="relative">
                <select
                  value={wbOption}
                  onChange={e => handleWbChange(e.target.value as any)}
                  className="w-full bg-[#13151a] hover:bg-[#1a1c22] border border-white/5 text-[11px] text-white/80 rounded py-1.5 px-2.5 outline-none cursor-pointer appearance-none transition-colors"
                >
                  <option value="as_shot">As Shot</option>
                  <option value="daylight">Daylight (5500K)</option>
                  <option value="cloudy">Cloudy (~6500K)</option>
                  <option value="shade">Shade (~7500K)</option>
                  <option value="tungsten">Tungsten (~2800K)</option>
                  <option value="fluorescent">Fluorescent (~3800K)</option>
                  <option value="custom">Custom</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
              </div>
            </div>

            {/* Temperature Slider with blue-yellow gradient track */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="adj-temp" className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                  Temperature
                </label>
                <span className={`text-[11px] font-mono tabular-nums leading-none ${adjustments.temperature !== 0 ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                  {formatTemperature(adjustments.temperature ?? 0)}
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <input
                  id="adj-temp"
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.temperature ?? 0}
                  onChange={e => handleChange('temperature', Number(e.target.value))}
                  className="premium-editor-slider"
                  style={{
                    background: 'linear-gradient(to right, #4075c0 0%, #4b5563 50%, #d4b545 100%)',
                  }}
                />
              </div>
            </div>

            {/* Tint Slider with green-magenta gradient track */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="adj-tint" className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                  Tint
                </label>
                <span className={`text-[11px] font-mono tabular-nums leading-none ${adjustments.tint !== 0 ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                  {formatGeneric(adjustments.tint ?? 0)}
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <input
                  id="adj-tint"
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.tint ?? 0}
                  onChange={e => handleChange('tint', Number(e.target.value))}
                  className="premium-editor-slider"
                  style={{
                    background: 'linear-gradient(to right, #389e5a 0%, #4b5563 50%, #c440a2 100%)',
                  }}
                />
              </div>
            </div>

            {/* Vibrance Slider with grey-color gradient track */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="adj-vibrance" className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                  Vibrance
                </label>
                <span className={`text-[11px] font-mono tabular-nums leading-none ${adjustments.vibrance !== 0 ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                  {formatGeneric(adjustments.vibrance ?? 0)}
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <input
                  id="adj-vibrance"
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.vibrance ?? 0}
                  onChange={e => handleChange('vibrance', Number(e.target.value))}
                  className="premium-editor-slider"
                  style={{
                    background: 'linear-gradient(to right, #3c4048 0%, #4d7cc8 50%, #db4545 100%)',
                  }}
                />
              </div>
            </div>

            {/* Saturation Slider with grey-color gradient track */}
            <div className="group/item">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="adj-sat" className="text-[11px] font-medium text-white/50 group-hover/item:text-white/80 cursor-pointer select-none">
                  Saturation
                </label>
                <span className={`text-[11px] font-mono tabular-nums leading-none ${adjustments.saturation !== 0 ? 'text-white/95 font-bold' : 'text-white/20'}`}>
                  {formatGeneric(adjustments.saturation ?? 0)}
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <input
                  id="adj-sat"
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation ?? 0}
                  onChange={e => handleChange('saturation', Number(e.target.value))}
                  className="premium-editor-slider"
                  style={{
                    background: 'linear-gradient(to right, #3c4048 0%, #4d7cc8 50%, #db4545 100%)',
                  }}
                />
              </div>
            </div>

            {/* Extra Color sliders (Hue) */}
            <div className="group/item pt-1">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="adj-hue" className="text-[11px] font-medium text-white/40 cursor-pointer select-none">
                  Hue Rotate
                </label>
                <span className={`text-[11px] font-mono tabular-nums leading-none ${adjustments.hue !== 0 ? 'text-white/95 font-bold' : 'text-white/10'}`}>
                  {adjustments.hue > 0 ? `+${adjustments.hue}` : adjustments.hue}°
                </span>
              </div>
              <div className="relative h-4 flex items-center">
                <input
                  id="adj-hue"
                  type="range"
                  min="-180"
                  max="180"
                  value={adjustments.hue ?? 0}
                  onChange={e => handleChange('hue', Number(e.target.value))}
                  className="premium-editor-slider"
                  style={{
                    background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                  }}
                />
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
