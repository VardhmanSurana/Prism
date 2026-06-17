/**
 * ZoomControls.tsx
 * Floating zoom HUD rendered at the bottom-center of the canvas area.
 *
 * Provides:
 *  - Decrement / increment zoom buttons (−10% / +10%)
 *  - A numeric percentage readout that also acts as "click to reset to fit"
 *  - Keyboard shortcut hints on hover
 */

import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomControlsProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  const displayPercent = Math.round(zoomPercent);

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 
                 px-3 py-1.5 rounded-2xl border border-white/8
                 bg-black/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]
                 select-none animate-in fade-in zoom-in-95 duration-200"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        title="Zoom Out (Ctrl+-)"
        className="p-1.5 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/5 
                   transition-all duration-150 active:scale-90"
      >
        <ZoomOut size={13} strokeWidth={2} />
      </button>

      {/* Percentage readout — click to reset */}
      <button
        onClick={onReset}
        title="Reset zoom to fit (Ctrl+0)"
        className="group flex items-center gap-1.5 px-2 py-0.5 rounded-lg 
                   text-white/60 hover:text-white/90 hover:bg-white/5 
                   transition-all duration-150"
      >
        <span className="text-[11px] font-mono tabular-nums font-bold w-10 text-center">
          {displayPercent}%
        </span>
        <Maximize2
          size={9}
          strokeWidth={2.5}
          className="text-white/20 group-hover:text-white/50 transition-colors shrink-0"
        />
      </button>

      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        title="Zoom In (Ctrl+=)"
        className="p-1.5 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/5 
                   transition-all duration-150 active:scale-90"
      >
        <ZoomIn size={13} strokeWidth={2} />
      </button>
    </div>
  );
};
