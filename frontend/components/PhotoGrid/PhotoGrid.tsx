import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TimelineDial } from '@/components/ui/TimelineDial';
import { PhotoGridProps, VirtualRowItem } from './types';
import { usePhotoGrid } from './hooks/usePhotoGrid';
import { useTimeline } from './hooks/useTimeline';
import { PhotoGridHeader } from './PhotoGridHeader';
import { PhotoGridRow } from './PhotoGridRow';
import { PhotoListItem } from './PhotoListItem';
import { useRenderCounter } from '@/lib/perf';
import {
  ROW_PADDING,
  EMPTY_ROW_HEIGHT,
  HEADER_ROW_HEIGHT,
  LIST_ITEM_HEIGHT
} from './constants';
import { useGalleryLayout } from '../../hooks/useGalleryLayout';
import { useStats } from '../../hooks/useStats';
import { API_BASE, photoSrc } from '../../constants';
import { useSyncStore } from '@/store/syncStore';
import { customConfirm } from '../../services/ConfirmService';
import { Photo } from '../../types';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  Image as ImageIcon,
  LayoutGrid,
  List,
} from 'lucide-react';

const EmptyLibraryState: React.FC<{ isTrash: boolean }> = React.memo(({ isTrash }) => (
  <div className="flex flex-col items-center gap-4 opacity-60">
    <div className="w-24 h-24 rounded-2xl bg-surface border border-border flex items-center justify-center">
      <ImageIcon size={40} className="text-gray-500" />
    </div>
    <div className="text-center">
      {isTrash ? (
        <>
          <p className="text-lg font-semibold text-gray-300">Trash is empty</p>
          <p className="text-sm text-gray-500 mt-1">
            No photos in trash.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-gray-300">Your library is empty</p>
          <p className="text-sm text-gray-500 mt-1">
            Click <span className="text-primary font-medium">Import</span> above to add photos from your device.
          </p>
        </>
      )}
    </div>
  </div>
));
EmptyLibraryState.displayName = 'EmptyLibraryState';

interface StatsCardProps {
  label: string;
  value: string;
}

const StatsCard: React.FC<StatsCardProps> = React.memo(({ label, value }) => (
  <div className="flex items-baseline gap-2 py-1">
    <span className="text-2xl font-bold font-sans text-white tracking-tight">{value}</span>
    <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500">{label}</span>
  </div>
));
StatsCard.displayName = 'StatsCard';

