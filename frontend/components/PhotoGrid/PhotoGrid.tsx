import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TimelineDial } from '@/components/ui/TimelineDial';
import { PhotoGridProps, VirtualRowItem } from './types';
import { usePhotoGrid } from './hooks/usePhotoGrid';
import { useTimeline } from './hooks/useTimeline';
import { PhotoGridHeader } from './PhotoGridHeader';
import { PhotoGridRow } from './PhotoGridRow';
import { PhotoListItem } from './PhotoListItem';
import { ArchivalRetrospectiveBanner } from './ArchivalRetrospectiveBanner';
import { ChronologyRail, ChronologyMilestone } from './ChronologyRail';
import { StoryViewer } from '@/components/viewers/StoryViewer';
import { formatDate } from './utils';
import { useRenderCounter } from '@/lib/perf';
import {
  ROW_PADDING,
  EMPTY_ROW_HEIGHT,
  HEADER_ROW_HEIGHT,
  LIST_ITEM_HEIGHT,
} from './constants';
import { useGalleryLayout, GalleryLayoutMode } from '../../hooks/useGalleryLayout';
import { useStats } from '../../hooks/useStats';
import { API_BASE } from '../../constants';
import { useSyncStore } from '@/store/syncStore';
import { customConfirm } from '../../services/ConfirmService';
import { Photo } from '../../types';
import { useTelemetry } from '../../hooks/useTelemetry';
import {
  Image as ImageIcon,
} from 'lucide-react';

/**
 * EmptyLibraryState - Renders empty library state.
 */
