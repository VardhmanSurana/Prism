/**
 * HslPanel.tsx
 * Complete Color Suite: HSL 8-Band Color Mixer, White Balance, Basic Color Presence,
 * 3-Way & Log Color Wheels, and Split Toning.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { RotateCcw, ChevronDown, Palette, Sliders, Disc, Sparkles } from 'lucide-react';
import { Adjustments, HslBand, HSL_BAND_DEFAULTS, HslAdjustments, ColorWheelsAdjustments } from './filterEngine';
import { ColorWheelsPanel } from './ColorWheelsPanel';
import { EditorSlider } from './ui/EditorSlider';

// ── Band metadata ────────────────────────────────────────────────────────────

interface BandMeta {
  id: HslBand;
  label: string;
  name: string;
  color: string;
  baseHue: number;
}

const BANDS: BandMeta[] = [
  { id: 'reds',    label: 'R',  name: 'Red',    color: '#ef4444', baseHue: 0 },
  { id: 'oranges', label: 'Or', name: 'Orange', color: '#f97316', baseHue: 30 },
  { id: 'yellows', label: 'Y',  name: 'Yellow', color: '#eab308', baseHue: 60 },
  { id: 'greens',  label: 'G',  name: 'Green',  color: '#22c55e', baseHue: 120 },
  { id: 'aquas',   label: 'Aq', name: 'Aqua',   color: '#06b6d4', baseHue: 180 },
  { id: 'blues',   label: 'B',  name: 'Blue',   color: '#3b82f6', baseHue: 240 },
  { id: 'purples', label: 'Pu', name: 'Purple', color: '#a855f7', baseHue: 280 },
  { id: 'pinks',   label: 'Pk', name: 'Pink',   color: '#ec4899', baseHue: 330 },
];

interface SliderDef {
  key: 'hue' | 'saturation' | 'luminance';
  label: string;
  min: number;
  max: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'hue',        label: 'Hue Shift',   min: -180, max: 180 },
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

type ColorSubTab = 'mixer' | 'basic' | 'grading' | 'toning';

interface HslPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const HslPanel: React.FC<HslPanelProps> = ({ adjustments, onChange }) => {
  const [subTab, setSubTab] = useState<ColorSubTab>('mixer');
  const [activeBand, setActiveBand] = useState<HslBand>('reds');
  const [wbOption, setWbOption] = useState<'as_shot' | 'daylight' | 'cloudy' | 'shade' | 'tungsten' | 'fluorescent' | 'custom'>('as_shot');

  const hsl: HslAdjustments = adjustments.hsl ?? { ...HSL_BAND_DEFAULTS };
  const splitToning = adjustments.splitToning ?? {
    shadows: { hue: 0, saturation: 0 },
    highlights: { hue: 0, saturation: 0 },
    balance: 0,
  };

  const isHslModified = useMemo(() =>
    (Object.keys(hsl) as HslBand[]).some(b =>
      hsl[b].hue !== 0 || hsl[b].saturation !== 0 || hsl[b].luminance !== 0
    ),
    [hsl]
  );

  const isBasicModified = useMemo(() =>
    (adjustments.temperature ?? 0) !== 0 ||
    (adjustments.tint ?? 0) !== 0 ||
    (adjustments.vibrance ?? 0) !== 0 ||
    (adjustments.saturation ?? 0) !== 0 ||
    (adjustments.hue ?? 0) !== 0,
    [adjustments]
  );

  const isToningModified = useMemo(() =>
    splitToning.shadows.saturation !== 0 ||
    splitToning.highlights.saturation !== 0 ||
    splitToning.balance !== 0,
    [splitToning]
  );

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

  const handleResetHslAll = useCallback(() => {
    onChange({
      ...adjustments,
      hsl: { ...HSL_BAND_DEFAULTS },
    });
  }, [adjustments, onChange]);

  const handleResetBasicAll = useCallback(() => {
    onChange({
      ...adjustments,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      saturation: 0,
      hue: 0,
    });
    setWbOption('as_shot');
  }, [adjustments, onChange]);

  const handleResetToningAll = useCallback(() => {
    onChange({
      ...adjustments,
      splitToning: {
        shadows: { hue: 0, saturation: 0 },
        highlights: { hue: 0, saturation: 0 },
        balance: 0,
      },
    });
  }, [adjustments, onChange]);

  const handleBasicChange = useCallback((key: keyof Adjustments, value: number) => {
    onChange({ ...adjustments, [key]: value });
    if (key === 'temperature' || key === 'tint') {
      setWbOption('custom');
    }
  }, [adjustments, onChange]);

  const handleWbPresetChange = useCallback((val: typeof wbOption) => {
    setWbOption(val);
    let newTemp = adjustments.temperature ?? 0;
    let newTint = adjustments.tint ?? 0;
    switch (val) {
      case 'as_shot':     newTemp = 0;   newTint = 0; break;
      case 'daylight':    newTemp = 10;  newTint = 2; break;
      case 'cloudy':      newTemp = 25;  newTint = 5; break;
      case 'shade':       newTemp = 40;  newTint = 8; break;
      case 'tungsten':    newTemp = -35; newTint = -5; break;
      case 'fluorescent': newTemp = -15; newTint = 12; break;
      case 'custom':      break;
    }
    onChange({ ...adjustments, temperature: newTemp, tint: newTint });
  }, [adjustments, onChange]);

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

  const handleColorWheelsChange = useCallback((val: ColorWheelsAdjustments) => {
    onChange({ ...adjustments, colorWheels: val });
  }, [adjustments, onChange]);

  const currentBand = hsl[activeBand];
  const activeMeta = BANDS.find(b => b.id === activeBand)!;
  const activeBaseHue = activeMeta.baseHue ?? 0;
  const currentEffectiveHue = (activeBaseHue + (currentBand.hue || 0) + 360) % 360;
  const dynamicActiveColor = `hsl(${currentEffectiveHue}, 100%, 50%)`;
  const highlightsColor = `hsl(${splitToning.highlights.hue}, ${splitToning.highlights.saturation}%, 50%)`;
  const shadowsColor = `hsl(${splitToning.shadows.hue}, ${splitToning.shadows.saturation}%, 50%)`;

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">
      {/* ── Sub-tab Navigation Header ── */}
      <div className="sticky top-0 z-20 bg-[#0d0f14]/95 backdrop-blur-md px-3 pt-3 pb-2 border-b border-white/5">
        <div className="grid grid-cols-4 gap-1.5 bg-[#12141a] p-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setSubTab('mixer')}
            className={`relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-[10px] font-semibold tracking-tight transition-all select-none cursor-pointer ${
              subTab === 'mixer'
                ? 'bg-white/10 text-white font-bold border border-white/10 shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette size={16} className="shrink-0" />
            <span className="leading-none">Mixer</span>
            {isHslModified && subTab !== 'mixer' && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCBC00] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setSubTab('basic')}
            className={`relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-[10px] font-semibold tracking-tight transition-all select-none cursor-pointer ${
              subTab === 'basic'
                ? 'bg-white/10 text-white font-bold border border-white/10 shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Sliders size={16} className="shrink-0" />
            <span className="leading-none">Basic</span>
            {isBasicModified && subTab !== 'basic' && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCBC00] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setSubTab('grading')}
            className={`relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-[10px] font-semibold tracking-tight transition-all select-none cursor-pointer ${
              subTab === 'grading'
                ? 'bg-white/10 text-white font-bold border border-white/10 shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Disc size={16} className="shrink-0" />
            <span className="leading-none">Wheels</span>
          </button>

          <button
            onClick={() => setSubTab('toning')}
            className={`relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg text-[10px] font-semibold tracking-tight transition-all select-none cursor-pointer ${
              subTab === 'toning'
                ? 'bg-white/10 text-white font-bold border border-white/10 shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Sparkles size={16} className="shrink-0" />
            <span className="leading-none">Split</span>
            {isToningModified && subTab !== 'toning' && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCBC00] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── 1. HSL COLOR MIXER SUB-TAB ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {subTab === 'mixer' && (
        <div className="pt-3">
          {/* Header & Reset actions */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-white/90 tracking-tight select-none">
              Color Band
            </span>
            <div className="flex items-center gap-2.5">
              {isBandModified(activeBand) && (
                <button
                  onClick={handleResetBand}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors cursor-pointer"
                  title="Reset active color band"
                >
                  <RotateCcw size={10} /> Reset Band
                </button>
              )}
              {isHslModified && (
                <button
                  onClick={handleResetHslAll}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
                  title="Reset all 8 color bands"
                >
                  Reset All
                </button>
              )}
            </div>
          </div>

          {/* Circular 8-Color Swatches Picker with Fixed Row Height */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between py-1">
              {BANDS.map(band => {
                const isActive = activeBand === band.id;
                const isModified = isBandModified(band.id);
                const bandEffectiveHue = (band.baseHue + (hsl[band.id]?.hue || 0) + 360) % 360;
                const bandDisplayColor = isModified ? `hsl(${bandEffectiveHue}, 100%, 50%)` : band.color;

                return (
                  <div key={band.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    {/* Fixed 32x32 swatch center */}
                    <div className="w-8 h-8 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setActiveBand(band.id)}
                        className="relative flex items-center justify-center focus:outline-none cursor-pointer active:scale-95 transition-transform"
                        title={band.name}
                      >
                        {isActive ? (
                          /* Active Halo Double Ring */
                          <div className="w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-white/90 ring-offset-2 ring-offset-[#0d0f14] transition-all">
                            <div
                              className="w-4 h-4 rounded-full shadow-sm transition-colors duration-150"
                              style={{ backgroundColor: dynamicActiveColor }}
                            />
                          </div>
                        ) : (
                          /* Inactive Solid Color Dot */
                          <div
                            className="w-5 h-5 rounded-full shadow-sm hover:scale-115 transition-transform cursor-pointer"
                            style={{ backgroundColor: bandDisplayColor }}
                          />
                        )}

                        {/* Modified dot */}
                        {isModified && !isActive && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-[#0d0f14]"
                            style={{ backgroundColor: bandDisplayColor }}
                          />
                        )}
                      </button>
                    </div>

                    {/* Dedicated label slot with fixed height to preserve perfect baseline */}
                    <div className="h-4 flex items-center justify-center">
                      {isActive && (
                        <span className="text-[10.5px] font-semibold text-white/90 select-none tracking-tight animate-in fade-in duration-150">
                          {band.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 px-4 pb-4 border-t border-white/5 pt-4">
            {SLIDERS.map(slider => {
              let trackBg: string | undefined;
              if (slider.key === 'hue') {
                trackBg = `linear-gradient(to right,
                  hsl(${(activeBaseHue - 180 + 360) % 360}, 100%, 50%),
                  hsl(${(activeBaseHue - 90 + 360) % 360}, 100%, 50%),
                  hsl(${activeBaseHue}, 100%, 50%),
                  hsl(${(activeBaseHue + 90) % 360}, 100%, 50%),
                  hsl(${(activeBaseHue + 180) % 360}, 100%, 50%)
                )`;
              } else if (slider.key === 'saturation') {
                trackBg = `linear-gradient(to right, #4b5563, ${dynamicActiveColor})`;
              } else if (slider.key === 'luminance') {
                trackBg = `linear-gradient(to right, #000000, ${dynamicActiveColor}, #ffffff)`;
              }

              return (
                <EditorSlider
                  key={slider.key}
                  label={slider.label}
                  value={currentBand[slider.key]}
                  onChange={val => handleSliderChange(slider.key, val)}
                  min={slider.min}
                  max={slider.max}
                  defaultValue={0}
                  unit={slider.key === 'hue' ? '°' : '%'}
                  bipolar
                  trackBackground={trackBg}
                />
              );
            })}
          </div>

          <div className="mx-4 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-white/40 leading-relaxed">
              Targeted HSL adjustments isolate and refine specific color frequencies without altering surrounding tonalities.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── 2. WHITE BALANCE & BASIC COLOR SUB-TAB ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {subTab === 'basic' && (
        <div className="p-4 space-y-5">
          {/* White Balance Preset Dropdown */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] font-medium text-white/60 select-none">White Balance Preset</label>
              {isBasicModified && (
                <button
                  onClick={handleResetBasicAll}
                  className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={wbOption}
                onChange={e => handleWbPresetChange(e.target.value as any)}
                className="w-full bg-[#13151a] hover:bg-[#1a1c22] border border-white/10 text-[11px] font-medium text-white/90 rounded-lg py-2 px-3 outline-none cursor-pointer appearance-none transition-colors"
              >
                <option value="as_shot">As Shot (Neutral)</option>
                <option value="daylight">Daylight (5500K)</option>
                <option value="cloudy">Cloudy (6500K)</option>
                <option value="shade">Shade (7500K)</option>
                <option value="tungsten">Tungsten (2800K)</option>
                <option value="fluorescent">Fluorescent (3800K)</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
            </div>
          </div>

          {/* Temperature Slider */}
          <EditorSlider
            label="Temperature (Cool / Warm)"
            value={adjustments.temperature ?? 0}
            onChange={val => handleBasicChange('temperature', val)}
            min={-100}
            max={100}
            defaultValue={0}
            trackBackground="linear-gradient(to right, #3b82f6 0%, #4b5563 50%, #f59e0b 100%)"
            bipolar
          />

          {/* Tint Slider */}
          <EditorSlider
            label="Tint (Green / Magenta)"
            value={adjustments.tint ?? 0}
            onChange={val => handleBasicChange('tint', val)}
            min={-100}
            max={100}
            defaultValue={0}
            trackBackground="linear-gradient(to right, #22c55e 0%, #4b5563 50%, #d946ef 100%)"
            bipolar
          />

          {/* Vibrance Slider */}
          <EditorSlider
            label="Vibrance (Smart Saturation)"
            value={adjustments.vibrance ?? 0}
            onChange={val => handleBasicChange('vibrance', val)}
            min={-100}
            max={100}
            defaultValue={0}
            trackBackground="linear-gradient(to right, #374151 0%, #06b6d4 50%, #f43f5e 100%)"
            bipolar
          />

          {/* Saturation Slider */}
          <EditorSlider
            label="Saturation (Global Intensity)"
            value={adjustments.saturation ?? 0}
            onChange={val => handleBasicChange('saturation', val)}
            min={-100}
            max={100}
            defaultValue={0}
            trackBackground="linear-gradient(to right, #1f2937 0%, #6366f1 50%, #ec4899 100%)"
            bipolar
          />

          {/* Hue Rotate Slider */}
          <EditorSlider
            label="Hue Rotation"
            value={adjustments.hue ?? 0}
            onChange={val => handleBasicChange('hue', val)}
            min={-180}
            max={180}
            defaultValue={0}
            unit="°"
            trackBackground="linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)"
            bipolar
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── 3. 3-WAY & LOG COLOR WHEELS SUB-TAB ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {subTab === 'grading' && (
        <div className="p-3">
          <ColorWheelsPanel
            value={adjustments.colorWheels}
            onChange={handleColorWheelsChange}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── 4. SPLIT TONING SUB-TAB ── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {subTab === 'toning' && (
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
              Split Toning Looks
            </span>
            {isToningModified && (
              <button
                onClick={handleResetToningAll}
                className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                <RotateCcw size={10} /> Reset
              </button>
            )}
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-2 gap-2">
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
                  className={`editor-btn editor-card-btn ${
                    isPresetActive ? 'active' : ''
                  } py-2.5 px-3 text-[10.5px] font-medium text-left flex flex-col justify-between h-[52px] rounded-lg border border-white/5 bg-[#13151a] hover:bg-[#1a1c22] transition-colors`}
                >
                  <span className="font-semibold text-white/90">{preset.name}</span>
                  <div className="flex gap-1.5 items-center mt-1">
                    <div
                      className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: `hsl(${preset.highlights.hue}, ${preset.highlights.saturation}%, 50%)` }}
                      title="Highlights Tint"
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: `hsl(${preset.shadows.hue}, ${preset.shadows.saturation}%, 50%)` }}
                      title="Shadows Tint"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Highlights Toning */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full border border-white/20 shadow-sm transition-all"
                style={{ backgroundColor: splitToning.highlights.saturation > 0 ? highlightsColor : 'rgba(255,255,255,0.15)' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Highlights Tone
              </span>
            </div>

            <div className="space-y-3.5">
              <EditorSlider
                label="Highlights Hue"
                value={splitToning.highlights.hue}
                onChange={val => updateHighlights('hue', val)}
                min={0}
                max={360}
                defaultValue={0}
                unit="°"
                trackBackground="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
              />

              <EditorSlider
                label="Highlights Saturation"
                value={splitToning.highlights.saturation}
                onChange={val => updateHighlights('saturation', val)}
                min={0}
                max={100}
                defaultValue={0}
                unit="%"
                trackBackground={`linear-gradient(to right, #4b5563, hsl(${splitToning.highlights.hue}, 100%, 50%))`}
              />
            </div>
          </div>

          {/* Shadows Toning */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full border border-white/20 shadow-sm transition-all"
                style={{ backgroundColor: splitToning.shadows.saturation > 0 ? shadowsColor : 'rgba(255,255,255,0.15)' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Shadows Tone
              </span>
            </div>

            <div className="space-y-3.5">
              <EditorSlider
                label="Shadows Hue"
                value={splitToning.shadows.hue}
                onChange={val => updateShadows('hue', val)}
                min={0}
                max={360}
                defaultValue={0}
                unit="°"
                trackBackground="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
              />

              <EditorSlider
                label="Shadows Saturation"
                value={splitToning.shadows.saturation}
                onChange={val => updateShadows('saturation', val)}
                min={0}
                max={100}
                defaultValue={0}
                unit="%"
                trackBackground={`linear-gradient(to right, #4b5563, hsl(${splitToning.shadows.hue}, 100%, 50%))`}
              />
            </div>
          </div>

          {/* Balance */}
          <div className="pt-2 border-t border-white/5">
            <EditorSlider
              label="Balance (Shadows vs Highlights)"
              value={splitToning.balance}
              onChange={updateBalance}
              min={-100}
              max={100}
              defaultValue={0}
              bipolar
            />
          </div>
        </div>
      )}
    </div>
  );
};
