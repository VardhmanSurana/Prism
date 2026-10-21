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
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

/**
 * AdjustPanel - Renders adjust panel.
 */
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
      <div className="w-72 bg-[#1d1b1a] border-r border-white/10 flex flex-col shrink-0">
        <div className="h-11 flex items-center px-3.5 border-b border-white/10 shrink-0">
          <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Adjust</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-xl bg-[#151312] border border-white/10 flex items-center justify-center shadow-inner">
                <SlidersHorizontal className="w-5 h-5 text-zinc-500" />
              </div>
            </div>
            <h3 className="text-zinc-200 text-xs font-medium mb-1">No clip selected</h3>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Select a clip on the timeline to adjust its color and visual effects.
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
    <div className="w-72 bg-[#1d1b1a] border-r border-white/10 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-3.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Adjust</span>
          <span className="text-[10px] text-[#e5a93c] bg-[#e5a93c]/10 px-1.5 py-0.5 rounded-md border border-[#e5a93c]/20 font-medium">
            Active
          </span>
        </div>
        {hasEffects && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-zinc-400 hover:text-[#e5a93c] text-[10px] font-medium px-2 py-1 rounded-md hover:bg-white/5 transition-all duration-150 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Clip name */}
      <div className="px-3.5 py-2.5 border-b border-white/10 bg-[#151312]/40 shrink-0">
        <div className="text-zinc-200 text-xs truncate font-medium">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-zinc-500 text-[10px] mt-0.5 font-mono">
          {selectedClip.sourceDuration.toFixed(1)}s source duration
        </div>
      </div>

      {/* Effect sliders */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-1">
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
