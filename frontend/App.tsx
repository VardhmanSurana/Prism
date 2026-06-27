import React, { useCallback, useMemo, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/layout/sidebar/Sidebar';
import { Header } from './components/layout/header/Header';
import { MainContent } from './components/MainContent';
import { BulkActionsBar } from './components/layout/bulk-actions-bar/BulkActionsBar';
import { FloatingActions } from './components/layout/floating-actions/FloatingActions';
import { ErrorBoundary } from './components/wrappers/ErrorBoundary';
import { useAppState } from './hooks/useAppState';
import { API_BASE } from './constants';
import { AddToAlbumDialog } from './components/albums/AddToAlbumDialog';
import type { ViewMode } from './types';

const Lightbox = React.lazy(() =>
  import('./components/viewers/Lightbox').then((m) => ({ default: m.Lightbox }))
);
const ConfirmDialog = React.lazy(() =>
  import('./components/wrappers/ConfirmDialog').then((m) => ({ default: m.ConfirmDialog }))
);
const FileFolderBrowserDialog = React.lazy(() =>
  import('./components/FileFolderBrowser/FileFolderBrowserDialog').then((m) => ({ default: m.FileFolderBrowserDialog }))
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
    await fetch(`${API_BASE}/api/v1/photos/${id}/favorite`, { method: 'POST' });
    setPhotos(prev => prev.map(p =>
      String(p.id) === String(id)
        ? { ...p, isFavorite: !p.isFavorite, is_favorite: !p.is_favorite }
        : p
    ));
  }, [setPhotos]);

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

  const handleAddToAlbumClose = useCallback(() => setIsAddToAlbumOpen(false), [setIsAddToAlbumOpen]);

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
              onUpload={handleUpload}
              onImportProgress={setImportStatus}
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

        <FloatingActions
          importStatus={importStatus}
        />

        <Suspense fallback={null}>
          <AddToAlbumDialog
            isOpen={isAddToAlbumOpen}
            onClose={handleAddToAlbumClose}
            albums={albums}
            onSelectAlbum={handleSelectAlbumToAdd}
            onCreateAlbum={handleCreateAlbumAndAdd}
            selectedCount={selectedIds.size}
          />
          <ConfirmDialog />
          <FileFolderBrowserDialog />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;
