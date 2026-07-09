/**
 * TransitionsPanel — Browse and apply transitions between clips.
 */
import React, { useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { Transition } from '@/types/nle';

interface TransitionPreset {
  name: string;
  icon: string;
  type: Transition['type'];
  duration: number;
}

const TRANSITION_PRESETS: TransitionPreset[] = [
  { name: 'Crossfade', icon: '✕', type: 'crossfade', duration: 0.5 },
  { name: 'Dissolve', icon: '◐', type: 'dissolve', duration: 0.5 },
  { name: 'Wipe Left', icon: '◀', type: 'wipe-left', duration: 0.5 },
  { name: 'Wipe Right', icon: '▶', type: 'wipe-right', duration: 0.5 },
  { name: 'Slide Left', icon: '⬅', type: 'slide-left', duration: 0.5 },
  { name: 'Slide Right', icon: '➡', type: 'slide-right', duration: 0.5 },
  { name: 'Crossfade (1s)', icon: '✕', type: 'crossfade', duration: 1.0 },
  { name: 'Dissolve (1s)', icon: '◐', type: 'dissolve', duration: 1.0 },
  { name: 'Wipe Left (1s)', icon: '◀', type: 'wipe-left', duration: 1.0 },
  { name: 'Wipe Right (1s)', icon: '▶', type: 'wipe-right', duration: 1.0 },
];

export const TransitionsPanel: React.FC = () => {
  const selectedClip = useNLEStore((s) => s.getSelectedClip());
  const setClipTransition = useNLEStore((s) => s.setClipTransition);

  const applyTransition = useCallback((preset: TransitionPreset) => {
    if (!selectedClip) return;
    setClipTransition(selectedClip.id, {
      type: preset.type,
      duration: preset.duration,
    });
  }, [selectedClip, setClipTransition]);

  const removeTransition = useCallback(() => {
    if (!selectedClip) return;
    setClipTransition(selectedClip.id, undefined);
  }, [selectedClip, setClipTransition]);

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
      <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Transitions</span>
      </div>

      {!selectedClip ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-[#666] text-xs text-center">
            Select a clip on the timeline to add a transition.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {/* Remove transition button */}
          {selectedClip.transition && (
            <button
              onClick={removeTransition}
              className="w-full mb-2 px-3 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-800/50 text-red-400 text-[11px] rounded transition-colors"
            >
              Remove Current Transition
            </button>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {TRANSITION_PRESETS.map((preset, idx) => (
              <button
                key={`${preset.type}-${preset.duration}-${idx}`}
                onClick={() => applyTransition(preset)}
                className={`flex flex-col items-center gap-1 p-2 rounded border transition-colors ${
                  selectedClip.transition?.type === preset.type && selectedClip.transition?.duration === preset.duration
                    ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]'
                    : 'bg-[#222] hover:bg-[#2a2a2a] border-[#333] hover:border-[#555]'
                }`}
              >
                <span className="text-lg">{preset.icon}</span>
                <span className="text-[#ccc] text-[10px] leading-tight text-center">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransitionsPanel;
