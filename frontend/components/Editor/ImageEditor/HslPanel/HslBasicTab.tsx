/**
 * HslBasicTab.tsx
 * White balance preset dropdown + temperature, tint, vibrance, saturation, hue rotation.
 */
import React from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Adjustments } from '../filterEngine';
import { EditorSlider } from '../ui/EditorSlider';
import { WbOption } from './bands';

export interface HslBasicTabProps {
  adjustments: Adjustments;
  wbOption: WbOption;
  isBasicModified: boolean;
  onBasicChange: (key: keyof Adjustments, value: number) => void;
  onWbPresetChange: (val: WbOption) => void;
  onResetAll: () => void;
}

export const HslBasicTab: React.FC<HslBasicTabProps> = (p) => (
  <div className="p-4 space-y-5">
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-[11px] font-medium text-white/60 select-none">White Balance Preset</label>
        {p.isBasicModified && (
          <button
            onClick={p.onResetAll}
            className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>
      <div className="relative">
        <select
          value={p.wbOption}
          onChange={e => p.onWbPresetChange(e.target.value as WbOption)}
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

    <EditorSlider
      label="Temperature (Cool / Warm)"
      value={p.adjustments.temperature ?? 0}
      onChange={val => p.onBasicChange('temperature', val)}
      min={-100}
      max={100}
      defaultValue={0}
      trackBackground="linear-gradient(to right, #3b82f6 0%, #4b5563 50%, #f59e0b 100%)"
      bipolar
    />

    <EditorSlider
      label="Tint (Green / Magenta)"
      value={p.adjustments.tint ?? 0}
      onChange={val => p.onBasicChange('tint', val)}
      min={-100}
      max={100}
      defaultValue={0}
      trackBackground="linear-gradient(to right, #22c55e 0%, #4b5563 50%, #d946ef 100%)"
      bipolar
    />

    <EditorSlider
      label="Vibrance (Smart Saturation)"
      value={p.adjustments.vibrance ?? 0}
      onChange={val => p.onBasicChange('vibrance', val)}
      min={-100}
      max={100}
      defaultValue={0}
      trackBackground="linear-gradient(to right, #374151 0%, #06b6d4 50%, #f43f5e 100%)"
      bipolar
    />

    <EditorSlider
      label="Saturation (Global Intensity)"
      value={p.adjustments.saturation ?? 0}
      onChange={val => p.onBasicChange('saturation', val)}
      min={-100}
      max={100}
      defaultValue={0}
      trackBackground="linear-gradient(to right, #1f2937 0%, #6366f1 50%, #ec4899 100%)"
      bipolar
    />

    <EditorSlider
      label="Hue Rotation"
      value={p.adjustments.hue ?? 0}
      onChange={val => p.onBasicChange('hue', val)}
      min={-180}
      max={180}
      defaultValue={0}
      unit="°"
      trackBackground="linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)"
      bipolar
    />
  </div>
);
