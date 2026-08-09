import React, { useCallback, useMemo, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CommandPalette, buildDefaultCommands } from './components/ui/CommandPalette';
import { usePrismShortcuts } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout/sidebar/Sidebar';
import { Header } from './components/layout/header/Header';
import { MainContent } from './components/layout/MainContent';
import { BulkActionsBar } from './components/layout/bulk-actions-bar/BulkActionsBar';
import { useEditStore } from '@/store/editStore';
import { FloatingActions } from './components/layout/floating-actions/FloatingActions';
import { ErrorBoundary } from './components/wrappers/ErrorBoundary';
import { DragDropOverlay } from './components/import/DragDropOverlay';
import { useDragDropImport } from './hooks/import/useDragDropImport';
import { useAppState } from './hooks/useAppState';
import { API_BASE } from './constants';
import { apiClient } from '@/services/apiClient';
import { AddToAlbumDialog } from './components/albums/AddToAlbumDialog';
import { useSettingsStore } from './store';
import { eventService } from '@/services/EventService';
import { normalizePhoto } from './types';
import type { ViewMode, Album, Photo } from './types';
import { useGalleryLayout } from './hooks/useGalleryLayout';
import { GoogleImportToast } from './components/ui/GoogleImportToast';
import { photoSrc } from './constants';
import { useTelemetry } from './hooks/useTelemetry';

const Lightbox = React.lazy(() =>
  import('./components/viewers/Lightbox').then((m) => ({ default: m.Lightbox }))
);
const ConfirmDialog = React.lazy(() =>
  import('./components/wrappers/ConfirmDialog').then((m) => ({ default: m.ConfirmDialog }))
);
const FileFolderBrowserDialog = React.lazy(() =>
  import('./components/FileFolderBrowser/FileFolderBrowserDialog').then((m) => ({ default: m.FileFolderBrowserDialog }))
);
const CollageMaker = React.lazy(() =>
  import('./components/PhotoView/CollageMaker').then((m) => ({ default: m.CollageMaker }))
);
const PhotoBook = React.lazy(() =>
  import('./components/PhotoView/PhotoBook').then((m) => ({ default: m.PhotoBook }))
);

