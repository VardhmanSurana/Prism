import React, { useCallback, useMemo, Suspense, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CommandPalette, buildDefaultCommands } from './components/ui/CommandPalette';
import { initGSAPDefaults } from '@/lib/motion-tokens';
import { usePrismShortcuts } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout/sidebar/Sidebar';
import { Header } from './components/layout/header/Header';
import { MobileHeader } from './components/layout/header/MobileHeader';
import { MobileBottomNav } from './components/layout/bottom-nav/MobileBottomNav';
import { usePlatform } from './hooks/usePlatform';
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

/**
 * Lightbox - Renders lightbox.
 */
const Lightbox = React.lazy(() =>
  import('./components/viewers/Lightbox').then((m) => ({ default: m.Lightbox }))
);
/**
 * ConfirmDialog - Renders confirm dialog.
 */
const ConfirmDialog = React.lazy(() =>
  import('./components/wrappers/ConfirmDialog').then((m) => ({ default: m.ConfirmDialog }))
);
/**
 * FileFolderBrowserDialog - Renders file folder browser dialog.
 */
const FileFolderBrowserDialog = React.lazy(() =>
  import('./components/FileFolderBrowser/FileFolderBrowserDialog').then((m) => ({ default: m.FileFolderBrowserDialog }))
);
/**
 * CollageMaker - Renders collage maker.
 */
const CollageMaker = React.lazy(() =>
  import('./components/PhotoView/CollageMaker').then((m) => ({ default: m.CollageMaker }))
);
/**
 * PhotoBook - Renders photo book.
 */
const PhotoBook = React.lazy(() =>
  import('./components/PhotoView/PhotoBook').then((m) => ({ default: m.PhotoBook }))
);

/**
 * App - Renders app.
 */
