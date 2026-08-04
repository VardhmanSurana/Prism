/**
 * ZoomControls.tsx
 * Bottom zoom toolbar rendered at the bottom-center of the canvas area.
 */

import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomTo: (pct: number) => void;
  minZoom?: number;
  maxZoom?: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onReset,
  onZoomTo,
  minZoom = 10,
  maxZoom = 500,
}) => {
  const [localZoom, setLocalZoom] = React.useState(zoomPercent);

  React.useEffect(() => {
    setLocalZoom(zoomPercent);
  }, [zoomPercent]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalZoom(val);
    onZoomTo(val);
  };

  const displayPercent = Math.round(localZoom);
  const isMin = localZoom <= minZoom;
  const isMax = localZoom >= maxZoom;

  return (
    <div className="h-12 bg-[var(--bg-primary)] border-t border-white/5 flex items-center justify-between px-6 shrink-0 z-30 select-none">
      {/* Zoom Ratio Selection (Fit, 50%, 100%, 200%) */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onReset}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
            localZoom !== 50 && localZoom !== 100 && localZoom !== 200
              ? 'bg-white text-[#050505] font-bold shadow-md'
              : 'bg-[var(--bg-secondary)] text-white/50 border border-white/5 hover:text-white hover:bg-white/5'
          }`}
          title="Zoom to Fit (Ctrl+0)"
        >
          Fit
        </button>
        {[50, 100, 200].map(pct => {
          const isActive = displayPercent === pct;
          return (
            <button
              key={pct}
              onClick={() => {
                setLocalZoom(pct);
                onZoomTo(pct);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#050505] font-bold shadow-md'
                  : 'bg-[var(--bg-secondary)] text-white/50 border border-white/5 hover:text-white hover:bg-white/5'
              }`}
              title={`Zoom to ${pct}%`}
            >
              {pct}%
            </button>
          );
        })}
      </div>

      {/* Slider Controls */}
      <div className="flex items-center gap-4 w-72 max-w-full">
        {/* Zoom Out Button */}
        <button
          onClick={onZoomOut}
          disabled={isMin}
          title="Zoom Out (Ctrl+-)"
          className="p-1 rounded-lg text-white/45 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 cursor-pointer"
        >
          <ZoomOut size={13} strokeWidth={2.5} />
        </button>

        {/* Range Slider */}
        <div className="flex-1 relative h-4 flex items-center group/zoom-slider">
          <div className="absolute w-full h-[2px] bg-white/10 rounded-full" />
          <div
            className="absolute h-[2px] rounded-full pointer-events-none bg-white/80"
            style={{
              left: '0%',
              width: `${((localZoom - minZoom) / (maxZoom - minZoom)) * 100}%`,
            }}
          />
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            value={localZoom}
            onChange={handleSliderChange}
            className="w-full appearance-none bg-transparent h-4 outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-125"
          />
        </div>

        {/* Zoom In Button */}
        <button
          onClick={onZoomIn}
          disabled={isMax}
          title="Zoom In (Ctrl+=)"
          className="p-1 rounded-lg text-white/45 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 cursor-pointer"
        >
          <ZoomIn size={13} strokeWidth={2.5} />
        </button>

        {/* Numeric Readout */}
        <span className="text-[10px] font-mono tabular-nums font-bold text-white/60 w-12 text-right">
          {displayPercent}%
        </span>
      </div>
    </div>
  );
};
