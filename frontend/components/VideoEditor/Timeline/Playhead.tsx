import React, { useCallback, useRef, useState } from 'react';

interface PlayheadProps {
  currentTime: number;
  zoom: number;
  onSeek: (time: number) => void;
  trackHeight: number;
}

export const Playhead: React.FC<PlayheadProps> = ({ currentTime, zoom, onSeek, trackHeight }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartTime.current = currentTime;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragStartX.current;
        const newTime = Math.max(0, dragStartTime.current + delta / zoom);
        onSeek(newTime);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [currentTime, zoom, onSeek],
  );

  const left = currentTime * zoom;

  return (
    <div
      className="absolute top-0 z-30 pointer-events-none"
      style={{ left, height: trackHeight + 32 }}
    >
      <div className="relative w-px bg-red-500 h-full pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-auto cursor-col-resize"
        onMouseDown={handleMouseDown}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`transition-all duration-150 ${isDragging ? 'scale-110 text-red-400' : 'hover:scale-110 text-red-500'}`}
        >
          <polygon points="6,0 12,6 6,12 0,6" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
};
