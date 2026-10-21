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
import {
  SlidersHorizontal,
  Volume2,
  RotateCcw,
  Trash2,
  Zap,
  PlayCircle,
  Clock,
  TrendingUp,
  Check,
  Monitor,
} from 'lucide-react';

/**
 * InspectorPanel - Renders inspector panel.
 */
export const InspectorPanel: React.FC = () => {
  /**
   * selectedClipId - Performs selected clip id.
   */
  const selectedClipId = useNLEStore((s) => s.selectedClipId);
  /**
   * tracks - Performs tracks.
   */
  const tracks = useNLEStore((s) => s.tracks);
  /**
   * projectFps - Performs project fps.
   */
  const projectFps = useNLEStore((s) => s.projectFps);
  /**
   * pushHistory - Performs push history.
   */
  const pushHistory = useNLEStore((s) => s.pushHistory);
  /**
   * removeClip - Performs remove clip.
   */
  const removeClip = useNLEStore((s) => s.removeClip);
  /**
   * setClipSpeed - Performs set clip speed.
   */
  const setClipSpeed = useNLEStore((s) => s.setClipSpeed);
  /**
   * setClipVolume - Performs set clip volume.
   */
  const setClipVolume = useNLEStore((s) => s.setClipVolume);
  /**
   * setClipMuted - Performs set clip muted.
   */
  const setClipMuted = useNLEStore((s) => s.setClipMuted);
  /**
   * setClipFadeIn - Performs set clip fade in.
   */
  const setClipFadeIn = useNLEStore((s) => s.setClipFadeIn);
  /**
   * setClipFadeOut - Performs set clip fade out.
   */
  const setClipFadeOut = useNLEStore((s) => s.setClipFadeOut);
  /**
   * setClipTransform - Performs set clip transform.
   */
  const setClipTransform = useNLEStore((s) => s.setClipTransform);
  /**
   * setClipKeyframes - Performs set clip keyframes.
   */
  const setClipKeyframes = useNLEStore((s) => s.setClipKeyframes);

  const selectedClip = useMemo(
    () => findClipById(tracks, selectedClipId),
    [tracks, selectedClipId],
  );
  /**
   * onGestureStart - Performs on gesture start.
   */
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);

  if (!selectedClip) {
    return (
      <div className="w-72 bg-[#1d1b1a] border-l border-white/10 flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#151312] border border-white/10 flex items-center justify-center shadow-inner">
              <Monitor className="w-5 h-5 text-zinc-500" />
            </div>
          </div>
          <h3 className="text-zinc-200 text-xs font-medium mb-1">No clip selected</h3>
          <p className="text-zinc-500 text-[11px] leading-relaxed">
            Select a clip on the timeline to inspect and edit its properties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-[#1d1b1a] border-l border-white/10 overflow-y-auto shrink-0">
      {/* Opacity (top) */}
      <div className="p-3.5 border-b border-white/10">
        <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase block mb-2">Opacity</span>
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
          <span className="text-zinc-300 text-xs w-9 text-right font-mono tabular-nums">
            {Math.round(selectedClip.transform.opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Clip info */}
      <div className="p-3.5 border-b border-white/10 bg-[#151312]/40">
        <div className="text-zinc-200 text-xs font-medium truncate">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-zinc-500 text-[10px] mt-0.5 font-mono">
          {selectedClip.sourceDuration.toFixed(1)}s source duration
        </div>
      </div>

      {/* Speed & Speed Ramping */}
      <div className="p-3.5 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Speed Ramping</label>
          {selectedClip.keyframes['speed']?.length ? (
            <button
              onClick={() => { pushHistory(); setClipKeyframes(selectedClip.id, 'speed', []); }}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-0.5 rounded-md hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
            >
              Reset Ramp
            </button>
          ) : (
            <span className="text-[10px] text-zinc-500 font-medium">Constant</span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2.5">
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
          <span className="text-zinc-300 text-xs w-10 text-right font-mono tabular-nums">
            {selectedClip.speed.toFixed(1)}x
          </span>
        </div>

        {/* Speed Ramping Presets */}
        <div className="mt-2.5">
          <span className="text-[10px] text-zinc-500 block mb-1.5 font-medium uppercase tracking-wider">Presets</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('hero', dur));
              }}
              className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-2 text-left flex items-center gap-2 transition-all duration-150 truncate cursor-pointer"
              title="Hero Moment (1x -> 0.25x -> 1x)"
            >
              <Zap className="w-3.5 h-3.5 text-[#e5a93c] shrink-0" />
              <span>Hero Ramp</span>
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('fast', dur));
              }}
              className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-2 text-left flex items-center gap-2 transition-all duration-150 truncate cursor-pointer"
              title="Fast Burst (1x -> 3.5x -> 1x)"
            >
              <PlayCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Fast Burst</span>
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('bullet', dur));
              }}
              className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-2 text-left flex items-center gap-2 transition-all duration-150 truncate cursor-pointer"
              title="Bullet Time (1x -> 0.1x -> 1x)"
            >
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Bullet Time</span>
            </button>
            <button
              onClick={() => {
                pushHistory();
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('accelerate', dur));
              }}
              className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-2 text-left flex items-center gap-2 transition-all duration-150 truncate cursor-pointer"
              title="Accelerate Ramp (0.5x -> 4x)"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Accelerate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="p-3.5 border-b border-white/10">
        <label className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase block mb-2">Volume</label>
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
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
          <span className="text-zinc-300 text-xs w-9 text-right font-mono tabular-nums">{Math.round(selectedClip.volume * 100)}%</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-zinc-400 text-xs cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={selectedClip.muted}
                onChange={(e) => { pushHistory(); setClipMuted(selectedClip.id, e.target.checked); }}
                className="sr-only peer"
              />
              <div className="w-4 h-4 rounded border border-white/20 bg-[#151312] peer-checked:bg-[#e5a93c] peer-checked:border-[#e5a93c] transition-all duration-150 flex items-center justify-center">
                {selectedClip.muted && (
                  <Check className="w-3 h-3 text-[#151312] stroke-[3]" />
                )}
              </div>
            </div>
            <span>Muted</span>
          </label>
          <button
            onClick={() => { pushHistory(); setClipVolume(selectedClip.id, 1.0); }}
            className="text-[10px] text-zinc-400 hover:text-[#e5a93c] font-medium px-2 py-1 rounded-md hover:bg-white/5 transition-all duration-150 cursor-pointer"
          >
            Reset (100%)
          </button>
        </div>
      </div>

      {/* Fade */}
      <div className="p-3.5 border-b border-white/10">
        <label className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase block mb-2">Fade</label>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-zinc-500 text-[10px] block mb-1">In (s)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={selectedClip.fadeIn}
              onFocus={onGestureStart}
              onChange={(e) => setClipFadeIn(selectedClip.id, parseFloat(e.target.value))}
              className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-[10px] block mb-1">Out (s)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={selectedClip.fadeOut}
              onFocus={onGestureStart}
              onChange={(e) => setClipFadeOut(selectedClip.id, parseFloat(e.target.value))}
              className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all"
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
      <div className="p-3.5">
        <button
          onClick={() => removeClip(selectedClip.id)}
          className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-xs font-medium border border-red-500/25 hover:border-red-500/50 rounded-xl py-2.5 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Clip</span>
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

