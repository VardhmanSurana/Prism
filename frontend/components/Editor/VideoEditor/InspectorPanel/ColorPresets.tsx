import React from 'react';
import type { ClipEffects } from '@/types/nle';
import { DEFAULT_EFFECTS } from '@/types/nle';

interface ColorPreset {
  name: string;
  effects: Partial<ClipEffects>;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'None', effects: { ...DEFAULT_EFFECTS } },
  { name: 'Warm', effects: { temperature: 40, saturation: 15, brightness: 5 } },
  { name: 'Cool', effects: { temperature: -35, saturation: 10, contrast: 10 } },
  { name: 'Cinematic', effects: { contrast: 25, saturation: -20, temperature: -10, shadows: -15 } },
  { name: 'Vintage', effects: { saturation: -30, contrast: 15, temperature: 20, vignette: 30 } },
  { name: 'Vivid', effects: { saturation: 40, contrast: 15, brightness: 5 } },
  { name: 'Noir', effects: { saturation: -100, contrast: 35, brightness: -5 } },
  { name: 'Fade', effects: { saturation: -15, contrast: -20, brightness: 10, shadows: 20 } },
];

interface ColorPresetsProps {
  currentEffects: ClipEffects;
  onApply: (effects: Partial<ClipEffects>) => void;
}

function presetMatches(preset: ColorPreset, current: ClipEffects): boolean {
  if (preset.name === 'None') {
    return Object.values(current).every((v) => v === 0);
  }
  const keys = Object.keys(preset.effects) as (keyof ClipEffects)[];
  return keys.every((k) => {
    const presetVal = preset.effects[k];
    return presetVal === undefined || current[k] === presetVal;
  });
}

export const ColorPresets: React.FC<ColorPresetsProps> = ({ currentEffects, onApply }) => {
  return (
    <div className="mb-3">
      <span className="text-zinc-400 text-xs font-medium block mb-1.5">Color Grading</span>
      <div className="grid grid-cols-4 gap-1.5">
        {COLOR_PRESETS.map((preset) => {
          const isActive = presetMatches(preset, currentEffects);
          return (
            <button
              key={preset.name}
              onClick={() => onApply(preset.effects)}
              className={`flex flex-col items-center gap-0.5 p-1 rounded text-[10px] ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <div
                className="w-full aspect-square rounded-sm border border-zinc-700"
                style={{ background: presetSwatchColor(preset.name) }}
              />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function presetSwatchColor(name: string): string {
  switch (name) {
    case 'None': return 'linear-gradient(135deg, #444 0%, #666 100%)';
    case 'Warm': return 'linear-gradient(135deg, #d4956b 0%, #e8b87a 100%)';
    case 'Cool': return 'linear-gradient(135deg, #6b8fd4 0%, #7ab8e8 100%)';
    case 'Cinematic': return 'linear-gradient(135deg, #2a3a5c 0%, #8a6b3a 100%)';
    case 'Vintage': return 'linear-gradient(135deg, #c4a87c 0%, #8b7355 100%)';
    case 'Vivid': return 'linear-gradient(135deg, #e84393 0%, #6c5ce7 100%)';
    case 'Noir': return 'linear-gradient(135deg, #1a1a1a 0%, #555 100%)';
    case 'Fade': return 'linear-gradient(135deg, #b0b0b0 0%, #d4c9be 100%)';
    default: return '#444';
  }
}
