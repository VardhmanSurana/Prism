/**
 * AdjustPanel — Left panel for clip color grading / effects adjustments.
 * Provides sliders for all ClipEffects properties, mirroring the InspectorPanel's
 * effects section as a dedicated panel.
 */
import React from 'react';
import { useNLEStore } from '@/store/nleStore';
import { findClipById } from '@/store/nle/helpers';
import type { ClipEffects } from '@/types/nle';
import { isDefaultEffects, DEFAULT_EFFECTS } from '@/types/nle';
import { EffectSlider } from './EffectSlider';

export const AdjustPanel: React.FC = () => {
  const selectedClipId = useNLEStore((s) => s.selectedClipId);
  const tracks = useNLEStore((s) => s.tracks);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const setClipEffects = useNLEStore((s) => s.setClipEffects);
  const selectedClip = React.useMemo(
    () => findClipById(tracks, selectedClipId),
    [tracks, selectedClipId],
  );
  const onGestureStart = React.useCallback(() => pushHistory(), [pushHistory]);

  if (!selectedClip) {
    return (
      <div className="w-64 bg-[#0e0e10] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="h-10 flex items-center px-3 border-b border-white/[0.06]">
          <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Adjust</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
            </div>
            <h3 className="text-white/60 text-[13px] font-medium mb-1">No clip selected</h3>
            <p className="text-white/30 text-[11px] leading-relaxed">
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
    pushHistory();
    setClipEffects(selectedClip.id, { ...DEFAULT_EFFECTS });
  };

  return (
    <div className="w-64 bg-[#0e0e10] border-r border-white/[0.06] flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Adjust</span>
          <span className="text-[10px] text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded-md border border-[#3b82f6]/20 font-medium">
            Scopes Ready
          </span>
        </div>
        {hasEffects && (
          <button
            onClick={resetAll}
            className="text-white/30 hover:text-white/60 text-[10px] font-medium px-2 py-1 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Clip name */}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="text-white/70 text-[11px] truncate font-medium">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-white/30 text-[10px] mt-0.5 font-mono">
          {selectedClip.sourceDuration.toFixed(1)}s source
        </div>
      </div>

      {/* Effect sliders */}
      <div className="flex-1 overflow-y-auto p-3">
        <EffectSlider label="Brightness" value={effects.brightness} onChange={(v) => updateEffect('brightness', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Contrast" value={effects.contrast} onChange={(v) => updateEffect('contrast', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Saturation" value={effects.saturation} onChange={(v) => updateEffect('saturation', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Temperature" value={effects.temperature} onChange={(v) => updateEffect('temperature', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Highlights" value={effects.highlights} onChange={(v) => updateEffect('highlights', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Shadows" value={effects.shadows} onChange={(v) => updateEffect('shadows', v)} onGestureStart={onGestureStart} min={-100} max={100} />
        <EffectSlider label="Sharpness" value={effects.sharpness} onChange={(v) => updateEffect('sharpness', v)} onGestureStart={onGestureStart} min={0} max={100} />
        <EffectSlider label="Vignette" value={effects.vignette} onChange={(v) => updateEffect('vignette', v)} onGestureStart={onGestureStart} min={0} max={100} />
        <EffectSlider label="Noise Reduction" value={effects.noiseReduction} onChange={(v) => updateEffect('noiseReduction', v)} onGestureStart={onGestureStart} min={0} max={100} />
      </div>
    </div>
  );
};

export default AdjustPanel;
