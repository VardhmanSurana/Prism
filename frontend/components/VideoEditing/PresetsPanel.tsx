/**
 * PresetsPanel — Color grading and effect presets for quick application.
 */
import React from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { ClipEffects } from '@/types/nle';
import { DEFAULT_EFFECTS } from '@/types/nle';

interface GradingPreset {
  name: string;
  swatch: string;
  effects: Partial<ClipEffects>;
}

const GRADING_PRESETS: GradingPreset[] = [
  { name: 'None', swatch: 'linear-gradient(135deg, #444 0%, #666 100%)', effects: { ...DEFAULT_EFFECTS } },
  { name: 'Warm', swatch: 'linear-gradient(135deg, #d4956b 0%, #e8b87a 100%)', effects: { temperature: 40, saturation: 15, brightness: 5 } },
  { name: 'Cool', swatch: 'linear-gradient(135deg, #6b8fd4 0%, #7ab8e8 100%)', effects: { temperature: -35, saturation: 10, contrast: 10 } },
  { name: 'Cinematic', swatch: 'linear-gradient(135deg, #2a3a5c 0%, #8a6b3a 100%)', effects: { contrast: 25, saturation: -20, temperature: -10, shadows: -15 } },
  { name: 'Vintage', swatch: 'linear-gradient(135deg, #c4a87c 0%, #8b7355 100%)', effects: { saturation: -30, contrast: 15, temperature: 20, vignette: 30 } },
  { name: 'Vivid', swatch: 'linear-gradient(135deg, #e84393 0%, #6c5ce7 100%)', effects: { saturation: 40, contrast: 15, brightness: 5 } },
  { name: 'Noir', swatch: 'linear-gradient(135deg, #1a1a1a 0%, #555 100%)', effects: { saturation: -100, contrast: 35, brightness: -5 } },
  { name: 'Fade', swatch: 'linear-gradient(135deg, #b0b0b0 0%, #d4c9be 100%)', effects: { saturation: -15, contrast: -20, brightness: 10, shadows: 20 } },
  { name: 'Dramatic', swatch: 'linear-gradient(135deg, #1a0a2e 0%, #5c1a1a 100%)', effects: { contrast: 30, saturation: -10, shadows: -20, highlights: 15 } },
  { name: 'Sunset', swatch: 'linear-gradient(135deg, #e85d04 0%, #dc2f02 50%, #9d0208 100%)', effects: { temperature: 50, saturation: 25, contrast: 10 } },
  { name: 'Ocean', swatch: 'linear-gradient(135deg, #023e8a 0%, #0077b6 50%, #0096c7 100%)', effects: { temperature: -40, saturation: 15, brightness: 5 } },
  { name: 'Forest', swatch: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 50%, #52b788 100%)', effects: { temperature: -10, saturation: 20, contrast: 5 } },
  { name: 'Matte', swatch: 'linear-gradient(135deg, #8d99ae 0%, #adb5bd 100%)', effects: { contrast: -15, saturation: -20, shadows: 15, brightness: 5 } },
  { name: 'Chrome', swatch: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 50%, #a0a0a0 100%)', effects: { saturation: -40, contrast: 20, sharpness: 10 } },
  { name: 'Night', swatch: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 50%, #415a77 100%)', effects: { brightness: -15, contrast: 15, temperature: -20, saturation: -10 } },
  { name: 'Golden Hour', swatch: 'linear-gradient(135deg, #f4a261 0%, #e76f51 50%, #e63946 100%)', effects: { temperature: 60, saturation: 20, brightness: 10, contrast: -5 } },
];

export const PresetsPanel: React.FC = () => {
  const selectedClip = useNLEStore((s) => s.getSelectedClip());
  const setClipEffects = useNLEStore((s) => s.setClipEffects);

  const applyPreset = (preset: GradingPreset) => {
    if (!selectedClip) return;
    setClipEffects(selectedClip.id, preset.effects);
  };

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
      <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Presets</span>
      </div>

      {!selectedClip ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-[#666] text-xs text-center">
            Select a clip on the timeline to apply a preset.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {GRADING_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex flex-col items-center gap-1 p-2 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded transition-colors"
              >
                <div
                  className="w-full aspect-square rounded-sm border border-[#444]"
                  style={{ background: preset.swatch }}
                />
                <span className="text-[#ccc] text-[10px] leading-tight text-center">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetsPanel;
