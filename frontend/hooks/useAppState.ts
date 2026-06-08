import { useState, useCallback } from 'react';
import { Photo, ViewMode } from '../types';
import { usePhotos } from './usePhotos';
import { usePhotoSelection } from './appState/usePhotoSelection';
import { useFilters } from './appState/useFilters';
import { useLockedFolder } from './appState/useLockedFolder';
import { usePhotoSorting } from './appState/usePhotoSorting';
import { useImportStatus } from './appState/useImportStatus';
import { useSelection } from './useSelection';
import { useBulkActions } from './useBulkActions';

export function useAppState() {
  const { photos, setPhotos, fetchPhotos, isLoading, syncStatus } = usePhotos();
  const [contextPhotos, setContextPhotos] = useState<Photo[] | null>(null);

  const {
    currentView,
    setCurrentView: setView,
    activeFilters,
    setActiveFilters,
    sortMode,
    setSortMode,
    theme,
    setTheme,
    isChatOpen,
    setIsChatOpen,
  } = useFilters();

  const {
    selectedPhoto,
    setSelectedPhoto: setPhotoSelection,
  } = usePhotoSelection(photos);

  const {
    isLockedAuthenticated,
    setIsLockedAuthenticated,
    handleLockSession,
  } = useLockedFolder();

  const { importStatus, setImportStatus } = useImportStatus();

  const {
    scrollRef,
    displayedPhotos,
    handleScroll,
    handleNextPhoto: getNextPhoto,
    handlePrevPhoto: getPrevPhoto,
    contextPhotos: sortedContextPhotos,
    setContextPhotos: setSortedContextPhotos,
  } = usePhotoSorting({
    photos,
    currentView,
    activeFilters,
    sortMode,
    contextPhotos,
    selectedPhoto,
    onFetchPhotos: fetchPhotos,
    onSetContextPhotos: setContextPhotos,
  });

  const {
    selectedIds,
    handleToggleSelection,
    handleToggleGroupSelection,
    clearSelection,
  } = useSelection();

  const {
    handleBulkDelete,
    handleBulkArchive,
    handleBulkFavorite,
    handleBulkLockToggle,
    isFavorited,
    onShare,
    onAddToAlbum,
  } = useBulkActions({
    photos,
    setPhotos,
    currentView,
    clearSelection,
    setSortMode,
    selectedIds,
  });

  const setCurrentView = useCallback((v: typeof currentView) => {
    setView(v, () => setContextPhotos(null));
  }, [setView]);

  const setSelectedPhoto = useCallback((photo: Photo | null) => {
    setPhotoSelection(photo, () => setContextPhotos(null));
  }, [setPhotoSelection]);

  const handleUpload = useCallback((newPhotos: Photo[]) => {
    setPhotos(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const filteredNew = newPhotos.filter(p => !existingIds.has(p.id));
      return [...filteredNew, ...prev];
    });
    setSortMode('added');
  }, [setPhotos]);

  const handleNextPhoto = useCallback(() => {
    const nextPhoto = getNextPhoto();
    if (nextPhoto) setPhotoSelection(nextPhoto, () => setContextPhotos(null));
  }, [getNextPhoto, setPhotoSelection]);

  const handlePrevPhoto = useCallback(() => {
    const prevPhoto = getPrevPhoto();
    if (prevPhoto) setPhotoSelection(prevPhoto, () => setContextPhotos(null));
  }, [getPrevPhoto, setPhotoSelection]);

  return {
    currentView,
    setCurrentView,
    photos,
    setPhotos,
    fetchPhotos,
    isLoading,
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
    displayedPhotos,
    selectedIds,
    handleToggleSelection,
    handleToggleGroupSelection,
    clearSelection,
    isFavorited,
    onShare,
    onAddToAlbum,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkFavorite,
    handleBulkLockToggle,
  };
}
