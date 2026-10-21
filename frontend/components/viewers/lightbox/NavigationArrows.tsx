import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationArrowsProps } from './types';

/**
 * Previous/next navigation arrows and photo counter for the lightbox.
 * Hidden automatically when the image is zoomed (zoomScale !== 1).
 */
export const NavigationArrows: React.FC<NavigationArrowsProps> = ({
  zoomScale,
  currentIndex,
  totalCount,
  onPrev,
  onNext
}) => {
  if (zoomScale !== 1) return null;

  return (
    <>
      {/* Left arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 text-zinc-400 hover:text-white bg-[#1d1b1a]/60 hover:bg-[#1d1b1a]/90 border border-white/10 backdrop-blur-md rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10 cursor-pointer shadow-lg"
        title="Previous (←)"
      >
        <ChevronLeft size={22} strokeWidth={2} />
      </button>

      {/* Right arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 text-zinc-400 hover:text-white bg-[#1d1b1a]/60 hover:bg-[#1d1b1a]/90 border border-white/10 backdrop-blur-md rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10 cursor-pointer shadow-lg"
        title="Next (→)"
      >
        <ChevronRight size={22} strokeWidth={2} />
      </button>

      {/* Photo counter */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#1d1b1a]/80 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-400 tabular-nums z-10 pointer-events-none">
        {currentIndex + 1} / {totalCount}
      </div>
    </>
  );
};
