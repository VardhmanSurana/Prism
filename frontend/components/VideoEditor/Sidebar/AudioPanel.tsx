import React from 'react';
import { Volume2, VolumeX, Plus } from 'lucide-react';
import { AudioPanelProps } from '../types';

export const AudioPanel: React.FC<AudioPanelProps> = ({ tracks, onVolumeChange, onMuteToggle }) => {
  const audioTracks = tracks.filter(t => t.type === 'audio');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Audio Tracks
        </label>

        {audioTracks.length === 0 && (
          <p className="text-[11px] text-white/20 py-4 text-center">No audio tracks</p>
        )}

        {audioTracks.map(track => (
          <div
            key={track.id}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => onMuteToggle(track.id)}
                  className={`shrink-0 p-1.5 rounded-md transition-all ${
                    track.muted
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-white/[0.03] text-white/40 hover:text-white/60'
                  }`}
                >
                  {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <span className="text-[11px] text-white/60 truncate">{track.name}</span>
              </div>
              <span className="text-[10px] text-white/30 font-mono shrink-0">
                {Math.round(track.volume * 100)}%
              </span>
            </div>

            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(track.volume * 100)}
                onChange={(e) => onVolumeChange(track.id, Number(e.target.value) / 100)}
                disabled={track.muted}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer disabled:opacity-30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer disabled:[&::-webkit-slider-thumb]:bg-white/20"
              />
            </div>

            {track.clips.length > 0 && (
              <div className="space-y-2 pt-1">
                {track.clips.map(clip => (
                  <div key={clip.id} className="flex items-center gap-2 text-[10px] text-white/30">
                    <span className="truncate">{clip.sourcePath?.split('/').pop()}</span>
                    <span className="ml-auto shrink-0">{Math.round(clip.duration)}s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Fade
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-white/30">Fade In (s)</span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              defaultValue={0}
              className="w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/15 transition-colors font-mono"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/30">Fade Out (s)</span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              defaultValue={0}
              className="w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/5 text-[11px] text-white/70 outline-none focus:border-white/15 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/10 text-[11px] text-white/30 hover:text-white/50 hover:border-white/20 transition-all">
        <Plus size={14} />
        Add Audio File
      </button>
    </div>
  );
};
