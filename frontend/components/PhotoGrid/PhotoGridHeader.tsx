import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PhotoGridHeaderProps } from './types';
import { formatDate } from './utils';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

/**
 * PhotoGridHeader - Renders photo grid header.
 */
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
  isHovered,
}) => {
  const { settings } = useGalleryLayout();
  const { galleryStyle, imageGrouping } = settings;
  /**
   * allSelected - Performs all selected.
   */
  const allSelected = photoIds.every((id) => selectedIds.has(id));
  /**
   * someSelected - Performs some selected.
   */
  const someSelected = photoIds.some((id) => selectedIds.has(id)) && !allSelected;
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  let displayTitle = '';
  let displaySub = '';

  if (imageGrouping === 'months') {
    if (dateKey !== 'Unknown') {
      const date = new Date(dateKey + "-02");
      if (!isNaN(date.getTime())) {
        displayTitle = date.toLocaleDateString('en-US', { month: 'long' });
        displaySub = date.toLocaleDateString('en-US', { year: 'numeric' });
      } else {
        displayTitle = 'Unknown Month';
      }
    } else {
      displayTitle = 'Unknown Date';
    }
  } else if (imageGrouping === 'years') {
    displayTitle = dateKey;
  } else {
    const { dayName, fullDate, year } = formatDate(dateKey);
    const isCurrentYear = year === new Date().getFullYear();
    displayTitle = `${dayName}, ${fullDate}`;
    displaySub = !isCurrentYear ? String(year) : '';
  }

  if (galleryStyle === 'google') {
    return (
      <div
        key={virtualRowKey}
        data-index={virtualRowIndex}
        ref={measureElement}
        className="absolute top-0 left-0 w-full pl-6 sm:pl-10 pr-24 z-10 font-sans"
        style={{ transform: `translateY(${virtualRowStart}px)` }}
      >
        <div
          className="flex items-baseline justify-between select-none py-2 bg-[#131314]"
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
        >
          <div
            className={`flex items-center group cursor-pointer transition-all duration-200 ${
              isHeaderHovered || isHovered || allSelected || someSelected ? 'gap-2.5' : ''
            }`}
            onClick={() => onToggleGroupSelection(photoIds)}
          >
            <div
              className={`border rounded-full flex items-center justify-center transition-all duration-200 ${
                isHeaderHovered || isHovered || allSelected || someSelected
                  ? 'w-5 h-5 opacity-100'
                  : 'w-0 h-0 opacity-0'
              } ${
                allSelected
                  ? 'bg-[#A8C7FA] border-[#A8C7FA]'
                  : someSelected
                    ? 'border-[#A8C7FA]/60 bg-[#A8C7FA]/20'
                    : 'border-white/30 group-hover:border-white/60'
              }`}
            >
              <Check
                size={12}
                className={`${allSelected || someSelected ? 'opacity-100' : 'opacity-0'} ${allSelected ? 'text-black' : 'text-[#A8C7FA]'} transition-opacity`}
              />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-sans font-medium text-[#C4C6D0] leading-none">
                {displayTitle} {displaySub ? displaySub : ''}
              </h3>
            </div>
          </div>
          {location && (
            <span className="text-xs font-sans text-gray-400">
              {location}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      key={virtualRowKey}
      data-index={virtualRowIndex}
      ref={measureElement}
      className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-32 z-10"
      style={{ transform: `translateY(${virtualRowStart}px)` }}
    >
      <div
        className="flex items-baseline justify-between select-none py-4 bg-background"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <div
          className={`flex items-center group cursor-pointer transition-all duration-200 ${
            isHeaderHovered || isHovered || allSelected || someSelected ? 'gap-3' : ''
          }`}
          onClick={() => onToggleGroupSelection(photoIds)}
        >
          <div
            className={`border rounded-full flex items-center justify-center transition-all duration-200 ${
              isHeaderHovered || isHovered || allSelected || someSelected
                ? 'w-6 h-6 opacity-100'
                : 'w-0 h-0 opacity-0'
            } ${
              allSelected
                ? 'bg-primary border-primary'
                : someSelected
                  ? 'border-primary/60 bg-primary/20'
                  : 'border-white/20 group-hover:border-white/50'
            }`}
          >
            <Check
              size={14}
              className={`${allSelected || someSelected ? 'opacity-100' : 'opacity-0'} ${allSelected ? 'text-black' : 'text-primary'} transition-opacity`}
            />
          </div>
          <div className="flex flex-col transition-all duration-200">
            <h3 className="text-3xl font-serif italic text-white leading-none tracking-tight">
              {displayTitle}
            </h3>
            {displaySub && (
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mt-1">
                {displaySub}
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
