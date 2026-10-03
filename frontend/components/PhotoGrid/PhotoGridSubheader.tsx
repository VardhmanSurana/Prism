import React, { useMemo } from 'react';
import {
  LayoutTemplate,
  LayoutGrid,
  Grid3x3,
  Calendar,
  SlidersHorizontal,
  X,
  BookOpen,
} from 'lucide-react';
import type { GalleryLayoutMode } from '@/store/galleryLayoutStore';
import { Photo } from '@/types';

export interface DateFilterPill {
  id: string;
  label: string;
  dateKey?: string;
}

export interface PhotoGridSubheaderProps {
  photos: Photo[];
  selectedCount: number;
  onClearSelection: () => void;
  activeLayoutMode: GalleryLayoutMode;
  onLayoutModeChange: (mode: GalleryLayoutMode) => void;
  onSelectDateMilestone?: (dateKey: string | null) => void;
  onMonographClick?: () => void;
  activeFilter?: string;
  onActiveFilterChange?: (filterId: string) => void;
}

export const PhotoGridSubheader: React.FC<PhotoGridSubheaderProps> = React.memo(({
  photos,
  selectedCount,
  onClearSelection,
  activeLayoutMode,
  onLayoutModeChange,
  onSelectDateMilestone,
  onMonographClick,
  activeFilter = 'all',
  onActiveFilterChange,
}) => {
  // Compute smart date filter pills from the photos in the library
  const filterPills = useMemo<DateFilterPill[]>(() => {
    const pills: DateFilterPill[] = [
      { id: 'all', label: 'All Archive' },
    ];

    if (photos.length === 0) return pills;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find if we have photos from today, yesterday, recent months
    const dateKeys = new Set<string>();
    const monthKeys = new Set<string>();

    for (const p of photos) {
      if (p.date) {
        const dk = p.date.split('T')[0];
        dateKeys.add(dk);
        monthKeys.add(dk.substring(0, 7)); // YYYY-MM
      }
    }

    if (dateKeys.has(todayStr)) {
      pills.push({ id: 'today', label: 'Today', dateKey: todayStr });
    }

    if (dateKeys.has(yesterdayStr)) {
      pills.push({ id: 'yesterday', label: 'Yesterday', dateKey: yesterdayStr });
    }

    // Add up to 2 most recent month pills
    const sortedMonths = Array.from(monthKeys).sort((a, b) => b.localeCompare(a));
    for (const m of sortedMonths) {
      if (pills.length >= 5) break;
      const [year, month] = m.split('-');
      const monthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      pills.push({ id: `month-${m}`, label, dateKey: m });
    }

    return pills;
  }, [photos]);

  const handlePillClick = (pill: DateFilterPill) => {
    onActiveFilterChange?.(pill.id);
    if (pill.id === 'all') {
      onSelectDateMilestone?.(null);
    } else if (pill.dateKey) {
      onSelectDateMilestone?.(pill.dateKey);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-[#0c0a09]/90 backdrop-blur-xl px-4 sm:px-8 py-3 border-b border-[#292524]/70 shadow-sm transition-all duration-200">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Quick Jump Date Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full custom-scrollbar">
          {filterPills.map((pill) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => handlePillClick(pill)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all active:scale-95 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#f5f5f4] text-[#151312] font-semibold shadow-sm'
                    : 'bg-[#181514] border border-[#292524] text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#23201e]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Dynamic Selection Indicator */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#23201e] border border-[#322e2b] text-[#f5f5f4] rounded-full shadow-lg animate-in fade-in duration-150">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#a8a29e]">
                {selectedCount} SELECTED
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs underline text-[#f5f5f4] hover:text-white ml-0.5 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Layout View Mode Switcher */}
          <div className="flex items-center bg-[#151312] border border-[#292524] p-0.5 rounded-full">
            <button
              type="button"
              onClick={() => onLayoutModeChange('editorial')}
              title="Editorial Layout (Asymmetric Bento)"
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLayoutMode === 'editorial'
                  ? 'bg-[#23201e] text-[#f5f5f4] shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
            >
              <LayoutTemplate size={13} />
              <span className="hidden sm:inline">Editorial</span>
            </button>

            <button
              type="button"
              onClick={() => onLayoutModeChange('grid')}
              title="Justified Aspect Grid"
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLayoutMode === 'grid'
                  ? 'bg-[#23201e] text-[#f5f5f4] shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => onLayoutModeChange('dense')}
              title="Dense Compact Mosaic"
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLayoutMode === 'dense'
                  ? 'bg-[#23201e] text-[#f5f5f4] shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
            >
              <Grid3x3 size={13} />
              <span className="hidden sm:inline">Dense</span>
            </button>
          </div>

          {/* Monograph View Launcher */}
          {onMonographClick && photos.length > 0 && (
            <button
              type="button"
              onClick={onMonographClick}
              className="h-8 px-3 rounded-full bg-[#181514] border border-[#292524] hover:bg-[#23201e] hover:border-[#322e2b] text-[#f5f5f4] text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Open Monograph Curation View"
            >
              <BookOpen size={14} className="text-[#a8a29e]" />
              <span className="hidden sm:inline">Monograph View</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

PhotoGridSubheader.displayName = 'PhotoGridSubheader';
