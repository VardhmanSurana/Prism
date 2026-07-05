import React from 'react';
import { Check } from 'lucide-react';
import { PhotoGridHeaderProps } from './types';
import { formatDate } from './utils';

export const PhotoGridHeader: React.FC<PhotoGridHeaderProps> = ({
  dateKey,
  photoIds,
  location,
  selectedIds,
  onToggleGroupSelection,
  virtualRowStart,
  virtualRowKey,
  virtualRowIndex,
  measureElement,
}) => {
  const { dayName, fullDate, year } = formatDate(dateKey);
  const isCurrentYear = year === new Date().getFullYear();
  const allSelected = photoIds.every((id) => selectedIds.has(id));
  const someSelected = photoIds.some((id) => selectedIds.has(id)) && !allSelected;

  return (
    <div
      key={virtualRowKey}
      data-index={virtualRowIndex}
      ref={measureElement}
      className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-32 z-10"
      style={{ transform: `translateY(${virtualRowStart}px)` }}
    >
      <div className="flex items-baseline justify-between select-none py-4 bg-background/80 backdrop-blur-sm border-b border-white/5">
        <div
          className="flex items-center gap-3 group cursor-pointer"
          onClick={() => onToggleGroupSelection(photoIds)}
        >
          <div
            className={`w-6 h-6 border rounded-full transition-all flex items-center justify-center
            ${
              allSelected
                ? 'bg-primary border-primary'
                : someSelected
                  ? 'border-primary/60 bg-primary/20'
                  : 'border-white/20 group-hover:border-white/50'
            }
          `}
          >
            <Check
              size={14}
              className={`${allSelected || someSelected ? 'opacity-100' : 'opacity-0'} ${allSelected ? 'text-black' : 'text-primary'} transition-opacity`}
            />
          </div>
          <div className="flex flex-col">
            <h3 className="text-3xl font-serif italic text-white leading-none tracking-tight">
              {dayName}, {fullDate}
            </h3>
            {!isCurrentYear && (
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mt-1">
                {year}
              </span>
            )}
          </div>
        </div>
        {location && (
          <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500 hover:text-primary transition-colors cursor-default">
            {location}
          </span>
        )}
      </div>
    </div>
  );
};
