import React, { useCallback, useMemo, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/layout/sidebar/Sidebar';
import { Header } from './components/layout/header/Header';
import { MainContent } from './components/layout/MainContent';
import { BulkActionsBar } from './components/layout/bulk-actions-bar/BulkActionsBar';
import { FloatingActions } from './components/layout/floating-actions/FloatingActions';
import { ErrorBoundary } from './components/wrappers/ErrorBoundary';
import { DragDropOverlay } from './components/import/DragDropOverlay';
import { useDragDropImport } from './hooks/import/useDragDropImport';
import { useAppState } from './hooks/useAppState';
import { API_BASE } from './constants';
import { apiClient } from '@/services/apiClient';
import { AddToAlbumDialog } from './components/albums/AddToAlbumDialog';
import type { ViewMode, Album, Photo } from './types';

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

  const handleViewChange = useCallback((v: ViewMode) => {
    setCurrentView(v);
    setActiveFilters(null);
    if (v !== 'locked') {
      handleLockSession();
      clearSelection();
    }
  }, [setCurrentView, setActiveFilters, handleLockSession, clearSelection]);

  const handleResetSuccess = useCallback(() => {
    setPhotos([]);
    setSelectedPhoto(null);
    clearSelection();
  }, [setPhotos, setSelectedPhoto, clearSelection]);

  const handleLightboxToggleFavorite = useCallback(async (id: string | number) => {
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
  }, [setPhotos, setSelectedPhoto]);

  const handleLightboxRemoveFromAlbum = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleRemoveSingleFromActiveAlbum(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleRemoveSingleFromActiveAlbum]
  );

  const handleLightboxSetAsCover = useMemo(() =>
    selectedAlbum ? () => selectedPhoto && handleSetAlbumCover(Number(selectedPhoto.id)) : undefined,
    [selectedAlbum, selectedPhoto, handleSetAlbumCover]
  );

  const handleAuthenticate = useCallback(() => setIsLockedAuthenticated(true), [setIsLockedAuthenticated]);

  const handleLightboxClose = useCallback(() => setSelectedPhoto(null), [setSelectedPhoto]);

  const handlePhotoLocationUpdate = useCallback((photoId: string | number, next: Partial<Photo>) => {
    setPhotos(prev => prev.map(photo =>
      String(photo.id) === String(photoId)
        ? { ...photo, ...next }
        : photo
    ));
    setSelectedPhoto(prev =>
      prev && String(prev.id) === String(photoId)
        ? { ...prev, ...next }
        : prev
    );
  }, [setPhotos, setSelectedPhoto]);

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

  const selectedPhotos = useMemo(() =>
    displayedPhotos.filter(p => selectedIds.has(String(p.id))),
    [displayedPhotos, selectedIds]
  );

  const handleCollage = useCallback(() => setIsCollageOpen(true), []);
  const handlePhotoBook = useCallback(() => setIsPhotoBookOpen(true), []);

  return (
    <ErrorBoundary>
      <div className="relative flex h-screen w-screen overflow-hidden bg-background text-gray-100">
        <div className="grain-overlay" />
        <div className="mesh-atmos" />

        <Sidebar
          currentView={currentView}
          onChangeView={handleViewChange}
        />

        <main className="flex-1 flex flex-col min-w-0 relative z-10">
          {currentView !== 'gallery' && currentView !== 'agent' && (
            <Header
              onSearch={setActiveFilters}
              sortMode={sortMode}
              onSortChange={setSortMode}
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

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BulkActionsBar
                selectedCount={selectedIds.size}
                currentView={currentView}
                onClear={clearSelection}
                onAddToAlbum={onAddToAlbum}
                onRemoveFromAlbum={handleRemovePhotosFromActiveAlbum}
                onFavorite={handleBulkFavorite}
                isFavorited={isFavorited}
                onToggleLock={handleBulkLockToggle}
                onDelete={handleBulkDelete}
                onRestore={handleBulkRestore}
                onCollage={handleCollage}
                onPhotoBook={handlePhotoBook}
              />
            )}
          </AnimatePresence>
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

        <Suspense fallback={null}>
          <CollageMaker
            photos={selectedPhotos}
            isOpen={isCollageOpen}
            onClose={() => { setIsCollageOpen(false); clearSelection(); }}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PhotoBook
            photos={selectedPhotos}
            isOpen={isPhotoBookOpen}
            onClose={() => { setIsPhotoBookOpen(false); clearSelection(); }}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;
