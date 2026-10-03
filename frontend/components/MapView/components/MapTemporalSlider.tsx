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

/**
 * formatDate - Formats format date.
 */
function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(timestamp));
}

/**
 * MapTemporalSlider - Renders map temporal slider.
 */
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
    <div className="absolute inset-x-6 bottom-6 z-[990] mx-auto max-w-xl pointer-events-none">
      <div className="rounded-2xl border border-white/10 bg-[#1d1b1a]/95 px-5 py-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c]" />
              Temporal Range Filter
            </div>
            <p className="mt-1 text-sm font-serif text-white">
              {formatDate(startTimestamp)} <span className="text-[#e5a93c] font-mono text-xs mx-1">→</span> {formatDate(endTimestamp)}
            </p>
            <p className="mt-0.5 text-xs font-mono text-zinc-400">
              Showing <span className="text-[#f5f0ed] font-medium">{filteredCount}</span> of {totalCount} geotagged photos
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!isFiltered}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              isFiltered
                ? 'border-white/15 bg-white/5 text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95'
                : 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-600'
            }`}
          >
            Reset Range
          </button>
        </div>

        <div className="relative mt-3 h-8">
          <div className="absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#e5a93c]/70 via-[#e5a93c] to-[#f3ba57] shadow-[0_0_14px_rgba(229,169,60,0.45)]"
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
            className="absolute inset-0 h-8 w-full appearance-none bg-transparent temporal-slider pointer-events-auto cursor-pointer"
          />
          <input
            type="range"
            min={minTimestamp}
            max={maxTimestamp}
            value={endTimestamp}
            onChange={(event) => onEndChange(Number(event.target.value))}
            className="absolute inset-0 h-8 w-full appearance-none bg-transparent temporal-slider pointer-events-auto cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
