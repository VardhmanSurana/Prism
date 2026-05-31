import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MainContent } from './components/MainContent';
import { Lightbox } from './components/Lightbox';
import { BulkActionsBar } from './components/BulkActionsBar';
import { ChatWindow } from './components/ChatWindow';
import { FloatingActions } from './components/FloatingActions';
import { useAppState } from './hooks/useAppState';
import { useSelection } from './hooks/useSelection';
import { useBulkActions } from './hooks/useBulkActions';

function App() {
  const {
    currentView,
    setCurrentView,
    photos,
    setPhotos,
    syncStatus,
    selectedPhoto,
    setSelectedPhoto,
    activeFilters,
    setActiveFilters,
    theme,
    setTheme,
    isLockedAuthenticated,
    setIsLockedAuthenticated,
    isChatOpen,
    setIsChatOpen,
    sortMode,
    setSortMode,
    contextPhotos,
    setContextPhotos,
    importStatus,
    setImportStatus,
    scrollRef,
    handleLockSession,
    handleScroll,
    handleUpload,
    handleNextPhoto,
    handlePrevPhoto,
    displayedPhotos
  } = useAppState();

  const {
    selectedIds,
    handleToggleSelection,
    handleToggleGroupSelection,
    clearSelection
  } = useSelection();

  const {
    handleBulkDelete,
    handleBulkArchive,
    handleBulkFavorite,
    handleBulkLockToggle
  } = useBulkActions({
    photos,
    setPhotos,
    currentView,
    clearSelection,
    setSortMode
  });

  const handleViewChange = (v: typeof currentView) => {
    setCurrentView(v);
    setActiveFilters(null);
    if (v !== 'locked') {
      handleLockSession();
      clearSelection();
    }
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-gray-100">
      <div className="grain-overlay" />
      <div className="mesh-atmos" />

      <Sidebar
        currentView={currentView}
        onChangeView={handleViewChange}
      />

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {currentView !== 'photos' && (
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
          selectedIds={selectedIds}
          isLockedAuthenticated={isLockedAuthenticated}
          theme={theme}
          scrollRef={scrollRef}
          onPhotoClick={setSelectedPhoto}
          onToggleSelection={handleToggleSelection}
          onToggleGroupSelection={handleToggleGroupSelection}
          onAuthenticate={() => setIsLockedAuthenticated(true)}
          onLockSession={handleLockSession}
          onThemeChange={setTheme}
          onPhotosLoaded={setContextPhotos}
          onScroll={handleScroll}
          onSearch={setActiveFilters}
          onUpload={handleUpload}
          onImportProgress={setImportStatus}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <BulkActionsBar
              selectedCount={selectedIds.size}
              currentView={currentView}
              onClear={clearSelection}
              onShare={() => alert(`Sharing ${selectedIds.size} photos`)}
              onAddToAlbum={() => {
                const n = window.prompt("Album name:");
                if (n) alert(`Added ${selectedIds.size} to ${n}`);
              }}
              onFavorite={() => handleBulkFavorite(selectedIds)}
              isFavorited={Array.from(selectedIds).every(id => {
                const p = photos.find(ph => String(ph.id) === id);
                return p?.isFavorite || p?.is_favorite;
              })}
              onToggleLock={() => handleBulkLockToggle(selectedIds)}
              onArchive={() => handleBulkArchive(selectedIds)}
              onDelete={() => handleBulkDelete(selectedIds)}
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

      <AnimatePresence>
        {isChatOpen && (
          <ChatWindow
            onClose={() => setIsChatOpen(false)}
            onPhotoClick={setSelectedPhoto}
          />
        )}
      </AnimatePresence>

      <FloatingActions
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        importStatus={importStatus}
        syncStatus={syncStatus}
      />
    </div>
  );
}

export default App;
