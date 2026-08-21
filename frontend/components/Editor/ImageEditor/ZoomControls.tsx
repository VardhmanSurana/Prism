/**
 * ZoomControls.tsx
 * Floating glassmorphic zoom HUD widget rendered directly inside the canvas.
 */

import React, { useState, useEffect } from 'react';
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
  const [localZoom, setLocalZoom] = useState(zoomPercent);

  useEffect(() => {
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
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#12141a]/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] select-none animate-in fade-in duration-200 pointer-events-auto">
      {/* Fit Button */}
      <button
        onClick={onReset}
        title="Fit to Screen (Ctrl+0)"
        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
          localZoom !== 50 && localZoom !== 100 && localZoom !== 200
            ? 'bg-white text-black font-bold shadow-md shadow-white/10'
            : 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]'
        }`}
      >
        Fit
      </button>

      {/* Preset pills */}
      {[50, 100, 200].map(pct => {
        const isActive = displayPercent === pct;
        return (
          <button
            key={pct}
            onClick={() => {
              setLocalZoom(pct);
              onZoomTo(pct);
            }}
            title={`Zoom to ${pct}%`}
            className={`px-2 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-black font-bold shadow-md shadow-white/10'
                : 'bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            {pct}%
          </button>
        );
      })}

      <div className="h-3 w-px bg-white/10 mx-0.5" />

      {/* Zoom Out Button */}
      <button
        onClick={onZoomOut}
        disabled={isMin}
        title="Zoom Out (Ctrl+-)"
        className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-20 cursor-pointer"
      >
        <ZoomOut size={12} strokeWidth={2.5} />
      </button>

      {/* Mini Range Slider */}
      <div className="w-20 relative h-3 flex items-center group/zoom-slider">
        <div className="absolute w-full h-[2px] bg-white/15 rounded-full" />
        <div
          className="absolute h-[2px] rounded-full pointer-events-none bg-white"
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
          className="w-full appearance-none bg-transparent h-3 outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(255,255,255,0.7)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-125"
        />
      </div>

      {/* Zoom In Button */}
      <button
        onClick={onZoomIn}
        disabled={isMax}
        title="Zoom In (Ctrl+=)"
        className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-20 cursor-pointer"
      >
        <ZoomIn size={12} strokeWidth={2.5} />
      </button>

      {/* Numeric Readout */}
      <button
        onClick={onReset}
        title="Click to reset zoom"
        className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-bold text-white/70 hover:text-white rounded transition-colors cursor-pointer"
      >
        {displayPercent}%
      </button>
    </div>
  );
};
