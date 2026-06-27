import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationArrowsProps } from './types';

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
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-white/0 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 z-10"
        title="Previous (←)"
      >
        <ChevronLeft size={32} strokeWidth={1.5} />
      </button>

      {/* Right arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/0 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 z-10"
        title="Next (→)"
      >
        <ChevronRight size={32} strokeWidth={1.5} />
      </button>

      {/* Photo counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/20 tabular-nums z-10">
        {currentIndex + 1} / {totalCount}
      </div>
    </>
  );
};
