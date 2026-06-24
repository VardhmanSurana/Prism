import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationArrowsProps } from './types';

export const NavigationArrows: React.FC<NavigationArrowsProps> = ({
  zoomScale,
  onPrev,
  onNext
}) => {
  if (zoomScale !== 1) return null;

  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-8 pointer-events-none">
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="pointer-events-auto p-4 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
      >
        <ChevronLeft size={48} strokeWidth={1.5} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="pointer-events-auto p-4 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
      >
        <ChevronRight size={48} strokeWidth={1.5} />
      </button>
    </div>
  );
};
