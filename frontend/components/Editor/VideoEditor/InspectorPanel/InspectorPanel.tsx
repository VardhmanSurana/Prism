/**
 * InspectorPanel — right-side panel showing clip properties and effects.
 * OpenCut-inspired layout: empty state, opacity top, blue accent, color presets.
 */
import React from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { ClipEffects, ClipTransform, Transition, ClipAudioEQ } from '@/types/nle';
import { isDefaultEffects, isDefaultTransform, DEFAULT_EFFECTS, DEFAULT_AUDIO_EQ } from '@/types/nle';
import { KeyframeEditor } from './KeyframeEditor';
import { ColorPresets } from './ColorPresets';
import { EffectSlider } from '../EffectSlider';
import { Dropdown } from '@/components/ui/Dropdown';
import { getSpeedRampPreset, type SpeedRampPresetType } from '@/lib/speedRampUtils';

export const InspectorPanel: React.FC = () => {
  const {
    selectedClipId, tracks,
    setClipSpeed, setClipVolume, setClipMuted,
    setClipEffects, setClipFadeIn, setClipFadeOut,
    setClipTransform, setClipTransition, setClipKeyframes, setClipEQ,
    removeClip, projectFps,
  } = useNLEStore();

  const selectedClip = useNLEStore((s) => s.getSelectedClip());

  if (!selectedClip) {
    return (
      <div className="w-64 bg-[#1a1a1a] border-l border-[#2a2a2a] flex items-center justify-center h-full">
        <div className="text-center px-6">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
          </div>
          <h3 className="text-[#ccc] text-sm font-medium mb-1">Its empty here</h3>
          <p className="text-[#999] text-xs leading-relaxed">
            Click an element on the timeline to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#1a1a1a] border-l border-[#2a2a2a] overflow-y-auto shrink-0">
      {/* Opacity (top) */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium block mb-2">Opacity</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={selectedClip.transform.opacity}
            onChange={(e) => setClipTransform(selectedClip.id, { opacity: parseFloat(e.target.value) })}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="text-[#ccc] text-xs w-8 text-right">
            {Math.round(selectedClip.transform.opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Clip info */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="text-[#ccc] text-sm font-medium truncate">
          {selectedClip.sourcePath.split('/').pop()}
        </div>
        <div className="text-[#999] text-xs mt-1">
          {selectedClip.sourceDuration.toFixed(1)}s source
        </div>
      </div>

      {/* Speed & Speed Ramping */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[#999] text-xs font-medium">Speed Ramping</label>
          {selectedClip.keyframes['speed']?.length ? (
            <button
              onClick={() => setClipKeyframes(selectedClip.id, 'speed', [])}
              className="text-[10px] text-[#ef4444] hover:underline"
            >
              Reset Ramp
            </button>
          ) : (
            <span className="text-[10px] text-[#666]">Constant</span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min="0.1"
            max="4"
            step="0.1"
            value={selectedClip.speed}
            onChange={(e) => setClipSpeed(selectedClip.id, parseFloat(e.target.value))}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="text-[#ccc] text-xs w-10 text-right font-mono">
            {selectedClip.speed.toFixed(1)}x
          </span>
        </div>

        {/* Speed Ramping Presets */}
        <div className="mt-2">
          <span className="text-[10px] text-[#777] block mb-1">Presets:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('hero', dur));
              }}
              className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1.5 py-1 text-center transition-colors truncate"
              title="Hero Moment (1x -> 0.25x -> 1x)"
            >
              ⚡ Hero Ramp
            </button>
            <button
              onClick={() => {
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('fast', dur));
              }}
              className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1.5 py-1 text-center transition-colors truncate"
              title="Fast Burst (1x -> 3.5x -> 1x)"
            >
              🚀 Fast Burst
            </button>
            <button
              onClick={() => {
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('bullet', dur));
              }}
              className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1.5 py-1 text-center transition-colors truncate"
              title="Bullet Time (1x -> 0.1x -> 1x)"
            >
              🎯 Bullet Time
            </button>
            <button
              onClick={() => {
                const dur = selectedClip.durationFrames / projectFps;
                setClipKeyframes(selectedClip.id, 'speed', getSpeedRampPreset('accelerate', dur));
              }}
              className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1.5 py-1 text-center transition-colors truncate"
              title="Accelerate Ramp (0.5x -> 4x)"
            >
              📈 Accelerate
            </button>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <label className="text-[#999] text-xs block mb-1">Volume</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={selectedClip.volume}
            onChange={(e) => setClipVolume(selectedClip.id, parseFloat(e.target.value))}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="text-[#ccc] text-xs w-8 text-right">{Math.round(selectedClip.volume * 100)}%</span>
        </div>
        <label className="flex items-center gap-2 mt-2 text-[#999] text-xs">
          <input
            type="checkbox"
            checked={selectedClip.muted}
            onChange={(e) => setClipMuted(selectedClip.id, e.target.checked)}
            className="accent-[#3b82f6]"
          />
          Muted
        </label>
        <button
          onClick={() => setClipVolume(selectedClip.id, 1.0)}
          className="mt-2 text-[10px] text-[#999] hover:text-[#3b82f6] border border-[#333] hover:border-[#3b82f6]/50 rounded px-2 py-0.5"
        >
          Reset
        </button>
      </div>

      {/* Fade */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <label className="text-[#999] text-xs block mb-1">Fade In (s)</label>
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={selectedClip.fadeIn}
          onChange={(e) => setClipFadeIn(selectedClip.id, parseFloat(e.target.value))}
          className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]"
        />
        <label className="text-[#999] text-xs block mt-2 mb-1">Fade Out (s)</label>
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={selectedClip.fadeOut}
          onChange={(e) => setClipFadeOut(selectedClip.id, parseFloat(e.target.value))}
          className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]"
        />
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
          className="w-full text-red-400 hover:text-red-300 text-xs border border-red-800/50 rounded py-1.5 hover:bg-red-900/20"
        >
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
  const hasEffects = !isDefaultEffects(clip.effects);

  const updateEffect = (key: keyof ClipEffects, value: number) => {
    setClipEffects(clip.id, { [key]: value });
  };

  return (
    <div className="p-3 border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#999] text-xs font-medium">Effects</span>
        {hasEffects && (
          <button
            onClick={() => setClipEffects(clip.id, {
              brightness: 0, contrast: 0, saturation: 0,
              temperature: 0, highlights: 0, shadows: 0,
              sharpness: 0, vignette: 0, noiseReduction: 0,
            })}
            className="text-[#999] hover:text-[#ccc] text-[10px]"
          >
            Reset
          </button>
        )}
      </div>

      <ColorPresets
        currentEffects={clip.effects}
        onApply={(effects) => setClipEffects(clip.id, effects)}
      />

      <EffectSlider label="Brightness" value={clip.effects.brightness} onChange={(v) => updateEffect('brightness', v)} min={-100} max={100} />
      <EffectSlider label="Contrast" value={clip.effects.contrast} onChange={(v) => updateEffect('contrast', v)} min={-100} max={100} />
      <EffectSlider label="Saturation" value={clip.effects.saturation} onChange={(v) => updateEffect('saturation', v)} min={-100} max={100} />
      <EffectSlider label="Temperature" value={clip.effects.temperature} onChange={(v) => updateEffect('temperature', v)} min={-100} max={100} />
      <EffectSlider label="Highlights" value={clip.effects.highlights} onChange={(v) => updateEffect('highlights', v)} min={-100} max={100} />
      <EffectSlider label="Shadows" value={clip.effects.shadows} onChange={(v) => updateEffect('shadows', v)} min={-100} max={100} />
      <EffectSlider label="Sharpness" value={clip.effects.sharpness} onChange={(v) => updateEffect('sharpness', v)} min={0} max={100} />
      <EffectSlider label="Vignette" value={clip.effects.vignette} onChange={(v) => updateEffect('vignette', v)} min={0} max={100} />
      <EffectSlider label="Noise Reduction" value={clip.effects.noiseReduction} onChange={(v) => updateEffect('noiseReduction', v)} min={0} max={100} />

      {(clip.effects.sharpness > 0 || clip.effects.noiseReduction > 0) && (
        <p className="text-[#666] text-[10px] mt-2 leading-relaxed">
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
  const t = clip.transform;

  const update = (key: keyof ClipTransform, value: number) => {
    setClipTransform(clip.id, { [key]: value });
  };

  return (
    <div className="p-3 border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#999] text-xs font-medium">Transform</span>
        {!isDefaultTransform(t) && (
          <button
            onClick={() => setClipTransform(clip.id, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 })}
            className="text-[#999] hover:text-[#ccc] text-[10px]"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[#999] text-[10px]">X</label>
          <input type="number" value={t.x} onChange={(e) => update('x', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]" />
        </div>
        <div>
          <label className="text-[#999] text-[10px]">Y</label>
          <input type="number" value={t.y} onChange={(e) => update('y', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]" />
        </div>
        <div>
          <label className="text-[#999] text-[10px]">Scale</label>
          <input type="number" min="0.1" max="5" step="0.1" value={t.scaleX}
            onChange={(e) => { const v = parseFloat(e.target.value) || 1; setClipTransform(clip.id, { scaleX: v, scaleY: v }); }}
            className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]" />
        </div>
        <div>
          <label className="text-[#999] text-[10px]">Rotation</label>
          <input type="number" min="-360" max="360" step="1" value={t.rotation}
            onChange={(e) => update('rotation', parseFloat(e.target.value) || 0)}
            className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]" />
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
  const transition = clip.transition;

  return (
    <div className="p-3 border-b border-[#2a2a2a]">
      <span className="text-[#999] text-xs font-medium block mb-2">Transition Out</span>
      <div className="flex items-center gap-2 mb-2">
        <Dropdown
          value={transition?.type ?? ''}
          onChange={(val) => {
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
          <label className="text-[#999] text-[10px]">Duration (s)</label>
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={transition.duration}
            onChange={(e) => {
              setClipTransition(clip.id, {
                type: transition.type as Transition['type'],
                duration: parseFloat(e.target.value) || 0.5,
              });
            }}
            className="w-full bg-[#222] text-[#ccc] text-xs rounded px-2 py-1 border border-[#333]"
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
  const eq = clip.eq ?? DEFAULT_AUDIO_EQ;

  const updateEQ = (key: keyof ClipAudioEQ, val: number | boolean) => {
    setClipEQ(clip.id, { [key]: val });
  };

  return (
    <div className="p-3 border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#999] text-xs font-medium">3-Band Audio EQ</span>
        {(eq.lowGain !== 0 || eq.midGain !== 0 || eq.highGain !== 0 || eq.ducking) && (
          <button
            onClick={() => setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0, ducking: false })}
            className="text-[#999] hover:text-[#ccc] text-[10px]"
          >
            Reset
          </button>
        )}
      </div>

      {/* Low / Bass */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-[#888] mb-0.5">
          <span>Bass (320Hz)</span>
          <span className="font-mono text-[#ccc]">{eq.lowGain > 0 ? `+${eq.lowGain}` : eq.lowGain} dB</span>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={eq.lowGain}
          onChange={(e) => updateEQ('lowGain', parseInt(e.target.value))}
          className="w-full accent-[#3b82f6]"
        />
      </div>

      {/* Mid / Voice */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-[#888] mb-0.5">
          <span>Voice / Mid (1kHz)</span>
          <span className="font-mono text-[#ccc]">{eq.midGain > 0 ? `+${eq.midGain}` : eq.midGain} dB</span>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={eq.midGain}
          onChange={(e) => updateEQ('midGain', parseInt(e.target.value))}
          className="w-full accent-[#3b82f6]"
        />
      </div>

      {/* High / Treble */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-[#888] mb-0.5">
          <span>Treble (3.2kHz)</span>
          <span className="font-mono text-[#ccc]">{eq.highGain > 0 ? `+${eq.highGain}` : eq.highGain} dB</span>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={eq.highGain}
          onChange={(e) => updateEQ('highGain', parseInt(e.target.value))}
          className="w-full accent-[#3b82f6]"
        />
      </div>

      {/* Presets */}
      <div className="mt-2 mb-2">
        <span className="text-[10px] text-[#777] block mb-1">EQ Presets:</span>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setClipEQ(clip.id, { lowGain: 0, midGain: 0, highGain: 0 })}
            className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1 py-0.5 text-center"
          >
            Flat
          </button>
          <button
            onClick={() => setClipEQ(clip.id, { lowGain: -3, midGain: 4, highGain: 2 })}
            className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1 py-0.5 text-center"
          >
            Voice Enhance
          </button>
          <button
            onClick={() => setClipEQ(clip.id, { lowGain: 6, midGain: -1, highGain: 1 })}
            className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1 py-0.5 text-center"
          >
            Bass Boost
          </button>
          <button
            onClick={() => setClipEQ(clip.id, { lowGain: -4, midGain: -2, highGain: 3 })}
            className="text-[10px] bg-[#222] hover:bg-[#333] text-[#ccc] border border-[#333] rounded px-1 py-0.5 text-center"
          >
            Bright Treble
          </button>
        </div>
      </div>

      {/* Auto-Ducking toggle */}
      <label className="flex items-center gap-2 text-[11px] text-[#aaa] mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={eq.ducking}
          onChange={(e) => updateEQ('ducking', e.target.checked)}
          className="accent-[#3b82f6]"
        />
        <span>Auto-duck music when speech plays (-12dB)</span>
      </label>
    </div>
  );
};

export default InspectorPanel;
