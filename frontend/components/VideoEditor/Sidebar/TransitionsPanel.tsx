import React from 'react';
import { Layers, CircleDashed, Sun, Moon } from 'lucide-react';
import { TransitionsPanelProps } from '../types';
import { TransitionType } from '@/store/videoEditorStore';

const TRANSITIONS: { id: TransitionType; label: string; icon: React.ReactNode }[] = [
  { id: 'none', label: 'None', icon: <CircleDashed size={14} /> },
  { id: 'crossfade', label: 'Crossfade', icon: <Layers size={14} /> },
  { id: 'fadeBlack', label: 'Fade to Black', icon: <Moon size={14} /> },
  { id: 'fadeWhite', label: 'Fade to White', icon: <Sun size={14} /> },
];

export const TransitionsPanel: React.FC<TransitionsPanelProps> = ({ selectedClip, onUpdate }) => {
  const currentTransition = selectedClip?.transitionIn ?? 'none';
  const currentDuration = selectedClip?.transitionDuration ?? 0.5;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Transition In
        </label>

        {!selectedClip && (
          <p className="text-[11px] text-white/20 py-4 text-center">Select a clip to set transitions</p>
        )}

        <div className="space-y-1">
          {TRANSITIONS.map(t => {
            const isActive = currentTransition === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onUpdate({ transitionIn: t.id })}
                disabled={!selectedClip}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-left disabled:opacity-30 disabled:pointer-events-none ${
                  isActive
                    ? 'bg-primary/10 border border-primary/30 text-primary'
                    : 'bg-white/[0.02] border border-white/5 text-white/40 hover:text-white/60 hover:bg-white/[0.05] hover:border-white/10'
                }`}
              >
                <div className={`shrink-0 ${isActive ? 'text-primary' : 'text-white/30'}`}>
                  {t.icon}
                </div>
                <span className="text-[11px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {currentTransition !== 'none' && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
            Duration
          </label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Length</span>
              <span className="text-[10px] text-white/40 font-mono">{currentDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={currentDuration}
              onChange={(e) => onUpdate({ transitionDuration: Number(e.target.value) })}
              className="adjustment-slider"
            />
            <div className="flex justify-between">
              <span className="text-[9px] text-white/15">0.1s</span>
              <span className="text-[9px] text-white/15">2.0s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
