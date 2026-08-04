/**
 * InspectorPanel — right-side panel showing clip properties and effects.
 * OpenCut-inspired layout: empty state, opacity top, color presets.
 * Uses shadcn-style compound Slider component with white/gray monochromatic theme.
 */
import React, { useCallback, useMemo } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { findClipById } from '@/store/nle/helpers';
import type { ClipEffects, ClipTransform, Transition, ClipAudioEQ } from '@/types/nle';
import { isDefaultEffects, isDefaultTransform, DEFAULT_EFFECTS, DEFAULT_AUDIO_EQ } from '@/types/nle';
import { KeyframeEditor } from './KeyframeEditor';
import { ColorPresets } from './ColorPresets';
import { EffectSlider } from '../EffectSlider';
import { Dropdown } from '@/components/ui/Dropdown';
import { getSpeedRampPreset, type SpeedRampPresetType } from '@/lib/speedRampUtils';
import { Slider } from '@/components/ui/Slider';

export const InspectorPanel: React.FC = () => {
  const selectedClipId = useNLEStore((s) => s.selectedClipId);
  const tracks = useNLEStore((s) => s.tracks);
  const projectFps = useNLEStore((s) => s.projectFps);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const removeClip = useNLEStore((s) => s.removeClip);
  const setClipSpeed = useNLEStore((s) => s.setClipSpeed);
  const setClipVolume = useNLEStore((s) => s.setClipVolume);
  const setClipMuted = useNLEStore((s) => s.setClipMuted);
  const setClipFadeIn = useNLEStore((s) => s.setClipFadeIn);
  const setClipFadeOut = useNLEStore((s) => s.setClipFadeOut);
  const setClipTransform = useNLEStore((s) => s.setClipTransform);
  const setClipKeyframes = useNLEStore((s) => s.setClipKeyframes);

  const selectedClip = useMemo(
    () => findClipById(tracks, selectedClipId),
    [tracks, selectedClipId],
  );
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);

  if (!selectedClip) {
    return (
      <div className="w-64 bg-[#0e0e10] border-l border-white/[0.06] flex items-center justify-center h-full">
        <div className="text-center px-6">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
          </div>
          <h3 className="text-white/60 text-[13px] font-medium mb-1">No clip selected</h3>
          <p className="text-white/30 text-[11px] leading-relaxed">
            Select a clip on the timeline to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#0e0e10] border-l border-white/[0.06] overflow-y-auto shrink-0">
      {/* Opacity (top) */}
      <div className="p-3 border-b border-white/[0.06]">
        <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase block mb-2">Opacity</span>
        <div className="flex items-center gap-3">
          <Slider
            value={selectedClip.transform.opacity}
            onValueChange={(v) => setClipTransform(selectedClip.id, { opacity: v })}
            onGestureStart={onGestureStart}
            min={0}
            max={1}
            step={0.01}
            className="flex-1"
          >
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb aria-label="Opacity" />
          </Slider>
          <span className="text-white/70 text-[11px] w-8 text-right font-mono tabular-nums">
            {Math.round(selectedClip.transform.opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Clip info */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="text-white/80 text-[12px] font-medium truncate">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-white/35 text-[10px] mt-0.5 font-mono">
          {selectedClip.sourceDuration.toFixed(1)}s source
        </div>
      </div>

      {/* Speed & Speed Ramping */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <label className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Speed Ramping</label>
          {selectedClip.keyframes['speed']?.length ? (
            <button
              onClick={() => { pushHistory(); setClipKeyframes(selectedClip.id, 'speed', []); }}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-0.5 rounded-md hover:bg-red-500/10 transition-all duration-150"
            >
              Reset Ramp
            </button>
          ) : (
            <span className="text-[10px] text-white/25">Constant</span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Slider
            value={selectedClip.speed}
            onValueChange={(v) => setClipSpeed(selectedClip.id, v)}
            onGestureStart={onGestureStart}
            min={0.1}
            max={4}
            step={0.1}
            className="flex-1"
          >
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb aria-label="Speed" />
          </Slider>
          <span className="text-white/70 text-[11px] w-10 text-right font-mono tabular-nums">
            {selectedClip.speed.toFixed(1)}x
          </span>
        </div>

        {/* Speed Ramping Presets */}
        <div className="mt-2">
          <span className="text-[10px] text-white/30 block mb-1.5">Presets</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('hero', dur));
              }}
              className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/80 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left flex items-center gap-1.5 transition-all duration-150 truncate"
              title="Hero Moment (1x -> 0.25x -> 1x)"
            >
              <svg className="w-3 h-3 text-yellow-400/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Hero Ramp
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('fast', dur));
              }}
              className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/80 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left flex items-center gap-1.5 transition-all duration-150 truncate"
              title="Fast Burst (1x -> 3.5x -> 1x)"
            >
              <svg className="w-3 h-3 text-orange-400/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Fast Burst
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('bullet', dur));
              }}
              className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/80 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left flex items-center gap-1.5 transition-all duration-150 truncate"
              title="Bullet Time (1x -> 0.1x -> 1x)"
            >
              <svg className="w-3 h-3 text-blue-400/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Bullet Time
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('accelerate', dur));
              }}
              className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/80 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left flex items-center gap-1.5 transition-all duration-150 truncate"
              title="Accelerate Ramp (0.5x -> 4x)"
            >
              <svg className="w-3 h-3 text-green-400/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Accelerate
            </button>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="p-3 border-b border-white/[0.06]">
        <label className="text-white/50 text-[11px] font-medium tracking-wide uppercase block mb-2">Volume</label>
        <div className="flex items-center gap-3">
          <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z" />
          </svg>
          <Slider
            value={selectedClip.volume}
            onValueChange={(v) => setClipVolume(selectedClip.id, v)}
            onGestureStart={onGestureStart}
            min={0}
            max={2}
            step={0.05}
            className="flex-1"
          >
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb aria-label="Volume" />
          </Slider>
          <span className="text-white/70 text-[11px] w-8 text-right font-mono tabular-nums">{Math.round(selectedClip.volume * 100)}%</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-2 text-white/40 text-[11px] cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={selectedClip.muted}
                onChange={(e) => { pushHistory(); setClipMuted(selectedClip.id, e.target.checked); }}
                className="sr-only peer"
              />
              <div className="w-4 h-4 rounded border border-white/[0.12] bg-white/[0.04] peer-checked:bg-white/80 peer-checked:border-white/80 transition-all duration-150 flex items-center justify-center">
                {selectedClip.muted && (
                  <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            Muted
          </label>
          <button
            onClick={() => { pushHistory(); setClipVolume(selectedClip.id, 1.0); }}
            className="text-[10px] text-white/40 hover:text-white/60 font-medium px-2 py-1 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Fade */}
      <div className="p-3 border-b border-white/[0.06]">
        <label className="text-white/50 text-[11px] font-medium tracking-wide uppercase block mb-2">Fade</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-white/35 text-[10px] block mb-1">In (s)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={selectedClip.fadeIn}
              onFocus={onGestureStart}
              onChange={(e) => setClipFadeIn(selectedClip.id, parseFloat(e.target.value))}
              className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150"
            />
          </div>
          <div>
            <label className="text-white/35 text-[10px] block mb-1">Out (s)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={selectedClip.fadeOut}
              onFocus={onGestureStart}
              onChange={(e) => setClipFadeOut(selectedClip.id, parseFloat(e.target.value))}
              className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150"
            />
          </div>
        </div>
      </div>

      {/* Audio 3-Band EQ & Ducking */}
      <AudioEQPanel clip={selectedClip} />

      {/* Transform */}
      <TransformPanel clip={selectedClip} />

      {/* Keyframes */}
      <KeyframeEditor />

      {/* Transition */}
      <TransitionPanel clip={selectedClip} />

      {/* Effects */}
      <EffectsPanel clip={selectedClip} />

      {/* Delete */}
      <div className="p-3">
        <button
          onClick={() => removeClip(selectedClip.id)}
          className="w-full flex items-center justify-center gap-2 text-red-400/80 hover:text-red-400 text-[11px] font-medium border border-red-500/20 hover:border-red-500/30 rounded-md py-2 hover:bg-red-500/10 transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Clip
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Effects Panel
// ---------------------------------------------------------------------------

interface EffectsPanelProps {
  clip: { id: string; effects: ClipEffects };
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ clip }) => {
  const setClipEffects = useNLEStore((s) => s.setClipEffects);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const hasEffects = !isDefaultEffects(clip.effects);
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);

  const updateEffect = (key: keyof ClipEffects, value: number) => {
    setClipEffects(clip.id, { [key]: value });
  };

  return (
    <div className="p-3 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Effects</span>
        {hasEffects && (
          <button
            onClick={() => { pushHistory(); setClipEffects(clip.id, {
              brightness: 0, contrast: 0, saturation: 0,
              temperature: 0, highlights: 0, shadows: 0,
              sharpness: 0, vignette: 0, noiseReduction: 0,
            }); }}
            className="text-[10px] text-white/40 hover:text-white/60 font-medium px-2 py-0.5 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            Reset
          </button>
        )}
      </div>

      <ColorPresets
        currentEffects={clip.effects}
        onApply={(effects) => { pushHistory(); setClipEffects(clip.id, effects); }}
      />

      <EffectSlider label="Brightness" value={clip.effects.brightness} onChange={(v) => updateEffect('brightness', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Contrast" value={clip.effects.contrast} onChange={(v) => updateEffect('contrast', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Saturation" value={clip.effects.saturation} onChange={(v) => updateEffect('saturation', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Temperature" value={clip.effects.temperature} onChange={(v) => updateEffect('temperature', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Highlights" value={clip.effects.highlights} onChange={(v) => updateEffect('highlights', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Shadows" value={clip.effects.shadows} onChange={(v) => updateEffect('shadows', v)} onGestureStart={onGestureStart} min={-100} max={100} />
      <EffectSlider label="Sharpness" value={clip.effects.sharpness} onChange={(v) => updateEffect('sharpness', v)} onGestureStart={onGestureStart} min={0} max={100} />
      <EffectSlider label="Vignette" value={clip.effects.vignette} onChange={(v) => updateEffect('vignette', v)} onGestureStart={onGestureStart} min={0} max={100} />
      <EffectSlider label="Noise Reduction" value={clip.effects.noiseReduction} onChange={(v) => updateEffect('noiseReduction', v)} onGestureStart={onGestureStart} min={0} max={100} />

      {(clip.effects.sharpness > 0 || clip.effects.noiseReduction > 0) && (
        <p className="text-white/25 text-[10px] mt-2 leading-relaxed">
          Some effects (sharpness, noise reduction) are only visible in the exported video.
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Transform Panel
// ---------------------------------------------------------------------------

interface TransformPanelProps {
  clip: { id: string; transform: ClipTransform };
}

const TransformPanel: React.FC<TransformPanelProps> = ({ clip }) => {
  const setClipTransform = useNLEStore((s) => s.setClipTransform);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);
  const t = clip.transform;

  const update = (key: keyof ClipTransform, value: number) => {
    setClipTransform(clip.id, { [key]: value });
  };

  return (
    <div className="p-3 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">Transform</span>
        {!isDefaultTransform(t) && (
          <button
            onClick={() => { pushHistory(); setClipTransform(clip.id, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }); }}
            className="text-[10px] text-white/40 hover:text-white/60 font-medium px-2 py-0.5 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-white/35 text-[10px] block mb-1">X</label>
          <input type="number" value={t.x} onFocus={onGestureStart} onChange={(e) => update('x', parseFloat(e.target.value) || 0)}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150" />
        </div>
        <div>
          <label className="text-white/35 text-[10px] block mb-1">Y</label>
          <input type="number" value={t.y} onFocus={onGestureStart} onChange={(e) => update('y', parseFloat(e.target.value) || 0)}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150" />
        </div>
        <div>
          <label className="text-white/35 text-[10px] block mb-1">Scale</label>
          <input type="number" min="0.1" max="5" step="0.1" value={t.scaleX}
            onFocus={onGestureStart}
            onChange={(e) => { const v = parseFloat(e.target.value) || 1; setClipTransform(clip.id, { scaleX: v, scaleY: v }); }}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150" />
        </div>
        <div>
          <label className="text-white/35 text-[10px] block mb-1">Rotation</label>
          <input type="number" min="-360" max="360" step="1" value={t.rotation}
            onFocus={onGestureStart}
            onChange={(e) => update('rotation', parseFloat(e.target.value) || 0)}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150" />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Transition Panel
// ---------------------------------------------------------------------------

interface TransitionPanelProps {
  clip: { id: string; transition?: { type: string; duration: number } };
}

const TRANSITION_TYPES = [
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'wipe-left', label: 'Wipe Left' },
  { value: 'wipe-right', label: 'Wipe Right' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
] as const;

const TransitionPanel: React.FC<TransitionPanelProps> = ({ clip }) => {
  const setClipTransition = useNLEStore((s) => s.setClipTransition);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const transition = clip.transition;

  return (
    <div className="p-3 border-b border-white/[0.06]">
      <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase block mb-2">Transition Out</span>
      <div className="flex items-center gap-2 mb-2">
        <Dropdown
          value={transition?.type ?? ''}
          onChange={(val) => {
            pushHistory();
            if (val) {
              setClipTransition(clip.id, {
                type: val as Transition['type'],
                duration: transition?.duration ?? 0.5,
              });
            } else {
              setClipTransition(clip.id, undefined);
            }
          }}
          options={[
            { value: '', label: 'None' },
            ...TRANSITION_TYPES.map((t) => ({ value: t.value, label: t.label })),
          ]}
          className="flex-1"
        />
      </div>
      {transition && (
        <div>
          <label className="text-white/35 text-[10px] block mb-1">Duration (s)</label>
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={transition.duration}
            onFocus={() => pushHistory()}
            onChange={(e) => {
              setClipTransition(clip.id, {
                type: transition.type as Transition['type'],
                duration: parseFloat(e.target.value) || 0.5,
              });
            }}
            className="w-full bg-white/[0.04] text-white/70 text-[11px] font-mono rounded-md px-2.5 py-1.5 border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] outline-none transition-all duration-150"
          />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Audio 3-Band EQ Panel
// ---------------------------------------------------------------------------

interface AudioEQPanelProps {
  clip: { id: string; eq?: ClipAudioEQ };
}

const AudioEQPanel: React.FC<AudioEQPanelProps> = ({ clip }) => {
  const setClipEQ = useNLEStore((s) => s.setClipEQ);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);
  const eq = clip.eq ?? DEFAULT_AUDIO_EQ;

  const updateEQ = (key: keyof ClipAudioEQ, val: number | boolean) => {
    setClipEQ(clip.id, { [key]: val });
  };

  return (
    <div className="p-3 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">3-Band Audio EQ</span>
        {(eq.lowGain !== 0 || eq.midGain !== 0 || eq.highGain !== 0 || eq.ducking) && (
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0, ducking: false }); }}
            className="text-[10px] text-white/40 hover:text-white/60 font-medium px-2 py-0.5 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            Reset
          </button>
        )}
      </div>

      {/* Low / Bass */}
      <div className="mb-2.5">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-white/40">Bass (320Hz)</span>
          <span className="font-mono text-white/60 tabular-nums">{eq.lowGain > 0 ? `+${eq.lowGain}` : eq.lowGain} dB</span>
        </div>
        <Slider
          value={eq.lowGain}
          onValueChange={(v) => updateEQ('lowGain', Math.round(v))}
          onGestureStart={onGestureStart}
          min={-12}
          max={12}
          step={1}
        >
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb aria-label="Bass" />
        </Slider>
      </div>

      {/* Mid / Voice */}
      <div className="mb-2.5">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-white/40">Voice / Mid (1kHz)</span>
          <span className="font-mono text-white/60 tabular-nums">{eq.midGain > 0 ? `+${eq.midGain}` : eq.midGain} dB</span>
        </div>
        <Slider
          value={eq.midGain}
          onValueChange={(v) => updateEQ('midGain', Math.round(v))}
          onGestureStart={onGestureStart}
          min={-12}
          max={12}
          step={1}
        >
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb aria-label="Mid" />
        </Slider>
      </div>

      {/* High / Treble */}
      <div className="mb-2.5">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-white/40">Treble (3.2kHz)</span>
          <span className="font-mono text-white/60 tabular-nums">{eq.highGain > 0 ? `+${eq.highGain}` : eq.highGain} dB</span>
        </div>
        <Slider
          value={eq.highGain}
          onValueChange={(v) => updateEQ('highGain', Math.round(v))}
          onGestureStart={onGestureStart}
          min={-12}
          max={12}
          step={1}
        >
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb aria-label="Treble" />
        </Slider>
      </div>

      {/* Presets */}
      <div className="mt-3 mb-2">
        <span className="text-[10px] text-white/30 block mb-1.5">EQ Presets</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0 }); }}
            className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left transition-all duration-150"
          >
            Flat
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: -3, midGain: 4, highGain: 2 }); }}
            className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left transition-all duration-150"
          >
            Voice Enhance
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 6, midGain: -1, highGain: 1 }); }}
            className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left transition-all duration-150"
          >
            Bass Boost
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: -4, midGain: -2, highGain: 3 }); }}
            className="text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] rounded-md px-2 py-1.5 text-left transition-all duration-150"
          >
            Bright Treble
          </button>
        </div>
      </div>

      {/* Auto-Ducking toggle */}
      <label className="flex items-center gap-2 text-[11px] text-white/40 mt-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={eq.ducking}
            onChange={(e) => { pushHistory(); updateEQ('ducking', e.target.checked); }}
            className="sr-only peer"
          />
          <div className="w-4 h-4 rounded border border-white/[0.12] bg-white/[0.04] peer-checked:bg-white/80 peer-checked:border-white/80 transition-all duration-150 flex items-center justify-center">
            {eq.ducking && (
              <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <span>Auto-duck music when speech plays</span>
      </label>
    </div>
  );
};

export default InspectorPanel;
