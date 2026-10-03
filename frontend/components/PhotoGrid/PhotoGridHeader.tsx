import React from 'react';
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
}) => {
  const { settings } = useGalleryLayout();
  const { imageGrouping } = settings;

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

  const isAllSelected = photoIds.length > 0 && !!selectedIds && photoIds.every((id) => selectedIds.has(String(id)));
  const isSomeSelected = !isAllSelected && photoIds.length > 0 && !!selectedIds && photoIds.some((id) => selectedIds.has(String(id)));

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleGroupSelection?.(photoIds.map(String));
  };

  return (
    <div
      key={virtualRowKey}
      data-index={virtualRowIndex}
      ref={measureElement}
      className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-12 xl:pr-24 z-10"
      style={{ transform: `translateY(${virtualRowStart}px)` }}
    >
      <div className="group/dateheader flex items-baseline justify-between select-none py-4 bg-transparent border-b border-[#292524]/40">
        <div className="flex flex-col">
          <div className="flex items-center relative">
            {/* Hover / Active Checkbox */}
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 transition-all duration-200 ease-out z-10 flex items-center ${
                isAllSelected || isSomeSelected
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-90 group-hover/dateheader:opacity-100 group-hover/dateheader:scale-100 pointer-events-none group-hover/dateheader:pointer-events-auto'
              }`}
            >
              <button
                type="button"
                onClick={handleCheckboxClick}
                title={isAllSelected ? "Deselect all" : "Select all"}
                aria-label={`Select all photos from ${displayTitle}`}
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-150 cursor-pointer shadow-sm ${
                  isAllSelected
                    ? 'bg-[#3b82f6] border-[#3b82f6] text-white'
                    : isSomeSelected
                    ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#60a5fa]'
                    : 'bg-[#1c1917]/80 hover:bg-[#292524] border-white/20 hover:border-white/40 text-transparent hover:text-white/40'
                }`}
              >
                {isAllSelected ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isSomeSelected ? (
                  <div className="w-2.5 h-0.5 bg-current rounded-full" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </div>

            {/* Date Title with shift right on hover / select */}
            <div
              className={`flex items-center gap-2.5 transition-transform duration-200 ease-out ${
                isAllSelected || isSomeSelected
                  ? 'translate-x-7'
                  : 'translate-x-0 group-hover/dateheader:translate-x-7'
              }`}
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#f5f5f4] tracking-tight font-light leading-snug">
                {displayTitle}
              </h2>
              {/* Green indicator dot for recent / current photos */}
              {(displayTitle.includes('Today') || dateKey === new Date().toISOString().split('T')[0]) && (
                <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399] shrink-0" />
              )}
            </div>
          </div>

          <p
            className={`text-xs sm:text-sm text-[#78716c] mt-0.5 font-normal tracking-wide transition-transform duration-200 ease-out ${
              isAllSelected || isSomeSelected
                ? 'translate-x-7'
                : 'translate-x-0 group-hover/dateheader:translate-x-7'
            }`}
          >
            {location ? `${location} • ` : ''}
            {photoIds.length} Archival Exposure{photoIds.length === 1 ? '' : 's'}
            {displaySub ? ` (${displaySub})` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

