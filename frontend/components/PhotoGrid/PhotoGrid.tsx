import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { TimelineDial } from '@/components/ui/TimelineDial';
import { PhotoGridProps, VirtualRowItem } from './types';
import { usePhotoGrid } from './hooks/usePhotoGrid';
import { useTimeline } from './hooks/useTimeline';
import { PhotoGridHeader } from './PhotoGridHeader';
import { PhotoGridRow } from './PhotoGridRow';
import { PhotoListItem } from './PhotoListItem';
import { 
  ROW_PADDING, 
  EMPTY_ROW_HEIGHT, 
  HEADER_ROW_HEIGHT, 
  LIST_ITEM_HEIGHT 
} from './constants';
import { useGalleryLayout } from '../../hooks/useGalleryLayout';
import { useStats } from '../../hooks/useStats';
import { useImport } from '../../hooks/import';
import { API_BASE } from '../../constants';
import { NotificationsButton } from '@/components/layout/header/NotificationsButton';

import { customConfirm } from '../../services/ConfirmService';
import { Photo } from '../../types';
import { 
  Image as ImageIcon, 
  Users, 
  FolderOpen, 
  Lock, 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  Rows, 
  FolderUp,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  isLoading,
  syncStatus,
  currentView,
  onPhotoClick,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection,
  scrollParentRef,
  onSearch,
  onUpload,
  onImportProgress,
  onUpdatePhotos,
  onBulkFavorite,
  onBulkDelete,
  onBulkLockToggle,
}) => {
  const isSelectionMode = selectedIds.size > 0;
  
  // Custom states for filtering and view layout
  const [activePill, setActivePill] = useState<'all' | 'favorites' | 'recent' | 'videos'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  // Gallery layout settings
  const { rowHeightPx, maxRowWidth } = useGalleryLayout();

  // Stats Integration
  const { stats, refetch: refetchStats } = useStats(photos);

  // Ingestion drop-down handles
  const { handleFileUpload, handleFolderImport } = useImport({
    onUpload: (newPhotos) => {
      onUpload?.(newPhotos);
      refetchStats();
    },
    onImportProgress: onImportProgress || (() => {}),
  });

  // Handle click outside of import menu
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setIsImportOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Clientside Pill Filtering and sorting logic
  const filteredPhotos = useMemo(() => {
    let result = [...photos];
    if (activePill === 'favorites') {
      result = result.filter(p => p.isFavorite || p.is_favorite);
    } else if (activePill === 'recent') {
      // Show photos taken or added within the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(p => new Date(p.date) >= thirtyDaysAgo);
    } else if (activePill === 'videos') {
      result = result.filter(p => p.file_type === 'video' || p.mime_type?.startsWith('video/'));
    }
    return result;
  }, [photos, activePill]);

  // Handle Inline Toggles for List View
  const handleFavoriteToggle = useCallback(async (id: string | number, current: boolean) => {
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
        console.error('Failed to toggle favorite status', e);
      }
    }
  }, [onBulkFavorite, onUpdatePhotos, refetchStats]);

  const handleLockToggle = useCallback(async (id: string | number, current: boolean) => {
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
        console.error('Failed to toggle lock status', e);
      }
    }
  }, [onBulkLockToggle, onUpdatePhotos, refetchStats]);

  const handleDeleteToggle = useCallback(async (id: string | number) => {
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
        console.error('Failed to trash photo', e);
      }
    }
  }, [onBulkDelete, onUpdatePhotos, refetchStats]);

  // Integrated Search trigger
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) {
        onSearch?.(null);
      } else {
        onSearch?.({ query: searchQuery.trim() });
      }
    }
  };

  // Build rows depending on view layout — keep original 'header'/'row' types intact.
  // When the library is empty we still emit [ dashboard, empty ] so the header
  // (and Import button) are always visible regardless of photo count.
  // In trash views, hide the dashboard header.
  const gridRows = usePhotoGrid(filteredPhotos, maxRowWidth);
  const isCompactView = currentView === 'trash';
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
      if (item.type === 'empty')     return EMPTY_ROW_HEIGHT;
      if (item.type === 'header')    return HEADER_ROW_HEIGHT;
      if (item.type === 'list-item') return LIST_ITEM_HEIGHT;
      return rowHeightPx;
    },
    overscan: 10,
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
            <div key={i} className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Dynamic Header (Dashboard) rendered outside virtualization */}
      {!isCompactView && (
        <div className="w-full pl-10 pr-10 pt-8 pb-4 z-20">
          {/* Top Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 select-none">
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight font-sans">
                Gallery
              </h1>
              <div className="flex items-center gap-3 mt-1 select-none">
                <p className="text-sm text-gray-500 font-medium">
                  All your moments, organized locally on this device.
                </p>
                <span className="text-gray-600 font-bold">•</span>
                <button
                  onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 px-2.5 py-1 rounded-lg font-semibold active:scale-95 transition-all"
                >
                  <span>{isStatsExpanded ? 'Hide Stats' : 'Show Stats'}</span>
                  {isStatsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>

            {/* Search and Ingestion buttons */}
            <div className="flex items-center gap-4">
              {/* Integrated Search Bar */}
              <div className="relative group max-w-xs w-64">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="text"
                  className="w-full bg-surface border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-100 placeholder:text-gray-500 placeholder:text-xs focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
                  placeholder="Search by people, places, things..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>

              {/* Filter Setting Button */}
              <button
                className="p-2.5 bg-surface border border-border hover:bg-surfaceHover text-gray-400 hover:text-white rounded-xl transition-all active:scale-95"
                title="Advanced Filter Options"
              >
                <SlidersHorizontal size={18} />
              </button>

              {/* Notifications Button */}
              <NotificationsButton syncStatus={syncStatus} />

              {/* Integrated Import Dropdown Button */}
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => setIsImportOpen(!isImportOpen)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-black hover:brightness-110 font-bold rounded-xl text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(var(--color-primary),0.15)] transition-all active:scale-95"
                >
                  <FolderUp size={15} />
                  <span>Import</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isImportOpen ? 'rotate-180' : ''}`} />
                </button>

                {isImportOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl p-1 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        handleFileUpload();
                        setIsImportOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-surfaceHover rounded-lg transition-colors font-medium"
                    >
                      <ImageIcon size={16} className="text-purple-400" />
                      <span>Import Files</span>
                    </button>
                    <button
                      onClick={() => {
                        handleFolderImport();
                        setIsImportOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-surfaceHover rounded-lg transition-colors font-medium"
                    >
                      <FolderOpen size={16} className="text-emerald-400" />
                      <span>Import Folder</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Stats Cards Section */}
          <AnimatePresence initial={false}>
            {isStatsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden w-full"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none pt-1 pb-1">
                  {/* Card 1: Total Photos */}
                  <div className="p-6 bg-surface border border-border rounded-[1.5rem] flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:bg-surfaceHover hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                    <div className="absolute -inset-px bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[1.5rem]" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500">Total Photos</span>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400">
                        <ImageIcon size={16} />
                      </div>
                    </div>
                    <span className="text-3xl font-bold font-sans text-white tracking-tight leading-none relative z-10">
                      {stats ? stats.total_photos.toLocaleString() : photos.length.toLocaleString()}
                    </span>
                  </div>

                  {/* Card 2: People Found */}
                  <div className="p-6 bg-surface border border-border rounded-[1.5rem] flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:bg-surfaceHover hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                    <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[1.5rem]" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500">People Found</span>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                        <Users size={16} />
                      </div>
                    </div>
                    <span className="text-3xl font-bold font-sans text-white tracking-tight leading-none relative z-10">
                      {stats ? stats.people_found.toLocaleString() : '0'}
                    </span>
                  </div>

                  {/* Card 3: Albums */}
                  <div className="p-6 bg-surface border border-border rounded-[1.5rem] flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:bg-surfaceHover hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                    <div className="absolute -inset-px bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[1.5rem]" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500">Albums</span>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/10 text-orange-400">
                        <FolderOpen size={16} />
                      </div>
                    </div>
                    <span className="text-3xl font-bold font-sans text-white tracking-tight leading-none relative z-10">
                      {stats ? stats.albums.toLocaleString() : '0'}
                    </span>
                  </div>

                  {/* Card 4: Locked Folder */}
                  <div className="p-6 bg-surface border border-border rounded-[1.5rem] flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:bg-surfaceHover hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                    <div className="absolute -inset-px bg-gradient-to-r from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[1.5rem]" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500">Locked Folder</span>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-400">
                        <Lock size={16} />
                      </div>
                    </div>
                    <span className="text-3xl font-bold font-sans text-white tracking-tight leading-none relative z-10">
                      {stats ? stats.locked_encrypted.toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sub Navigation and View Filters */}
          <div className="flex items-center justify-between border-t border-b border-white/5 py-4 mb-4 select-none">
            {/* Category Pills on Left */}
            <div className="flex items-center gap-2 bg-[#111]/40 p-1 rounded-full border border-white/5">
              {(['all', 'favorites', 'recent', 'videos'] as const).map((pill) => (
                <button
                  key={pill}
                  onClick={() => setActivePill(pill)}
                  className={`px-5 py-2 text-[10px] font-bold rounded-full uppercase tracking-wider transition-all duration-300
                    ${
                      activePill === pill
                        ? 'bg-primary text-black font-extrabold shadow-[0_0_20px_rgba(var(--color-primary),0.2)]'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Date label and Grid/List view switch on Right */}
            <div className="flex items-center gap-6">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-gray-500 font-bold">
                {dateLabel}
              </span>

              {/* Layout switch controls */}
              <div className="flex items-center gap-1 bg-[#111]/40 p-1 rounded-full border border-white/5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    viewMode === 'grid' ? 'bg-white/10 text-primary' : 'text-gray-500 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    viewMode === 'list' ? 'bg-white/10 text-primary' : 'text-gray-500 hover:text-white'
                  }`}
                  title="List View"
                >
                  <Rows size={15} />
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
                <div className="flex flex-col items-center gap-4 opacity-60">
                  <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center">
                    <ImageIcon size={36} className="text-gray-500" />
                  </div>
                  <div className="text-center">
                    {currentView === 'trash' ? (
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
                onToggleGroupSelection={onToggleGroupSelection}
                virtualRowStart={virtualRow.start}
                virtualRowKey={virtualRow.key}
                virtualRowIndex={virtualRow.index}
                measureElement={rowVirtualizer.measureElement}
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
                onPhotoClick={onPhotoClick}
                onToggleSelection={onToggleSelection}
                virtualRowStart={virtualRow.start}
                virtualRowKey={virtualRow.key}
                virtualRowIndex={virtualRow.index}
                rowHeight={rowHeightPx}
                rowPadding={ROW_PADDING}
                measureElement={rowVirtualizer.measureElement}
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
                  onPhotoClick={onPhotoClick}
                  onToggleSelection={onToggleSelection}
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
    </div>
  );
};
