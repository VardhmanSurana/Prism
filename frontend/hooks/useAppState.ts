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
import { useAlbums } from '../components/albums/hooks/useAlbums';

export function useAppState() {
  const { photos, setPhotos, fetchPhotos, isLoading, isStatusLoading, syncStatus } = usePhotos();
  const [contextPhotos, setContextPhotos] = useState<Photo[] | null>(null);

  const {
    currentView,
    setCurrentView: setView,
    activeFilters,
    setActiveFilters,
    sortMode,
    setSortMode,
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

  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const { albums, createAlbum, addPhotosToAlbum } = useAlbums();

  const handleAddToAlbumClick = useCallback(() => {
    setIsAddToAlbumOpen(true);
  }, []);

  const handleSelectAlbumToAdd = useCallback(async (albumId: number) => {
    const photoIds = Array.from(selectedIds).map(Number);
    if (photoIds.length > 0) {
      await addPhotosToAlbum(albumId, photoIds);
    }
    setIsAddToAlbumOpen(false);
    clearSelection();
  }, [selectedIds, addPhotosToAlbum, clearSelection]);

  const handleCreateAlbumAndAdd = useCallback(async (name: string) => {
    const album = await createAlbum(name);
    if (album && selectedIds.size > 0) {
      const photoIds = Array.from(selectedIds).map(Number);
      await addPhotosToAlbum(album.id, photoIds);
    }
    setIsAddToAlbumOpen(false);
    clearSelection();
  }, [selectedIds, createAlbum, addPhotosToAlbum, clearSelection]);

  const {
    handleBulkDelete,
    handleBulkFavorite,
    handleBulkLockToggle,
    handleBulkRestore,
    isFavorited,
    onAddToAlbum,
  } = useBulkActions({
    photos,
    setPhotos,
    currentView,
    clearSelection,
    setSortMode,
    selectedIds,
    onAddToAlbumClick: handleAddToAlbumClick,
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
    isStatusLoading,
    syncStatus,
    selectedPhoto,
    setSelectedPhoto,
    activeFilters,
    setActiveFilters,
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
    onAddToAlbum,
    handleBulkDelete,
    handleBulkFavorite,
    handleBulkLockToggle,
    handleBulkRestore,
    isAddToAlbumOpen,
    setIsAddToAlbumOpen,
    albums,
    handleSelectAlbumToAdd,
    handleCreateAlbumAndAdd,
  };
}
