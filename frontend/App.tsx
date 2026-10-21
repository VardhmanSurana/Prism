import React, { useCallback, useMemo, Suspense, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { buildDefaultCommands } from './components/ui/CommandPalette';
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
import { useSettingsStore } from './store';
import { eventService } from '@/services/EventService';
import { normalizePhoto, type Album, type Photo, type ViewMode } from './types';
import { LiveAnnouncer } from './components/ui/LiveAnnouncer';
import { ToastHost } from './components/ui/ToastHost';
import { useAnnounce } from './hooks/useAnnounce';
import { useTelemetry } from './hooks/useTelemetry';
import { ShareModal, type ShareTarget, SharePortalView } from './components/sharing';
import { UpdateManager } from './components/updater/UpdateManager';
import { useSafeModeStore } from '@/store/safeModeStore';
import { ShieldAlert } from 'lucide-react';

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
 * AddToAlbumDialog - Renders add to album dialog.
 */
const AddToAlbumDialog = React.lazy(() =>
  import('./components/albums/AddToAlbumDialog').then((m) => ({ default: m.AddToAlbumDialog }))
);
/**
 * CommandPalette - Renders command palette.
 */
const CommandPalette = React.lazy(() =>
  import('./components/ui/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const FirstRunWizardModal = React.lazy(() =>
  import('./components/onboarding/FirstRunWizardModal').then((m) => ({ default: m.FirstRunWizardModal }))
);
const ShortcutsCheatsheetModal = React.lazy(() =>
  import('./components/ui/ShortcutsCheatsheetModal').then((m) => ({ default: m.ShortcutsCheatsheetModal }))
);

/**
 * App - Renders app.
 */
function App() {
  const isSharePortal = typeof window !== 'undefined' && window.location.pathname.startsWith('/share/');
  if (isSharePortal) {
    return <SharePortalView />;
  }

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

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget>({ type: 'selection' });

  const handleShareSelected = useCallback(() => {
    setShareTarget({
      type: 'selection',
      photoIds: Array.from(selectedIds),
      count: selectedIds.size,
    });
    setIsShareModalOpen(true);
  }, [selectedIds]);

  const handleSharePhoto = useCallback((photo: Photo) => {
    setShareTarget({
      type: 'photo',
      photo,
    });
    setIsShareModalOpen(true);
  }, []);

  const handleShareAlbum = useCallback((album: Album | any) => {
    setShareTarget({
      type: 'album',
      album,
    });
    setIsShareModalOpen(true);
  }, []);

  const { isMobile } = usePlatform();
  const { logAction, logNavigation, logError } = useTelemetry();
  const { announce } = useAnnounce();

  // Announce selection count changes for screen readers
  const prevSelectedCountRef = React.useRef(selectedIds.size);
  React.useEffect(() => {
    if (prevSelectedCountRef.current !== selectedIds.size) {
      if (selectedIds.size === 0 && prevSelectedCountRef.current > 0) {
        announce('Selection cleared');
      } else if (selectedIds.size > 0) {
        announce(`${selectedIds.size} ${selectedIds.size === 1 ? 'photo' : 'photos'} selected`);
      }
      prevSelectedCountRef.current = selectedIds.size;
    }
  }, [selectedIds.size, announce]);

  // Announce import status completion
  const prevImportStatusRef = React.useRef(importStatus);
  React.useEffect(() => {
    if (prevImportStatusRef.current?.is_scanning && !importStatus?.is_scanning) {
      announce(`Import completed. Processed ${importStatus?.processed_files ?? 0} files.`);
    }
    prevImportStatusRef.current = importStatus;
  }, [importStatus, announce]);

  // Wrapped delete with screen reader announcement
  const handleBulkDeleteFromGrid = useCallback(async (ids: Set<string>) => {
    const count = ids.size;
    await handleBulkDelete(ids);
    if (count > 0) {
      announce(
        currentView === 'trash'
          ? `Permanently deleted ${count} ${count === 1 ? 'photo' : 'photos'}`
          : `Moved ${count} ${count === 1 ? 'photo' : 'photos'} to trash`
      );
    }
  }, [handleBulkDelete, currentView, announce]);

  const handleBulkDeleteFromBar = useCallback(async (skipConfirm?: boolean) => {
    const count = selectedIds.size;
    await handleBulkDelete(skipConfirm);
    if (count > 0) {
      announce(
        currentView === 'trash'
          ? `Permanently deleted ${count} ${count === 1 ? 'photo' : 'photos'}`
          : `Moved ${count} ${count === 1 ? 'photo' : 'photos'} to trash`
      );
    }
  }, [handleBulkDelete, selectedIds.size, currentView, announce]);

  // Wrapped restore with screen reader announcement
  const handleBulkRestoreWithAnnounce = useCallback(async () => {
    const count = selectedIds.size;
    await handleBulkRestore();
    if (count > 0) {
      announce(`Restored ${count} ${count === 1 ? 'photo' : 'photos'}`);
    }
  }, [handleBulkRestore, selectedIds.size, announce]);

  /**
   * fetchSettings - Retrieves fetch settings.
   */
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  /**
   * isAgentEnabled - Performs is agent enabled.
   */
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);

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
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const isSafeMode = useSafeModeStore((s) => s.isSafeMode);
  const safeModeReason = useSafeModeStore((s) => s.safeModeReason);
  const disableSafeMode = useSafeModeStore((s) => s.disableSafeMode);
  const toggleSafeMode = useSafeModeStore((s) => s.toggleSafeMode);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('prism_onboarding_completed')) {
      setIsOnboardingOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

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
        onToggleSafeMode: () => toggleSafeMode(),
      }),
    [handleViewChange, handleUpload, setActiveFilters, handleLockSession, toggleSafeMode]
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
      <UpdateManager />
      <div className="relative flex flex-1 h-dvh w-full overflow-hidden bg-[#151312] text-gray-100">
        <div className="grain-overlay" />
        <div className="mesh-atmos" />

        {!isMobile && (
          <Sidebar
            currentView={currentView}
            onChangeView={handleViewChange}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 relative z-10 pb-safe bg-[#151312]">
          {isSafeMode && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 z-50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold">Safe Mode Active:</span>
                <span className="text-amber-300/90">{safeModeReason || 'Third-party plugins and UI extensions isolated.'}</span>
              </div>
              <button
                onClick={disableSafeMode}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition cursor-pointer"
              >
                Exit Safe Mode
              </button>
            </div>
          )}

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

          {isMobile && (
            <>
              <input
                id="prism-mobile-file-upload"
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                aria-hidden="true"
                onChange={async (e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = '';
                  if (files.length === 0) return;

                  const uploadedPhotos: Photo[] = [];
                  for (const file of files) {
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch(`${API_BASE}/api/v1/photos/upload`, {
                        method: 'POST',
                        body: formData,
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const raw = data?.photo ?? data;
                        if (raw && raw.id !== undefined) {
                          uploadedPhotos.push(normalizePhoto(raw));
                        }
                      }
                    } catch (err) {
                      logError('MobileUpload', 'upload_failed', err);
                    }
                  }
                  if (uploadedPhotos.length > 0) {
                    handleUpload(uploadedPhotos);
                  }
                }}
              />
              <MobileHeader
                currentView={currentView}
                onSearch={setActiveFilters}
                sortMode={sortMode}
                onSortChange={setSortMode}
                onChangeView={handleViewChange}
                onUpload={() => {
                  const input = document.getElementById('prism-mobile-file-upload') as HTMLInputElement | null;
                  if (input) {
                    input.click();
                  } else {
                    handleUpload([]);
                  }
                }}
              />
            </>
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
            onBulkDelete={handleBulkDeleteFromGrid}
            onBulkLockToggle={handleBulkLockToggle}
            onResetSuccess={handleResetSuccess}
            onShareAlbum={handleShareAlbum}
            onNavigate={handleViewChange}
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
            onDelete={handleBulkDeleteFromBar}
            onRestore={handleBulkRestoreWithAnnounce}
            onCollage={handleCollage}
            onPhotoBook={handlePhotoBook}
            onToolbox={() => handleViewChange('toolbox')}
            onPasteEdits={handleBulkPasteEdits}
            onShare={handleShareSelected}
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
                onShare={handleSharePhoto}
              />
            )}
          </AnimatePresence>
        </Suspense>

        {/* Import is now prominently featured in Header */}

        <LiveAnnouncer />

        <ToastHost />

        <DragDropOverlay
          phase={dragDrop.phase}
          error={dragDrop.error}
          onDismissError={dragDrop.clearError}
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
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            commands={commandItems}
          />
        </Suspense>

        <Suspense fallback={null}>
          <CollageMaker
            photos={selectedPhotos}
            isOpen={isCollageOpen}
            onClose={() => setIsCollageOpen(false)}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PhotoBook
            isOpen={isPhotoBookOpen}
            onClose={() => setIsPhotoBookOpen(false)}
          />
        </Suspense>

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          target={shareTarget}
        />

        <Suspense fallback={null}>
          <FirstRunWizardModal
            isOpen={isOnboardingOpen}
            onComplete={() => setIsOnboardingOpen(false)}
          />
          <ShortcutsCheatsheetModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
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
