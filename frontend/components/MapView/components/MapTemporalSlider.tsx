import React from 'react';

interface MapTemporalSliderProps {
  minTimestamp: number;
  maxTimestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  filteredCount: number;
  totalCount: number;
  onStartChange: (timestamp: number) => void;
  onEndChange: (timestamp: number) => void;
  onReset: () => void;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(timestamp));
}

export const MapTemporalSlider: React.FC<MapTemporalSliderProps> = ({
  minTimestamp,
  maxTimestamp,
  startTimestamp,
  endTimestamp,
  filteredCount,
  totalCount,
  onStartChange,
  onEndChange,
  onReset,
}) => {
  const range = Math.max(1, maxTimestamp - minTimestamp);
  const startPct = ((startTimestamp - minTimestamp) / range) * 100;
  const endPct = ((endTimestamp - minTimestamp) / range) * 100;
  const isFiltered = startTimestamp !== minTimestamp || endTimestamp !== maxTimestamp;

  return (
    <div className="absolute inset-x-6 bottom-6 z-[1000] mx-auto max-w-3xl">
      <div className="rounded-[28px] border border-white/10 bg-surface/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-200/85">
              Temporal filter
            </div>
            <p className="mt-1 text-sm text-white">
              {formatDate(startTimestamp)} to {formatDate(endTimestamp)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Showing {filteredCount} of {totalCount} geotagged photos in this date window.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!isFiltered}
            className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition ${
              isFiltered
                ? 'border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-gray-500'
            }`}
          >
            Reset range
          </button>
        </div>

        <div className="relative mt-4 h-9">
          <div className="absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/8" />
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-300 via-primary to-lime-200 shadow-[0_0_22px_rgba(120,180,255,0.25)]"
            style={{
              left: `${startPct}%`,
              width: `${Math.max(0, endPct - startPct)}%`,
            }}
          />
          <input
            type="range"
            min={minTimestamp}
            max={maxTimestamp}
            value={startTimestamp}
            onChange={(event) => onStartChange(Number(event.target.value))}
            className="absolute inset-0 h-9 w-full appearance-none bg-transparent temporal-slider pointer-events-auto"
          />
          <input
            type="range"
            min={minTimestamp}
            max={maxTimestamp}
            value={endTimestamp}
            onChange={(event) => onEndChange(Number(event.target.value))}
            className="absolute inset-0 h-9 w-full appearance-none bg-transparent temporal-slider pointer-events-auto"
          />
        </div>
      </div>
    </div>
  );
};
