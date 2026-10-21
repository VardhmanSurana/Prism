/**
 * HslToningTab.tsx
 * Split-toning: 4 presets + highlights/shadows hue & saturation + balance.
 */
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { EditorSlider } from '../ui/EditorSlider';
import { SPLIT_PRESETS, SplitPreset } from './bands';

export interface SplitToning {
  shadows: { hue: number; saturation: number };
  highlights: { hue: number; saturation: number };
  balance: number;
}

export interface HslToningTabProps {
  splitToning: SplitToning;
  isToningModified: boolean;
  onResetAll: () => void;
  onApplyPreset: (preset: SplitPreset) => void;
  onUpdateHighlights: (key: 'hue' | 'saturation', value: number) => void;
  onUpdateShadows: (key: 'hue' | 'saturation', value: number) => void;
  onUpdateBalance: (value: number) => void;
}

export const HslToningTab: React.FC<HslToningTabProps> = (p) => {
  const highlightsColor = `hsl(${p.splitToning.highlights.hue}, ${p.splitToning.highlights.saturation}%, 50%)`;
  const shadowsColor = `hsl(${p.splitToning.shadows.hue}, ${p.splitToning.shadows.saturation}%, 50%)`;

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Split Toning Looks</span>
        {p.isToningModified && (
          <button
            onClick={p.onResetAll}
            className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SPLIT_PRESETS.map(preset => {
          const isPresetActive =
            p.splitToning.highlights.hue === preset.highlights.hue &&
            p.splitToning.highlights.saturation === preset.highlights.saturation &&
            p.splitToning.shadows.hue === preset.shadows.hue &&
            p.splitToning.shadows.saturation === preset.shadows.saturation &&
            p.splitToning.balance === preset.balance;

          return (
            <button
              key={preset.name}
              onClick={() => p.onApplyPreset(preset)}
              className={`editor-btn editor-card-btn ${isPresetActive ? 'active' : ''} py-2.5 px-3 text-[10.5px] font-medium text-left flex flex-col justify-between h-[52px] rounded-lg border border-white/5 bg-[#13151a] hover:bg-[#1a1c22] transition-colors`}
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

      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full border border-white/20 shadow-sm transition-all"
            style={{ backgroundColor: p.splitToning.highlights.saturation > 0 ? highlightsColor : 'rgba(255,255,255,0.15)' }}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Highlights Tone</span>
        </div>
        <div className="space-y-3.5">
          <EditorSlider
            label="Highlights Hue"
            value={p.splitToning.highlights.hue}
            onChange={val => p.onUpdateHighlights('hue', val)}
            min={0}
            max={360}
            defaultValue={0}
            unit="°"
            trackBackground="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
          />
          <EditorSlider
            label="Highlights Saturation"
            value={p.splitToning.highlights.saturation}
            onChange={val => p.onUpdateHighlights('saturation', val)}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
            trackBackground={`linear-gradient(to right, #4b5563, hsl(${p.splitToning.highlights.hue}, 100%, 50%))`}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full border border-white/20 shadow-sm transition-all"
            style={{ backgroundColor: p.splitToning.shadows.saturation > 0 ? shadowsColor : 'rgba(255,255,255,0.15)' }}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Shadows Tone</span>
        </div>
        <div className="space-y-3.5">
          <EditorSlider
            label="Shadows Hue"
            value={p.splitToning.shadows.hue}
            onChange={val => p.onUpdateShadows('hue', val)}
            min={0}
            max={360}
            defaultValue={0}
            unit="°"
            trackBackground="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
          />
          <EditorSlider
            label="Shadows Saturation"
            value={p.splitToning.shadows.saturation}
            onChange={val => p.onUpdateShadows('saturation', val)}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
            trackBackground={`linear-gradient(to right, #4b5563, hsl(${p.splitToning.shadows.hue}, 100%, 50%))`}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <EditorSlider
          label="Balance (Shadows vs Highlights)"
          value={p.splitToning.balance}
          onChange={p.onUpdateBalance}
          min={-100}
          max={100}
          defaultValue={0}
          bipolar
        />
      </div>
    </div>
  );
};