/**
 * EffectsPanel - Renders effects panel.
 */
const EffectsPanel: React.FC<EffectsPanelProps> = ({ clip }) => {
  /**
   * setClipEffects - Performs set clip effects.
   */
  const setClipEffects = useNLEStore((s) => s.setClipEffects);
  /**
   * pushHistory - Performs push history.
   */
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const hasEffects = !isDefaultEffects(clip.effects);
  /**
   * onGestureStart - Performs on gesture start.
   */
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);

  /**
   * updateEffect - Performs update effect.
   */
  const updateEffect = (key: keyof ClipEffects, value: number) => {
    setClipEffects(clip.id, { [key]: value });
  };

  return (
    <div className="p-3.5 border-b border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Effects</span>
        {hasEffects && (
          <button
            onClick={() => { pushHistory(); setClipEffects(clip.id, {
              brightness: 0, contrast: 0, saturation: 0,
              temperature: 0, highlights: 0, shadows: 0,
              sharpness: 0, vignette: 0, noiseReduction: 0,
            }); }}
            className="text-[10px] text-zinc-400 hover:text-[#e5a93c] font-medium px-2 py-0.5 rounded-md hover:bg-white/5 transition-all duration-150 cursor-pointer"
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
        <p className="text-zinc-500 text-[10px] mt-2 leading-relaxed">
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

/**
 * TransformPanel - Renders transform panel.
 */
const TransformPanel: React.FC<TransformPanelProps> = ({ clip }) => {
  const setClipTransform = useNLEStore((s) => s.setClipTransform);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);
  const t = clip.transform;

  const update = (key: keyof ClipTransform, value: number) => {
    setClipTransform(clip.id, { [key]: value });
  };

  return (
    <div className="p-3.5 border-b border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">Transform</span>
        {!isDefaultTransform(t) && (
          <button
            onClick={() => { pushHistory(); setClipTransform(clip.id, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }); }}
            className="text-[10px] text-zinc-400 hover:text-[#e5a93c] font-medium px-2 py-0.5 rounded-md hover:bg-white/5 transition-all duration-150 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-zinc-500 text-[10px] block mb-1">X Position</label>
          <input type="number" value={t.x} onFocus={onGestureStart} onChange={(e) => update('x', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all" />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] block mb-1">Y Position</label>
          <input type="number" value={t.y} onFocus={onGestureStart} onChange={(e) => update('y', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all" />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] block mb-1">Scale</label>
          <input type="number" min="0.1" max="5" step="0.1" value={t.scaleX}
            onFocus={onGestureStart}
            onChange={(e) => { const v = parseFloat(e.target.value) || 1; setClipTransform(clip.id, { scaleX: v, scaleY: v }); }}
            className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all" />
        </div>
        <div>
          <label className="text-zinc-500 text-[10px] block mb-1">Rotation (°)</label>
          <input type="number" min="-360" max="360" step="1" value={t.rotation}
            onFocus={onGestureStart}
            onChange={(e) => update('rotation', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all" />
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

/**
 * TransitionPanel - Renders transition panel.
 */
const TransitionPanel: React.FC<TransitionPanelProps> = ({ clip }) => {
  const setClipTransition = useNLEStore((s) => s.setClipTransition);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const transition = clip.transition;

  return (
    <div className="p-3.5 border-b border-white/10">
      <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase block mb-2">Transition Out</span>
      <div className="flex items-center gap-2 mb-2.5">
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
          <label className="text-zinc-500 text-[10px] block mb-1">Duration (s)</label>
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
            className="w-full bg-[#151312] text-[#f5f0ed] text-xs font-mono rounded-lg px-2.5 py-1.5 border border-white/10 focus:border-[#e5a93c]/60 outline-none transition-all"
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

/**
 * AudioEQPanel - Renders audio eqpanel.
 */
const AudioEQPanel: React.FC<AudioEQPanelProps> = ({ clip }) => {
  const setClipEQ = useNLEStore((s) => s.setClipEQ);
  const pushHistory = useNLEStore((s) => s.pushHistory);
  const onGestureStart = useCallback(() => pushHistory(), [pushHistory]);
  const eq = clip.eq ?? DEFAULT_AUDIO_EQ;

  const updateEQ = (key: keyof ClipAudioEQ, val: number | boolean) => {
    setClipEQ(clip.id, { [key]: val });
  };

  return (
    <div className="p-3.5 border-b border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#f5f0ed] text-xs font-semibold tracking-wider uppercase">3-Band Audio EQ</span>
        {(eq.lowGain !== 0 || eq.midGain !== 0 || eq.highGain !== 0 || eq.ducking) && (
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0, ducking: false }); }}
            className="text-[10px] text-zinc-400 hover:text-[#e5a93c] font-medium px-2 py-0.5 rounded-md hover:bg-white/5 transition-all duration-150 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Low / Bass */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1.5 font-medium">
          <span className="text-zinc-400">Bass (320Hz)</span>
          <span className="font-mono text-zinc-300 tabular-nums">{eq.lowGain > 0 ? `+${eq.lowGain}` : eq.lowGain} dB</span>
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
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1.5 font-medium">
          <span className="text-zinc-400">Voice / Mid (1kHz)</span>
          <span className="font-mono text-zinc-300 tabular-nums">{eq.midGain > 0 ? `+${eq.midGain}` : eq.midGain} dB</span>
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
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1.5 font-medium">
          <span className="text-zinc-400">Treble (3.2kHz)</span>
          <span className="font-mono text-zinc-300 tabular-nums">{eq.highGain > 0 ? `+${eq.highGain}` : eq.highGain} dB</span>
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
      <div className="mt-3.5 mb-2">
        <span className="text-[10px] text-zinc-500 block mb-1.5 font-medium uppercase tracking-wider">EQ Presets</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0 }); }}
            className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 cursor-pointer"
          >
            Flat
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: -3, midGain: 4, highGain: 2 }); }}
            className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 cursor-pointer"
          >
            Voice Enhance
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: 6, midGain: -1, highGain: 1 }); }}
            className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 cursor-pointer"
          >
            Bass Boost
          </button>
          <button
            onClick={() => { pushHistory(); setClipEQ(clip.id, { lowGain: -4, midGain: -2, highGain: 3 }); }}
            className="text-[11px] font-medium bg-[#151312] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-[#e5a93c]/50 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 cursor-pointer"
          >
            Bright Treble
          </button>
        </div>
      </div>

      {/* Auto-Ducking toggle */}
      <label className="flex items-center gap-2 text-xs text-zinc-400 mt-3.5 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            checked={eq.ducking}
            onChange={(e) => { pushHistory(); updateEQ('ducking', e.target.checked); }}
            className="sr-only peer"
          />
          <div className="w-4 h-4 rounded border border-white/20 bg-[#151312] peer-checked:bg-[#e5a93c] peer-checked:border-[#e5a93c] transition-all duration-150 flex items-center justify-center">
            {eq.ducking && (
              <Check className="w-3 h-3 text-[#151312] stroke-[3]" />
            )}
          </div>
        </div>
        <span>Auto-duck music when speech plays</span>
      </label>
    </div>
  );
};

export default InspectorPanel;
