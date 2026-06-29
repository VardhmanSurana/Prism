import React from 'react';
import { Check } from 'lucide-react';
import { EffectsPanelProps } from '../types';
import { CURATED_PRESETS } from '@/components/Editing/presets';
import { Effect } from '@/store/videoEditorStore';

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ selectedClip, onUpdate }) => {
  const activeEffectType = selectedClip?.effects?.[0]?.type ?? null;

  const handlePresetClick = (presetId: string) => {
    if (!selectedClip) return;

    const effect: Effect = {
      type: presetId,
      params: { intensity: 1 },
    };

    if (activeEffectType === presetId) {
      onUpdate({ effects: [] });
    } else {
      onUpdate({ effects: [effect] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Presets
        </label>

        {!selectedClip && (
          <p className="text-[11px] text-white/20 py-4 text-center">Select a clip to apply effects</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {CURATED_PRESETS.map(preset => {
            const isActive = activeEffectType === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                disabled={!selectedClip}
                className={`relative rounded-lg border overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none ${
                  isActive
                    ? 'border-primary/40 ring-1 ring-primary/20 bg-white/[0.04]'
                    : 'border-white/5 hover:border-white/15 bg-white/[0.01]'
                }`}
              >
                <div
                  className="h-12 w-full"
                  style={{ background: preset.accent }}
                />
                <div className="px-2 py-1.5 text-left">
                  <p className="text-[10px] text-white/60 font-medium leading-tight">{preset.name}</p>
                  <p className="text-[9px] text-white/25 leading-tight mt-0.5">{preset.description}</p>
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check size={10} className="text-[#050505]" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