export const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  isLoading,
  currentView,
  compact = false,
  onPhotoClick,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection,
  scrollParentRef,
  onSearch,
  onUpdatePhotos,
  onBulkFavorite,
  onBulkDelete,
  onBulkLockToggle,
}) => {
  const { logAction, logError } = useTelemetry();

  // Telemetry-wrapped callbacks for actions not handled in this component directly
  const handlePhotoClickTelemetry = useCallback((photo: Photo) => {
    logAction('PhotoGrid', 'photo_click', { photoId: photo.id, filename: photo.filename });
    onPhotoClick?.(photo);
  }, [onPhotoClick, logAction]);

  const handleToggleSelectionTelemetry = useCallback((id: string) => {
    logAction('PhotoGrid', 'photo_select', { photoId: id });
    onToggleSelection?.(id);
  }, [onToggleSelection, logAction]);

  const handleToggleGroupSelectionTelemetry = useCallback((ids: string[]) => {
    logAction('PhotoGrid', 'group_select', { count: ids.length });
    onToggleGroupSelection?.(ids);
  }, [onToggleGroupSelection, logAction]);

  const isSelectionMode = selectedIds.size > 0;
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const logRender = useRenderCounter('PhotoGrid');

  // Custom states for filtering and view layout
  const [activePill, setActivePill] = useState<'all' | 'favorites' | 'recent' | 'videos'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);

  // Gallery layout settings
  const { settings, rowHeightPx, maxRowWidth, galleryStyle, setImageGrouping } = useGalleryLayout();
  const imageGrouping = settings.imageGrouping;

  // Container width measurement for dynamic row packing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Stats Integration
  const { stats, refetch: refetchStats } = useStats(photos.length);

  // Clientside Pill Filtering and sorting logic
  const filteredPhotos = useMemo(() => {
    if (activePill === 'all') return photos;
    if (activePill === 'favorites') {
      return photos.filter(p => p.isFavorite || p.is_favorite);
    } else if (activePill === 'recent') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return photos.filter(p => new Date(p.date) >= thirtyDaysAgo);
    } else if (activePill === 'videos') {
      return photos.filter(p => p.file_type === 'video' || p.mime_type?.startsWith('video/'));
    }
    return photos;
  }, [photos, activePill]);

  // Handle Inline Toggles for List View
  const handleFavoriteToggle = useCallback(async (id: string | number, current: boolean) => {
    logAction('PhotoGrid', 'favorite_toggle', { photoId: id, newValue: !current });
    if (onBulkFavorite) {
      await onBulkFavorite(new Set([String(id)]));
      refetchStats();
    } else {
      const target = !current;
      onUpdatePhotos?.(prev => prev.map(p =>
        String(p.id) === String(id) ? { ...p, isFavorite: target, is_favorite: target } : p
      ));
      try {
        const response = await fetch(`${API_BASE}/api/v1/photos/${id}/favorite`, { method: 'POST' });
        if (!response.ok) throw new Error('API failed');
        refetchStats();
      } catch (e) {
        onUpdatePhotos?.(prev => prev.map(p =>
          String(p.id) === String(id) ? { ...p, isFavorite: current, is_favorite: current } : p
        ));
        logError('PhotoGrid', 'favorite_toggle_failed', e, { photoId: id });
      }
    }
  }, [onBulkFavorite, onUpdatePhotos, refetchStats, logAction, logError]);

  const handleLockToggle = useCallback(async (id: string | number, current: boolean) => {
    logAction('PhotoGrid', 'lock_toggle', { photoId: id, newValue: !current });
    if (onBulkLockToggle) {
      await onBulkLockToggle(new Set([String(id)]));
      refetchStats();
    } else {
      const isLocking = !current;
      if (isLocking && !await customConfirm('Encrypt and move this item to the Locked Folder?', 'Confirm Lock')) return;
      if (!isLocking && !await customConfirm('Decrypt and restore this item to your general photos?', 'Confirm Unlock')) return;

      onUpdatePhotos?.(prev => prev.map(p =>
        String(p.id) === String(id) ? { ...p, isLocked: isLocking, is_locked: isLocking } : p
      ));
      try {
        const endpoint = isLocking ? '/lock' : '/unlock';
        const response = await fetch(`${API_BASE}/api/v1/photos/${id}${endpoint}`, { method: 'POST' });
        if (!response.ok) throw new Error('API failed');
        refetchStats();
      } catch (e) {
        onUpdatePhotos?.(prev => prev.map(p =>
          String(p.id) === String(id) ? { ...p, isLocked: current, is_locked: current } : p
        ));
        logError('PhotoGrid', 'lock_toggle_failed', e, { photoId: id });
      }
    }
  }, [onBulkLockToggle, onUpdatePhotos, refetchStats, logAction, logError]);

  const handleDeleteToggle = useCallback(async (id: string | number) => {
    logAction('PhotoGrid', 'delete_toggle', { photoId: id });
    if (onBulkDelete) {
      await onBulkDelete(new Set([String(id)]));
      refetchStats();
    } else {
      if (!await customConfirm('Move this photo to Trash?', 'Confirm Trash')) return;
      onUpdatePhotos?.(prev => prev.map(p =>
        String(p.id) === String(id) ? { ...p, isTrash: true, is_trash: true } : p
      ));
      try {
        const response = await fetch(`${API_BASE}/api/v1/photos/${id}/trash`, { method: 'POST' });
        if (!response.ok) throw new Error('API failed');
        refetchStats();
      } catch (e) {
        onUpdatePhotos?.(prev => prev.map(p =>
          String(p.id) === String(id) ? { ...p, isTrash: false, is_trash: false } : p
        ));
        logError('PhotoGrid', 'delete_toggle_failed', e, { photoId: id });
      }
    }
  }, [onBulkDelete, onUpdatePhotos, refetchStats, logAction, logError]);

  const handleRowHover = useCallback((dateKey: string | null) => {
    setHoveredDateKey(dateKey);
  }, []);

  // Integrated Search trigger
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) {
        onSearch?.(null);
      } else {
        logAction('PhotoGrid', 'search', { query: searchQuery.trim() });
        onSearch?.({ query: searchQuery.trim() });
      }
    }
  };

  const gridRows = usePhotoGrid(filteredPhotos, maxRowWidth, containerWidth, rowHeightPx);
  const isCompactView = compact || currentView === 'trash';
  const rowItems = useMemo(() => {
    if (isCompactView) {
      if (photos.length === 0) {
        return [{ type: 'empty' as const }];
      }
      return viewMode === 'grid'
        ? gridRows
        : filteredPhotos.map(p => ({ type: 'list-item' as const, photo: p }));
    }
    if (photos.length === 0) {
      return [{ type: 'empty' as const }];
    }
    const baseItems: VirtualRowItem[] = viewMode === 'grid'
      ? gridRows
      : filteredPhotos.map(p => ({ type: 'list-item' as const, photo: p }));

    return baseItems;
  }, [photos.length, filteredPhotos, gridRows, viewMode, isCompactView]);

  const rowVirtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => scrollParentRef?.current || null,
    estimateSize: (index) => {
      const item = rowItems[index];
      if (!item) return rowHeightPx;
      if (item.type === 'empty') return EMPTY_ROW_HEIGHT;
      if (item.type === 'header') return HEADER_ROW_HEIGHT;
      if (item.type === 'list-item') return LIST_ITEM_HEIGHT;
      return rowHeightPx;
    },
    overscan: 5,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [isStatsExpanded, rowVirtualizer]);

  // Calculate dynamic date metadata for view controls
  const dateLabel = useMemo(() => {
    if (filteredPhotos.length === 0) return '0 photos';
    if (isCompactView) return `${filteredPhotos.length} photos`;
    const firstPhotoDate = new Date(filteredPhotos[0].date);
    const today = new Date();
    const isToday = firstPhotoDate.getDate() === today.getDate() &&
      firstPhotoDate.getMonth() === today.getMonth() &&
      firstPhotoDate.getFullYear() === today.getFullYear();
    return `${isToday ? 'Today' : 'Gallery'} • ${filteredPhotos.length} photos`;
  }, [filteredPhotos, isCompactView]);

  // Keep timeline dial linked to regular grid rows (header/row only).
  // gridRows from usePhotoGrid already contains only those types.
  const { timelineItems, scrollState, activeId } = useTimeline(gridRows, scrollParentRef);

  if (photos.length === 0 && (isLoading || syncStatus?.is_scanning)) {
    return (
      <div className="pl-10 pr-10 pt-28 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  logRender?.();

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      {/* Google Photos Memory Highlights Carousel (Screenshot 1) */}
      {galleryStyle === 'google' && !isCompactView && (
        <div className="w-full pl-10 pr-10 pt-6 pb-2 z-20">
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3 select-none">
            {(photos.length > 0 ? photos.slice(0, 5) : [1, 2, 3, 4, 5]).map((p, idx) => {
              const titles = ['Video spotlight', 'Video spotlight', 'Exploring trails', 'Golden hour', 'Mom'];
              const subtitles = ['', '', 'Over the years', 'Over the years', 'Same face, different places'];
              const imgSrc = typeof p === 'object' ? photoSrc(p) : '';
              return (
                <div
                  key={idx}
                  className="shrink-0 w-64 h-36 rounded-2xl overflow-hidden relative shadow-md border border-white/10 group cursor-pointer"
                >
                  {imgSrc ? (
                    <img src={imgSrc} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900 flex items-center justify-center text-white/40 font-sans text-xs">
                      Highlight {idx + 1}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end">
                    <h4 className="text-white font-sans font-medium text-sm leading-tight drop-shadow">{titles[idx % titles.length]}</h4>
                    {subtitles[idx % subtitles.length] && (
                      <p className="text-[11px] font-sans text-gray-300 mt-0.5 opacity-90">{subtitles[idx % subtitles.length]}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 mb-2">
            <h2 className="text-2xl font-sans font-normal text-[#E3E2E6]">February</h2>
          </div>
        </div>
      )}

      {/* Apple Photos iPadOS 18 Header (Photo 4) */}
      {galleryStyle === 'apple' && !isCompactView && (
        <div className="w-full pl-10 pr-10 pt-8 pb-2 z-20">
          <div className="flex items-baseline justify-between mb-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-3xl font-sans font-bold text-white tracking-tight">Library</h2>
              <p className="text-xs font-sans text-[#8e8e93] mt-1 font-medium">10 Nov 2025 – 28 Feb 2026</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#0a84ff] bg-[#0a84ff]/10 border border-[#0a84ff]/20 px-3 py-1 rounded-full font-bold">
                 iPadOS 18
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Header (Dashboard) rendered outside virtualization for Prism theme */}
      {!isCompactView && galleryStyle !== 'google' && galleryStyle !== 'apple' && (
        <div className="w-full pl-10 pr-10 pt-4 pb-2 z-20">
          {/* Sub Navigation and View Filters */}
          <div className="flex items-center justify-between py-2 mb-2 select-none">
            {/* Category Pills on Left */}
            <div className="flex items-center gap-2">
              {([
                { id: 'all', label: 'All' },
                { id: 'favorites', label: 'Favorites' },
                { id: 'recent', label: 'Recent' },
                { id: 'videos', label: 'Videos' }
              ] as const).map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => { logAction('PhotoGrid', 'filter_change', { filter: pill.id }); setActivePill(pill.id); }}
                  className={`px-5 py-2 text-sm rounded-full transition-colors 200ms ease, background-color 200ms ease
                    ${activePill === pill.id
                      ? 'bg-[#2a241c] text-[#e0cfb3] font-medium'
                      : 'text-gray-400 hover:text-white font-normal'
                    }
                  `}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Date label and Grid/List view switch on Right */}
            <div className="flex items-center gap-6">
              <span className="text-xs text-gray-500 font-normal">
                {filteredPhotos.length === 1 ? '1 moment' : `${filteredPhotos.length} moments`}
              </span>

              {/* Layout switch controls */}
              <div className="flex items-center bg-[#161616]/40 p-1 rounded-xl border border-white/[0.08]">
                <button
                  onClick={() => { logAction('PhotoGrid', 'view_mode_change', { mode: 'grid' }); setViewMode('grid'); }}
                  className={`p-2 rounded-lg transition-colors 200ms ease, background-color 200ms ease ${viewMode === 'grid' ? 'bg-white/5 text-[#e0cfb3]' : 'text-gray-500 hover:text-white'
                    }`}
                  title="Grid View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => { logAction('PhotoGrid', 'view_mode_change', { mode: 'list' }); setViewMode('list'); }}
                  className={`p-2 rounded-lg transition-colors 200ms ease, background-color 200ms ease ${viewMode === 'list' ? 'bg-white/5 text-[#e0cfb3]' : 'text-gray-500 hover:text-white'
                    }`}
                  title="List View"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The Virtualized Container */}
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = rowItems[virtualRow.index];
          if (!item) return null;

          // 1b. Empty library state (shown below the dashboard when no photos)
          if (item.type === 'empty') {
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full flex flex-col items-center justify-center gap-5 select-none"
                style={{ transform: `translateY(${virtualRow.start}px)`, minHeight: '380px' }}
              >
                <EmptyLibraryState isTrash={currentView === 'trash'} />
              </div>
            );
          }

          // 2. Timeline Grid Headers (Grid Mode only)
          if (item.type === 'header') {
            return (
              <PhotoGridHeader
                key={virtualRow.key}
                dateKey={item.dateKey}
                photoIds={item.photoIds}
                location={item.location}
                selectedIds={selectedIds}
                onToggleGroupSelection={handleToggleGroupSelectionTelemetry}
                virtualRowStart={virtualRow.start}
                virtualRowKey={virtualRow.key}
                virtualRowIndex={virtualRow.index}
                measureElement={rowVirtualizer.measureElement}
                isHovered={hoveredDateKey === item.dateKey}
              />
            );
          }

          // 3. Grid Row (Grid Mode only)
          if (item.type === 'row') {
            return (
              <PhotoGridRow
                key={virtualRow.key}
                photos={item.photos}
                isFull={item.isFull}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
                onPhotoClick={handlePhotoClickTelemetry}
                onToggleSelection={handleToggleSelectionTelemetry}
                virtualRowStart={virtualRow.start}
                virtualRowKey={virtualRow.key}
                virtualRowIndex={virtualRow.index}
                rowHeight={rowHeightPx}
                rowPadding={ROW_PADDING}
                measureElement={rowVirtualizer.measureElement}
                dateKey={item.photos[0]?.date?.split('T')[0] ?? virtualRow.key as string}
                isRowHovered={hoveredDateKey !== null}
                onRowHover={handleRowHover}
              />
            );
          }

          // 4. List Item Row (List Mode only)
          if (item.type === 'list-item') {
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full pl-10 pr-10 pb-3"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <PhotoListItem
                  photo={item.photo}
                  isSelected={selectedIds.has(String(item.photo.id))}
                  isSelectionMode={isSelectionMode}
                  onPhotoClick={handlePhotoClickTelemetry}
                  onToggleSelection={handleToggleSelectionTelemetry}
                  onFavoriteToggle={handleFavoriteToggle}
                  onLockToggle={handleLockToggle}
                  onDeleteToggle={handleDeleteToggle}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
      {viewMode === 'grid' && timelineItems.length > 0 && (
        <TimelineDial
          items={timelineItems}
          activeId={activeId}
          scrollProgress={scrollState.progress}
          scrollHeight={scrollState.height}
        />
      )}

      {/* Apple Photos Floating Bottom Segmented Control Bar (Photo 3) */}
      {galleryStyle === 'apple' && (
        <div className="fixed bottom-8 left-1/2 md:left-[calc(50%+128px)] -translate-x-1/2 z-50 flex items-center backdrop-blur-3xl bg-[#1c1c1e]/95 border border-white/20 rounded-full p-1.5 md:p-2 shadow-[0_15px_40px_rgba(0,0,0,0.8)] space-x-1.5 select-none">
          {[
            { id: 'years', label: 'Years' },
            { id: 'months', label: 'Months' },
            { id: 'none', label: 'All Photos' },
          ].map((item) => {
            const isActive = imageGrouping === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setImageGrouping(item.id as any)}
                className={`px-6 py-2.5 md:px-8 md:py-3 rounded-full text-sm md:text-base font-sans font-semibold transition-colors 200ms ease, background-color 200ms ease, transition-transform 200ms cubic-bezier(0.23, 1, 0.32, 1) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] ${isActive
                  ? 'bg-white/25 text-white font-bold shadow-md scale-[1.03] border border-white/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
