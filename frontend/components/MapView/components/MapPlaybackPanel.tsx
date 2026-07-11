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

function formatPlaybackDate(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return 'No date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }).format(new Date(timestamp));
}

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
    <div className="absolute left-6 bottom-28 z-[1000] w-[min(420px,calc(100vw-3rem))]">
      <div className="rounded-[28px] border border-white/10 bg-surface/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-lime-200/85">
              Time-lapse map
            </div>
            <p className="mt-1 text-sm text-white">{formatPlaybackDate(currentTimestamp)}</p>
            <p className="mt-1 text-xs text-gray-400">
              {visibleCount} of {totalCount} mapped photos revealed in chronological playback.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleActive}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
              active
                ? 'border-lime-300/70 bg-lime-200/90 text-black'
                : 'border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10'
            }`}
          >
            <Clapperboard size={13} />
            {active ? 'Time-lapse on' : 'Enable'}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={!active}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
              active
                ? 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-gray-500'
            }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!active}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
              active
                ? 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-gray-500'
            }`}
          >
            <RotateCcw size={15} />
          </button>
          <div className="relative flex-1">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/8" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-lime-200 via-primary to-sky-300 shadow-[0_0_20px_rgba(210,255,114,0.25)]"
              style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
            />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(event) => onProgressChange(Number(event.target.value) / 1000)}
              disabled={!active}
              className="temporal-slider relative h-10 w-full appearance-none bg-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