function App() {
  const {
    currentView,
    setCurrentView,
    isLoading,
    isStatusLoading,
    selectedPhoto,
    setSelectedPhoto,
    activeFilters,
    setActiveFilters,
    isLockedAuthenticated,
    setIsLockedAuthenticated,
    sortMode,
    setSortMode,
    setContextPhotos,
    importStatus,
    setImportStatus,
    scrollRef,
    handleLockSession,
    handleScroll,
    handleUpload,
    handleNextPhoto,
    handlePrevPhoto,
    displayedPhotos,
    selectedIds,
    handleToggleSelection,
    handleToggleGroupSelection,
    clearSelection,
    isFavorited,
    onAddToAlbum,
    albumAddedSignal,
    handleBulkDelete,
    handleBulkFavorite,
    handleBulkLockToggle,
    handleBulkRestore,
    setPhotos,
    isAddToAlbumOpen,
    setIsAddToAlbumOpen,
    albums,
    handleSelectAlbumToAdd,
    handleCreateAlbumAndAdd,
    handleRemovePhotosFromActiveAlbum,
    selectedAlbum,
    handleRemoveSingleFromActiveAlbum,
    handleSetAlbumCover,
  } = useAppState();

  const { galleryStyle } = useGalleryLayout();
  const { logAction, logNavigation, logError } = useTelemetry();

  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  React.useEffect(() => {
    if (currentView === 'agent' && !isAgentEnabled) {
      setCurrentView('gallery');
    }
  }, [currentView, isAgentEnabled, setCurrentView]);

  const handlePhotoLocationUpdate = useCallback((photoId: string | number, next: Partial<Photo>) => {
    setPhotos(prev => prev.map(photo =>
      String(photo.id) === String(photoId)
        ? { ...photo, ...next }
        : photo
    ));
    if (selectedPhoto && String(selectedPhoto.id) === String(photoId)) {
      setSelectedPhoto({ ...selectedPhoto, ...next });
    }
  }, [setPhotos, setSelectedPhoto, selectedPhoto]);

  React.useEffect(() => {
    const unsubUpdate = eventService.subscribe('update_photo', (data) => {
      const rawPhoto = data.photo as any;
      if (rawPhoto) {
        handlePhotoLocationUpdate(rawPhoto.id, normalizePhoto(rawPhoto));
      }
    });
    return () => {
      unsubUpdate();
    };
  }, [handlePhotoLocationUpdate]);

  const handleViewChange = useCallback((v: ViewMode) => {
    setCurrentView(v);
    setActiveFilters(null);
    logNavigation(`view:${v}`, { view: v });
    if (v !== 'locked') {
      handleLockSession();
      clearSelection();
    }
  }, [setCurrentView, setActiveFilters, handleLockSession, clearSelection, logNavigation]);

  const handleResetSuccess = useCallback(() => {
    setPhotos([]);
    setSelectedPhoto(null);
    clearSelection();
  }, [setPhotos, setSelectedPhoto, clearSelection]);

  const handleLightboxToggleFavorite = useCallback(async (id: string | number) => {
    logAction('Lightbox', 'toggle_favorite', { photoId: id });
    await apiClient.post(`/api/v1/photos/${id}/favorite`, {});
    setPhotos(prev => {
      const updated = prev.map(p =>
        String(p.id) === String(id)
          ? { ...p, isFavorite: !p.isFavorite, is_favorite: !p.is_favorite }
          : p
      );
      const toggled = updated.find(p => String(p.id) === String(id));
      if (toggled) setSelectedPhoto(toggled);
      return updated;
    });
  }, [setPhotos, setSelectedPhoto, logAction]);

  const handleLightboxRemoveFromAlbum = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleRemoveSingleFromActiveAlbum(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleRemoveSingleFromActiveAlbum]
  );

  const handleLightboxSetAsCover = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleSetAlbumCover(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleSetAlbumCover]
  );

  const handleAuthenticate = useCallback(() => setIsLockedAuthenticated(true), [setIsLockedAuthenticated]);

  const selectedPhotoRef = React.useRef(selectedPhoto);
  selectedPhotoRef.current = selectedPhoto;

  const handleLightboxClose = useCallback(() => {
    logAction('Lightbox', 'close', { photoId: selectedPhotoRef.current?.id });
    setSelectedPhoto(null);
  }, [setSelectedPhoto, logAction]);

  // Global OS drag-and-drop import (Tauri)
  const dragDrop = useDragDropImport({
    onUpload: handleUpload,
    onImportProgress: setImportStatus,
    isImporting: importStatus.is_scanning,
    enabled: true,
  });

  const handleAddToAlbumClose = useCallback(() => setIsAddToAlbumOpen(false), [setIsAddToAlbumOpen]);

  const [isCollageOpen, setIsCollageOpen] = useState(false);
  const [isPhotoBookOpen, setIsPhotoBookOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const selectedPhotos = useMemo(() =>
    displayedPhotos.filter(p => selectedIds.has(String(p.id))),
    [displayedPhotos, selectedIds]
  );

  const handleCollage = useCallback(() => setIsCollageOpen(true), []);
  const handlePhotoBook = useCallback(() => setIsPhotoBookOpen(true), []);

  // ─── Command Palette ──────────────────────────────────────────────────────

  const commandItems = useMemo(
    () =>
      buildDefaultCommands({
        onNavigate: handleViewChange,
        onUpload: handleUpload,
        onSearch: (q: string) => setActiveFilters({ query: q, startDate: undefined, endDate: undefined, location: undefined }),
        onToggleLock: handleLockSession,
      }),
    [handleViewChange, handleUpload, setActiveFilters, handleLockSession]
  );

  // ─── Global Keyboard Shortcuts ─────────────────────────────────────────────

  usePrismShortcuts({
    onCommandPalette: () => setIsCommandPaletteOpen(true),
    onNavigate: handleViewChange,
    onUpload: handleUpload,
    onToggleLock: handleLockSession,
    onEscape: () => {
      if (selectedPhoto) {
        setSelectedPhoto(null);
      } else if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    },
    enabled: !isLoading,
  });

  const handleBulkPasteEdits = useCallback(async () => {
    const copied = useEditStore.getState().copiedAdjustments;
    if (!copied || selectedIds.size === 0) return;

    logAction('BulkActions', 'paste_adjustments', { count: selectedIds.size });
    try {
      const ids = Array.from(selectedIds).map(Number);
      const res = await fetch(`${API_BASE}/api/v1/photos/bulk-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_ids: ids,
          adjustments: copied,
        }),
      });

      if (!res.ok) {
        console.error('Failed to paste adjustments bulk:', await res.text());
      }
      // selection kept; only the toolbar close button deselects
    } catch (e) {
      logError('BulkActions', 'paste_adjustments_failed', e);
      console.error('Failed to paste adjustments:', e);
    }
  }, [selectedIds, logAction, logError]);

  return (
    <ErrorBoundary>
      <div data-theme={galleryStyle} className={`theme-${galleryStyle} relative flex flex-1 h-full w-full overflow-hidden bg-background text-gray-100`}>
        <div className="grain-overlay" />
        <div className="mesh-atmos" />

        <Sidebar
          currentView={currentView}
          onChangeView={handleViewChange}
        />

        <main className="flex-1 flex flex-col min-w-0 relative z-10">
          {currentView === 'gallery' && (
            <Header
              onSearch={setActiveFilters}
              sortMode={sortMode}
              onSortChange={setSortMode}
              onChangeView={handleViewChange}
              onUpload={handleUpload}
              onImportProgress={setImportStatus}
            />
          )}

          <MainContent
            currentView={currentView}
            photos={displayedPhotos}
            isLoading={isLoading}
            isStatusLoading={isStatusLoading}
            selectedIds={selectedIds}
            isLockedAuthenticated={isLockedAuthenticated}
            scrollRef={scrollRef}
            onPhotoClick={setSelectedPhoto}
            onToggleSelection={handleToggleSelection}
            onToggleGroupSelection={handleToggleGroupSelection}
            onAuthenticate={handleAuthenticate}
            onLockSession={handleLockSession}
            onPhotosLoaded={setContextPhotos}
            onScroll={handleScroll}
            onSearch={setActiveFilters}
            onUpload={handleUpload}
            onImportProgress={setImportStatus}
            sortMode={sortMode}
            onSortChange={setSortMode}
            onUpdatePhotos={setPhotos}
            onPhotoLocationUpdate={handlePhotoLocationUpdate}
            onBulkFavorite={handleBulkFavorite}
            onBulkDelete={handleBulkDelete}
            onBulkLockToggle={handleBulkLockToggle}
            onResetSuccess={handleResetSuccess}
          />

          <BulkActionsBar
            selectedCount={selectedIds.size}
            currentView={currentView}
            onClear={clearSelection}
            onAddToAlbum={onAddToAlbum}
            albumAddedSignal={albumAddedSignal}
            onRemoveFromAlbum={handleRemovePhotosFromActiveAlbum}
            onFavorite={handleBulkFavorite}
            isFavorited={isFavorited}
            onToggleLock={handleBulkLockToggle}
            onDelete={handleBulkDelete}
            onRestore={handleBulkRestore}
            onCollage={handleCollage}
            onPhotoBook={handlePhotoBook}
            onToolbox={() => handleViewChange('toolbox')}
            onPasteEdits={handleBulkPasteEdits}
          />
        </main>

        <Suspense fallback={null}>
          <AnimatePresence>
            {selectedPhoto && (
              <Lightbox
                photo={selectedPhoto}
                photos={displayedPhotos}
                onClose={handleLightboxClose}
                onNext={handleNextPhoto}
                onPrev={handlePrevPhoto}
                onPhotoSelect={setSelectedPhoto}
                onToggleFavorite={handleLightboxToggleFavorite}
                onRemoveFromAlbum={handleLightboxRemoveFromAlbum}
                onSetAsCover={handleLightboxSetAsCover}
              />
            )}
          </AnimatePresence>
        </Suspense>

        {currentView === 'gallery' && !selectedPhoto && (
          <FloatingActions
            importStatus={importStatus}
            onUpload={handleUpload}
            onImportProgress={setImportStatus}
          />
        )}

        <DragDropOverlay
          phase={dragDrop.phase}
          error={dragDrop.error}
          onDismissError={dragDrop.clearError}
        />

        <GoogleImportToast
          previewImg={displayedPhotos.length > 0 ? photoSrc(displayedPhotos[0]) : undefined}
          onStop={() => {
            fetch(`${API_BASE}/api/v1/utilities/background-jobs/stop`, { method: 'POST' }).catch(() => {});
          }}
        />

        <Suspense fallback={null}>
          <AddToAlbumDialog
            isOpen={isAddToAlbumOpen}
            onClose={handleAddToAlbumClose}
            albums={albums.filter(a => a.type !== 'smart') as Album[]}
            onSelectAlbum={handleSelectAlbumToAdd}
            onCreateAlbum={handleCreateAlbumAndAdd}
            selectedCount={selectedIds.size}
          />
          <ConfirmDialog />
          <FileFolderBrowserDialog />
        </Suspense>

        {/* Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          commands={commandItems}
        />

        <Suspense fallback={null}>
          <CollageMaker
            photos={selectedPhotos}
            isOpen={isCollageOpen}
            onClose={() => setIsCollageOpen(false)}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PhotoBook
            photos={selectedPhotos}
            isOpen={isPhotoBookOpen}
            onClose={() => setIsPhotoBookOpen(false)}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;