const EmptyLibraryState: React.FC<{ isTrash: boolean }> = React.memo(({ isTrash }) => (
  <div className="flex flex-col items-center gap-4 opacity-60 py-20">
    <div className="w-24 h-24 rounded-2xl bg-[#151312] border border-[#292524] flex items-center justify-center">
      <ImageIcon size={40} className="text-[#78716c]" />
    </div>
    <div className="text-center">
      {isTrash ? (
        <>
          <p className="text-lg font-serif text-[#f5f5f4]">Trash is empty</p>
          <p className="text-sm text-[#78716c] mt-1 font-sans">
            No items in trash.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-serif text-[#f5f5f4]">Your archive is empty</p>
          <p className="text-sm text-[#78716c] mt-1 font-sans">
            Import photos or camera media to begin your curated collection.
          </p>
        </>
      )}
    </div>
  </div>
));
EmptyLibraryState.displayName = 'EmptyLibraryState';

/**
 * PhotoGrid - Renders photo grid with Prism museum aesthetic.
 */
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
  onFavoriteToggle: propOnFavoriteToggle,
  layoutMode: propLayoutMode,
  onLayoutModeChange: propOnLayoutModeChange,
  onMonographClick,
}) => {
  const { logAction, logError } = useTelemetry();

  // Telemetry-wrapped callbacks
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

  // Custom states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  const [activeStoryHighlight, setActiveStoryHighlight] = useState<any | null>(null);

  // Gallery layout settings from store
  const { settings, setLayoutMode, rowHeightPx, maxRowWidth } = useGalleryLayout();
  const activeLayoutMode: GalleryLayoutMode = propLayoutMode || settings.layoutMode || 'editorial';

  const handleLayoutModeChange = useCallback((mode: GalleryLayoutMode) => {
    if (mode === 'list') {
      setViewMode('list');
    } else {
      setViewMode('grid');
      setLayoutMode(mode);
      propOnLayoutModeChange?.(mode);
    }
  }, [setLayoutMode, propOnLayoutModeChange]);

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

  const { refetch: refetchStats } = useStats(photos.length);

  // Handle Inline Favorite Toggle
  const handleFavoriteToggle = useCallback(async (id: string | number, current: boolean) => {
    logAction('PhotoGrid', 'favorite_toggle', { photoId: id, newValue: !current });
    if (propOnFavoriteToggle) {
      await propOnFavoriteToggle(id, current);
      refetchStats();
      return;
    }
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
  }, [propOnFavoriteToggle, onBulkFavorite, onUpdatePhotos, refetchStats, logAction, logError]);

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

  const gridRows = usePhotoGrid(photos, maxRowWidth, containerWidth, rowHeightPx, activeLayoutMode);
  const isCompactView = compact || currentView === 'trash';

  const rowItems = useMemo(() => {
    if (isCompactView) {
      if (photos.length === 0) {
        return [{ type: 'empty' as const }];
      }
      return viewMode === 'grid'
        ? gridRows
        : photos.map(p => ({ type: 'list-item' as const, photo: p }));
    }
    if (photos.length === 0) {
      return [{ type: 'empty' as const }];
    }
    const baseItems: VirtualRowItem[] = viewMode === 'grid'
      ? gridRows
      : photos.map(p => ({ type: 'list-item' as const, photo: p }));

    return baseItems;
  }, [photos.length, photos, gridRows, viewMode, isCompactView]);

  const rowVirtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => scrollParentRef?.current || null,
    estimateSize: (index) => {
      const item = rowItems[index];
      if (!item) return rowHeightPx;
      if (item.type === 'empty') return EMPTY_ROW_HEIGHT;
      if (item.type === 'header') return HEADER_ROW_HEIGHT;
      if (item.type === 'list-item') return LIST_ITEM_HEIGHT;
      return activeLayoutMode === 'dense'
        ? Math.round(rowHeightPx * 0.65)
        : activeLayoutMode === 'editorial'
          ? Math.round(rowHeightPx * 1.15)
          : rowHeightPx;
    },
    overscan: 5,
  });

  // Chronology milestones calculation for the rail
  const chronologyMilestones = useMemo<ChronologyMilestone[]>(() => {
    const list: ChronologyMilestone[] = [];
    const seen = new Set<string>();

    gridRows.forEach((r) => {
      if (r.type === 'header' && !seen.has(r.dateKey)) {
        seen.add(r.dateKey);
        const { fullDate, year } = formatDate(r.dateKey);
        const isCurrentYear = year === new Date().getFullYear();
        list.push({
          dateKey: r.dateKey,
          label: isCurrentYear ? fullDate : `${fullDate} ${year}`,
        });
      }
    });

    return list;
  }, [gridRows]);

  // Jump to milestone
  const handleSelectDateMilestone = useCallback((dateKey: string | null) => {
    if (!dateKey) {
      scrollParentRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const targetIdx = rowItems.findIndex(
      (item) => item.type === 'header' && item.dateKey.startsWith(dateKey)
    );
    if (targetIdx !== -1) {
      rowVirtualizer.scrollToIndex(targetIdx, { align: 'start', behavior: 'smooth' });
    }
  }, [rowItems, rowVirtualizer, scrollParentRef]);

  const handleScrollToTop = useCallback(() => {
    scrollParentRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollParentRef]);

  // Active milestone detection from virtual items
  const activeMilestoneDateKey = useMemo(() => {
    const vItems = rowVirtualizer.getVirtualItems();
    if (vItems.length === 0) return null;
    for (const vi of vItems) {
      const item = rowItems[vi.index];
      if (item && item.type === 'header') {
        return item.dateKey;
      }
      if (item && item.type === 'row' && item.photos[0]?.date) {
        return item.photos[0].date.split('T')[0];
      }
    }
    return chronologyMilestones[0]?.dateKey || null;
  }, [rowVirtualizer.getVirtualItems(), rowItems, chronologyMilestones]);

  // Clear selection handler
  const handleClearSelection = useCallback(() => {
    onToggleGroupSelection?.([]);
  }, [onToggleGroupSelection]);

  // Monograph View Launcher
  const handleMonographLaunch = useCallback(() => {
    if (onMonographClick) {
      onMonographClick();
    } else if (photos.length > 0) {
      setActiveStoryHighlight({
        id: 'monograph',
        title: 'Prism Master Monograph',
        subtitle: `${photos.length} curated archival works in high dynamic range`,
        type: 'monograph',
        photo_count: Math.min(30, photos.length),
        cover_url: photos[0]?.url || null,
        photos: photos.slice(0, 30),
      });
    }
  }, [onMonographClick, photos]);

  useEffect(() => {
    const handleOpenMonograph = () => {
      handleMonographLaunch();
    };
    window.addEventListener('prism:open-monograph', handleOpenMonograph);
    return () => {
      window.removeEventListener('prism:open-monograph', handleOpenMonograph);
    };
  }, [handleMonographLaunch]);

  // 2D Roving Matrix for navigation
  const photoRows = useMemo(() => {
    const rows: { photos: Photo[]; virtualIndex: number }[] = [];
    rowItems.forEach((item, index) => {
      if (item.type === 'row' && item.photos.length > 0) {
        rows.push({ photos: item.photos, virtualIndex: index });
      } else if (item.type === 'list-item') {
        rows.push({ photos: [item.photo], virtualIndex: index });
      }
    });
    return rows;
  }, [rowItems]);

  const photoToGridPos = useMemo(() => {
    const map = new Map<string, { rowIndex: number; colIndex: number; photoIndex: number; virtualIndex: number }>();
    let pIdx = 0;
    photoRows.forEach((r, rIdx) => {
      r.photos.forEach((p, cIdx) => {
        map.set(String(p.id), {
          rowIndex: rIdx,
          colIndex: cIdx,
          photoIndex: pIdx++,
          virtualIndex: r.virtualIndex,
        });
      });
    });
    return map;
  }, [photoRows]);

  const effectiveFocusedId = useMemo(() => {
    if (focusedPhotoId && photoToGridPos.has(focusedPhotoId)) {
      return focusedPhotoId;
    }
    return photos.length > 0 ? String(photos[0].id) : null;
  }, [focusedPhotoId, photoToGridPos, photos]);

  const focusPhoto = useCallback((targetPhoto: Photo) => {
    const strId = String(targetPhoto.id);
    setFocusedPhotoId(strId);
    const pos = photoToGridPos.get(strId);
    if (pos) {
      rowVirtualizer.scrollToIndex(pos.virtualIndex, { align: 'auto' });
    }
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-photo-id="${strId}"]`);
      el?.focus();
    });
  }, [photoToGridPos, rowVirtualizer]);

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (photos.length === 0) return;

    const currentId = effectiveFocusedId ?? String(photos[0].id);
    const currentPos = photoToGridPos.get(currentId) ?? {
      rowIndex: 0,
      colIndex: 0,
      photoIndex: 0,
      virtualIndex: 0,
    };

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        if (currentPos.photoIndex + 1 < photos.length) {
          focusPhoto(photos[currentPos.photoIndex + 1]);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (currentPos.photoIndex - 1 >= 0) {
          focusPhoto(photos[currentPos.photoIndex - 1]);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (currentPos.rowIndex + 1 < photoRows.length) {
          const nextRow = photoRows[currentPos.rowIndex + 1];
          const targetCol = Math.min(currentPos.colIndex, nextRow.photos.length - 1);
          focusPhoto(nextRow.photos[targetCol]);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (currentPos.rowIndex - 1 >= 0) {
          const prevRow = photoRows[currentPos.rowIndex - 1];
          const targetCol = Math.min(currentPos.colIndex, prevRow.photos.length - 1);
          focusPhoto(prevRow.photos[targetCol]);
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        focusPhoto(photos[0]);
        break;
      }
      case 'End': {
        e.preventDefault();
        focusPhoto(photos[photos.length - 1]);
        break;
      }
      case ' ': {
        e.preventDefault();
        handleToggleSelectionTelemetry(currentId);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const photo = photos.find(p => String(p.id) === currentId);
        if (photo) {
          handlePhotoClickTelemetry(photo);
        }
        break;
      }
    }
  }, [
    photos,
    effectiveFocusedId,
    photoToGridPos,
    photoRows,
    focusPhoto,
    handleToggleSelectionTelemetry,
    handlePhotoClickTelemetry,
  ]);

  const { timelineItems, scrollState, activeId } = useTimeline(gridRows, scrollParentRef);

  if (photos.length === 0 && (isLoading || syncStatus?.is_scanning)) {
    return (
      <div className="pl-6 sm:pl-10 pr-6 sm:pr-10 pt-28 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-[#151312] border border-[#292524] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  logRender?.();

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Photos grid"
      onKeyDown={handleGridKeyDown}
      className="relative w-full font-sans min-h-screen bg-[#0c0a09] text-[#f5f5f4]"
    >
      {/* Atmospheric Ambient Background Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-10 left-1/4 w-[540px] h-[380px] rounded-full bg-[#f97316] opacity-[0.06] blur-[130px]" />
        <div className="absolute top-96 right-12 w-[480px] h-[360px] rounded-full bg-[#818cf8] opacity-[0.05] blur-[140px]" />
        <div className="absolute top-[1100px] left-10 w-[500px] h-[400px] rounded-full bg-[#2dd4bf] opacity-[0.04] blur-[130px]" />
      </div>

      {/* Main Container Area with Right Sticky Chronology Rail */}
      <div className="relative z-10 w-full flex">
        {/* Gallery Core Stream */}
        <div className="flex-1 min-w-0">
          {/* Memory Flashback Banner (Archival Retrospective) */}
          {!isCompactView && photos.length > 0 && (
            <div className="pl-4 sm:pl-8 pr-6 sm:pr-8 xl:pr-12 pt-2">
              <ArchivalRetrospectiveBanner
                photos={photos}
                onReliveMemory={(memPhotos) => {
                  if (memPhotos.length > 0) {
                    setActiveStoryHighlight({
                      id: 'retrospective',
                      title: memPhotos[0]?.caption || 'Archival Retrospective',
                      subtitle: 'Curated 35mm film captures preserved in uncompressed high dynamic range.',
                      type: 'retrospective',
                      photo_count: memPhotos.length,
                      cover_url: memPhotos[0]?.url || null,
                      photos: memPhotos,
                    });
                  }
                }}
              />
            </div>
          )}

          {/* Virtualized Container */}
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = rowItems[virtualRow.index];
              if (!item) return null;

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
                    rowHeight={
                      activeLayoutMode === 'dense'
                        ? Math.round(rowHeightPx * 0.65)
                        : activeLayoutMode === 'editorial'
                          ? Math.round(rowHeightPx * 1.15)
                          : rowHeightPx
                    }
                    rowPadding={ROW_PADDING}
                    measureElement={rowVirtualizer.measureElement}
                    dateKey={item.photos[0]?.date?.split('T')[0] ?? (virtualRow.key as string)}
                    isRowHovered={hoveredDateKey !== null}
                    onRowHover={handleRowHover}
                    focusedPhotoId={effectiveFocusedId}
                    onPhotoFocus={setFocusedPhotoId}
                    heroPhotoId={item.heroPhotoId}
                    layoutMode={activeLayoutMode}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                );
              }

              if (item.type === 'list-item') {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full pl-4 sm:pl-8 pr-12 pb-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <PhotoListItem
                      photo={item.photo}
                      isSelected={selectedIds.has(String(item.photo.id))}
                      isSelectionMode={isSelectionMode}
                      isFocused={effectiveFocusedId === String(item.photo.id)}
                      onFocus={() => setFocusedPhotoId(String(item.photo.id))}
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
        </div>

        {/* Sticky Chronology Navigation Rail */}
        {!isCompactView && chronologyMilestones.length > 0 && (
          <ChronologyRail
            milestones={chronologyMilestones}
            activeDateKey={activeMilestoneDateKey}
            onSelectMilestone={handleSelectDateMilestone}
            onScrollToTop={handleScrollToTop}
            scrollParentRef={scrollParentRef}
          />
        )}
      </div>

      {/* Classic Timeline Dial fallback if no milestones */}
      {viewMode === 'grid' && chronologyMilestones.length === 0 && timelineItems.length > 0 && (
        <TimelineDial
          items={timelineItems}
          activeId={activeId}
          scrollProgress={scrollState.progress}
          scrollHeight={scrollState.height}
        />
      )}

      {/* Story / Monograph Modal */}
      {activeStoryHighlight && (
        <StoryViewer
          highlight={activeStoryHighlight}
          onClose={() => setActiveStoryHighlight(null)}
        />
      )}
    </div>
  );
};