function App() {
  const {
    currentView,
    setCurrentView,
    isLoading,
    isStatusLoading,
    selectedPhoto,
    setSelectedPhoto,
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
  const { isMobile } = usePlatform();
  const { logAction, logNavigation, logError } = useTelemetry();

  /**
   * fetchSettings - Retrieves fetch settings.
   */
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  /**
   * isAgentEnabled - Performs is agent enabled.
   */
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);

  // Initialize GSAP defaults once at app startup
  React.useEffect(() => {
    initGSAPDefaults();
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  React.useEffect(() => {
    if (currentView === 'agent' && !isAgentEnabled) {
      setCurrentView('gallery');
    }
  }, [currentView, isAgentEnabled, setCurrentView]);

  /**
   * handlePhotoLocationUpdate - Handles photo location update.
   */
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
    const handleUpdate = (rawPhoto: any) => {
      if (rawPhoto) {
        const normalized = normalizePhoto(rawPhoto);
        handlePhotoLocationUpdate(normalized.id, {
          ...normalized,
          hash: normalized.hash || String(Date.now()),
          url: `${normalized.url || `/api/v1/photos/${normalized.id}/thumbnail`}?h=${Date.now()}`
        });
      }
    };

    const unsubUpdate = eventService.subscribe('update_photo', (data) => {
      handleUpdate(data.photo);
    });
    const unsubPhotoUpdated = eventService.subscribe('photo_updated', (data) => {
      handleUpdate(data.photo);
    });

    return () => {
      unsubUpdate();
      unsubPhotoUpdated();
    };
  }, [handlePhotoLocationUpdate]);

  /**
   * handleViewChange - Handles view change.
   */
  const handleViewChange = useCallback((v: ViewMode) => {
    setCurrentView(v);
    setActiveFilters(null);
    logNavigation(`view:${v}`, { view: v });
    if (v !== 'locked') {
      handleLockSession();
      clearSelection();
    }
  }, [setCurrentView, setActiveFilters, handleLockSession, clearSelection, logNavigation]);

  /**
   * handleResetSuccess - Handles reset success.
   */
  const handleResetSuccess = useCallback(() => {
    setPhotos([]);
    setSelectedPhoto(null);
    clearSelection();
  }, [setPhotos, setSelectedPhoto, clearSelection]);

  /**
   * handleLightboxToggleFavorite - Handles lightbox toggle favorite.
   */
  const handleLightboxToggleFavorite = useCallback(async (id: string | number) => {
    logAction('Lightbox', 'toggle_favorite', { photoId: id });
    await apiClient.post(`/api/v1/photos/${id}/favorite`, {});
    setPhotos(prev => {
      /**
       * updated - Performs updated.
       */
      const updated = prev.map(p =>
        String(p.id) === String(id)
          ? { ...p, isFavorite: !p.isFavorite, is_favorite: !p.is_favorite }
          : p
      );
      /**
       * toggled - Performs toggled.
       */
      const toggled = updated.find(p => String(p.id) === String(id));
      if (toggled) setSelectedPhoto(toggled);
      return updated;
    });
  }, [setPhotos, setSelectedPhoto, logAction]);

  /**
   * handleLightboxRemoveFromAlbum - Handles lightbox remove from album.
   */
  const handleLightboxRemoveFromAlbum = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleRemoveSingleFromActiveAlbum(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleRemoveSingleFromActiveAlbum]
  );

  /**
   * handleLightboxSetAsCover - Handles lightbox set as cover.
   */
  const handleLightboxSetAsCover = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleSetAlbumCover(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleSetAlbumCover]
  );

  /**
   * handleAuthenticate - Handles authenticate.
   */
  const handleAuthenticate = useCallback(() => setIsLockedAuthenticated(true), [setIsLockedAuthenticated]);

  const selectedPhotoRef = React.useRef(selectedPhoto);
  selectedPhotoRef.current = selectedPhoto;

  /**
   * handleLightboxClose - Handles lightbox close.
   */
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

  /**
   * handleAddToAlbumClose - Handles add to album close.
   */
  const handleAddToAlbumClose = useCallback(() => setIsAddToAlbumOpen(false), [setIsAddToAlbumOpen]);

  const [isCollageOpen, setIsCollageOpen] = useState(false);
  const [isPhotoBookOpen, setIsPhotoBookOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  /**
   * selectedPhotos - Performs selected photos.
   */
  const selectedPhotos = useMemo(() =>
    displayedPhotos.filter(p => selectedIds.has(String(p.id))),
    [displayedPhotos, selectedIds]
  );

  /**
   * handleCollage - Handles collage.
   */
  const handleCollage = useCallback(() => setIsCollageOpen(true), []);
  /**
   * handlePhotoBook - Handles photo book.
   */
  const handlePhotoBook = useCallback(() => setIsPhotoBookOpen(true), []);

  // ─── Command Palette ──────────────────────────────────────────────────────

  const commandItems = useMemo(
    () =>
      buildDefaultCommands({
        onNavigate: (v: string) => handleViewChange(v as ViewMode),
        onUpload: () => handleUpload([]),
        onSearch: (q: string) => setActiveFilters({ query: q, startDate: undefined, endDate: undefined, location: undefined }),
        onToggleLock: handleLockSession,
      }),
    [handleViewChange, handleUpload, setActiveFilters, handleLockSession]
  );

  // ─── Global Keyboard Shortcuts ─────────────────────────────────────────────

  usePrismShortcuts({
    onCommandPalette: () => setIsCommandPaletteOpen(true),
    onNavigate: (v: string) => handleViewChange(v as ViewMode),
    onUpload: () => handleUpload([]),
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

  /**
   * handleBulkPasteEdits - Handles bulk paste edits.
   */
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
      <div data-theme={galleryStyle} className={`theme-${galleryStyle} relative flex flex-1 h-dvh w-full overflow-hidden bg-background text-gray-100`}>
        <div className="grain-overlay" />
        <div className="mesh-atmos" />

        {!isMobile && (
          <Sidebar
            currentView={currentView}
            onChangeView={handleViewChange}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 relative z-10 pb-safe">
          {!isMobile && currentView === 'gallery' && (
            <Header
              onSearch={setActiveFilters}
              sortMode={sortMode}
              onSortChange={setSortMode}
              onChangeView={handleViewChange}
              onUpload={handleUpload}
              onImportProgress={setImportStatus}
            />
          )}

          {isMobile && currentView === 'gallery' && (
            <MobileHeader
              currentView={currentView}
              onSearch={setActiveFilters}
              sortMode={sortMode}
              onSortChange={setSortMode}
              onChangeView={handleViewChange}
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
            fetch(`${API_BASE}/api/v1/utilities/background-jobs/stop`, { method: 'POST' }).catch(() => { });
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

        {isMobile && (
          <MobileBottomNav
            currentView={currentView}
            onChangeView={handleViewChange}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
