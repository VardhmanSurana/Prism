/**
 * AdjustPanel — Left panel for clip color grading / effects adjustments.
 * Provides sliders for all ClipEffects properties, mirroring the InspectorPanel's
 * effects section as a dedicated panel.
 */
import React from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { ClipEffects } from '@/types/nle';
import { isDefaultEffects, DEFAULT_EFFECTS } from '@/types/nle';
import { EffectSlider } from './EffectSlider';

export const AdjustPanel: React.FC = () => {
  const selectedClip = useNLEStore((s) => s.getSelectedClip());
  const setClipEffects = useNLEStore((s) => s.setClipEffects);

  if (!selectedClip) {
    return (
      <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
        <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
          <span className="text-[#999] text-xs font-medium">Adjust</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
            </div>
            <h3 className="text-[#ccc] text-sm font-medium mb-1">No clip selected</h3>
            <p className="text-[#999] text-xs leading-relaxed">
              Select a clip on the timeline to adjust its color and effects.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const effects = selectedClip.effects;
  const hasEffects = !isDefaultEffects(effects);

  const updateEffect = (key: keyof ClipEffects, value: number) => {
    setClipEffects(selectedClip.id, { [key]: value });
  };

  const resetAll = () => {
    setClipEffects(selectedClip.id, { ...DEFAULT_EFFECTS });
  };

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-[#999] text-xs font-medium">Adjust</span>
          <span className="text-[10px] text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/20">
            Scopes Ready
          </span>
        </div>
        {hasEffects && (
          <button
            onClick={resetAll}
            className="text-[#999] hover:text-[#ccc] text-[10px]"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Clip name */}
      <div className="px-3 py-2 border-b border-[#2a2a2a]">
        <div className="text-[#ccc] text-[11px] truncate font-medium">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-[#666] text-[10px] mt-0.5">
          {selectedClip.sourceDuration.toFixed(1)}s source
        </div>
      </div>

      {/* Effect sliders */}
      <div className="flex-1 overflow-y-auto p-3">
        <EffectSlider label="Brightness" value={effects.brightness} onChange={(v) => updateEffect('brightness', v)} min={-100} max={100} />
        <EffectSlider label="Contrast" value={effects.contrast} onChange={(v) => updateEffect('contrast', v)} min={-100} max={100} />
        <EffectSlider label="Saturation" value={effects.saturation} onChange={(v) => updateEffect('saturation', v)} min={-100} max={100} />
        <EffectSlider label="Temperature" value={effects.temperature} onChange={(v) => updateEffect('temperature', v)} min={-100} max={100} />
        <EffectSlider label="Highlights" value={effects.highlights} onChange={(v) => updateEffect('highlights', v)} min={-100} max={100} />
        <EffectSlider label="Shadows" value={effects.shadows} onChange={(v) => updateEffect('shadows', v)} min={-100} max={100} />
        <EffectSlider label="Sharpness" value={effects.sharpness} onChange={(v) => updateEffect('sharpness', v)} min={0} max={100} />
        <EffectSlider label="Vignette" value={effects.vignette} onChange={(v) => updateEffect('vignette', v)} min={0} max={100} />
        <EffectSlider label="Noise Reduction" value={effects.noiseReduction} onChange={(v) => updateEffect('noiseReduction', v)} min={0} max={100} />
      </div>
    </div>
  );
};

export default AdjustPanel;
