import React, { useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MainContent } from './components/MainContent';
import { Lightbox } from './components/Lightbox';
import { BulkActionsBar } from './components/BulkActionsBar';
import { FloatingActions } from './components/FloatingActions';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FileFolderBrowserDialog } from './components/FileFolderBrowserDialog';
import { useAppState } from './hooks/useAppState';
import type { ViewMode } from './types';

function App() {
  const {
    currentView,
    setCurrentView,
    isLoading,
    isStatusLoading,
    syncStatus,
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
            syncStatus={syncStatus}
            selectedIds={selectedIds}
            isLockedAuthenticated={isLockedAuthenticated}
            scrollRef={scrollRef}
            onPhotoClick={setSelectedPhoto}
            onToggleSelection={handleToggleSelection}
            onToggleGroupSelection={handleToggleGroupSelection}
            onAuthenticate={() => setIsLockedAuthenticated(true)}
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
                onFavorite={handleBulkFavorite}
                isFavorited={isFavorited}
                onToggleLock={handleBulkLockToggle}
                onDelete={handleBulkDelete}
                onRestore={handleBulkRestore}
              />
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {selectedPhoto && (
            <Lightbox
              photo={selectedPhoto}
              onClose={() => setSelectedPhoto(null)}
              onNext={handleNextPhoto}
              onPrev={handlePrevPhoto}
            />
          )}
        </AnimatePresence>

        <FloatingActions
          importStatus={importStatus}
          syncStatus={syncStatus}
        />
        
        <ConfirmDialog />
        <FileFolderBrowserDialog />
      </div>
    </ErrorBoundary>
  );
}

export default App;
