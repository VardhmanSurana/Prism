import React, { useRef, useCallback } from 'react';

interface TimeRulerProps {
  duration: number;
  zoom: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TimeRuler: React.FC<TimeRulerProps> = ({ duration, zoom, currentTime, onSeek }) => {
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
      onSeek(x / zoom);
    },
    [zoom, onSeek],
  );

  const totalWidth = duration * zoom;
  const ticks: React.ReactNode[] = [];

  for (let t = 0; t <= duration; t++) {
    const isLarge = t % 10 === 0;
    const isMedium = t % 5 === 0;
    const tickHeight = isLarge ? 14 : isMedium ? 10 : 5;
    const tickColor = isLarge ? 'bg-white/50' : isMedium ? 'bg-white/30' : 'bg-white/15';

    ticks.push(
      <div
        key={t}
        className="absolute top-0 flex flex-col items-center"
        style={{ left: t * zoom }}
      >
        <div className={`w-px ${tickColor}`} style={{ height: tickHeight }} />
        {isLarge && (
          <span className="text-[9px] text-white/40 font-mono mt-0.5 select-none">
            {formatTime(t)}
          </span>
        )}
      </div>,
    );
  }

  return (
    <div
      ref={rulerRef}
      className="relative h-8 bg-[#0a0a0a] border-t border-white/5 cursor-pointer overflow-x-auto overflow-y-hidden select-none"
      onClick={handleClick}
      style={{ minWidth: '100%' }}
    >
      <div className="relative h-full" style={{ width: totalWidth, minWidth: '100%' }}>
        {ticks}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/60 pointer-events-none"
          style={{ left: currentTime * zoom }}
        />
      </div>
    </div>
  );
};
