import React from 'react';
import { Pause, Play, RotateCcw, Clapperboard } from 'lucide-react';

interface MapPlaybackPanelProps {
  active: boolean;
  isPlaying: boolean;
  progress: number;
  currentTimestamp: number | null;
  visibleCount: number;
  totalCount: number;
  onToggleActive: () => void;
  onTogglePlayback: () => void;
  onProgressChange: (progress: number) => void;
  onReset: () => void;
}

/**
 * formatPlaybackDate - Formats format playback date.
 */
function formatPlaybackDate(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return 'No date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }).format(new Date(timestamp));
}

/**
 * MapPlaybackPanel - Renders map playback panel.
 */
export const MapPlaybackPanel: React.FC<MapPlaybackPanelProps> = ({
  active,
  isPlaying,
  progress,
  currentTimestamp,
  visibleCount,
  totalCount,
  onToggleActive,
  onTogglePlayback,
  onProgressChange,
  onReset,
}) => {
  return (
    <div className="absolute left-6 bottom-24 z-[1000] w-[min(400px,calc(100vw-3rem))] pointer-events-none">
      <div className="rounded-2xl border border-white/10 bg-[#1d1b1a]/95 px-5 py-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] animate-pulse" />
              Chronological Replay
            </div>
            <p className="mt-1 text-base font-serif text-white">{formatPlaybackDate(currentTimestamp)}</p>
            <p className="mt-0.5 text-xs font-mono text-zinc-400">
              <span className="text-[#f5f0ed] font-medium">{visibleCount}</span> of {totalCount} photos mapped
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleActive}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? 'border-white/15 bg-[#302d2c] text-white shadow-sm'
                : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clapperboard size={13} className={active ? 'text-[#e5a93c]' : 'text-zinc-400'} />
            <span>{active ? 'Active' : 'Enable'}</span>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c]" />}
          </button>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={!active}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              active
                ? 'border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10 active:scale-95'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-600'
            }`}
            title={isPlaying ? 'Pause' : 'Play replay'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!active}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              active
                ? 'border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10 active:scale-95'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-600'
            }`}
            title="Reset to beginning"
          >
            <RotateCcw size={14} />
          </button>
          <div className="relative flex-1">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#e5a93c]/70 via-[#e5a93c] to-[#f3ba57] shadow-[0_0_12px_rgba(229,169,60,0.45)]"
              style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
            />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(event) => onProgressChange(Number(event.target.value) / 1000)}
              disabled={!active}
              className="temporal-slider relative h-8 w-full appearance-none bg-transparent cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
