import React, { useMemo } from 'react';
import { formatTimecode } from '../utils';

interface PlayheadProps {
  playheadPosition: number;
  pixelsPerSec: number;
  projectFps: number;
  timelineWidth: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  playheadPosition,
  pixelsPerSec,
  projectFps,
  timelineWidth,
}) => {
  const playheadX = useMemo(
    () => (playheadPosition / projectFps) * pixelsPerSec,
    [playheadPosition, projectFps, pixelsPerSec]
  );

  return (
    <div
      className="absolute top-0 bottom-0 z-50 pointer-events-none"
      style={{
        left: `${playheadX}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Playhead line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />

      {/* Playhead handle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
        <svg width="13" height="18" viewBox="0 0 13 18" fill="none" className="drop-shadow-md">
          <path d="M0 2C0 0.895431 0.895431 0 2 0H11C12.1046 0 13 0.895431 13 2V10L6.5 18L0 10V2Z" fill="#f43f5e" />
        </svg>
        {/* Playhead time tooltip */}
        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1c1c1c] text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap transition-opacity pointer-events-none border border-white/10 z-50">
          {formatTimecode(playheadPosition / projectFps)}
        </div>
      </div>
    </div>
  );
};
