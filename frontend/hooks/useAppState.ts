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
import { useSyncStore } from '../store/syncStore';

/**
 * useAppState - Hook managing app state.
 */
export function useAppState() {
  const { photos, setPhotos, fetchPhotos, isLoading, isStatusLoading } = usePhotos();
  /**
   * syncStatus - Performs sync status.
   */
  const syncStatus = useSyncStore((s) => s.syncStatus);
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
  const [albumAddedSignal, setAlbumAddedSignal] = useState(0);
  const { albums, fetchAlbums, createAlbum, addPhotosToAlbum, removePhotosFromAlbum, selectedAlbum, setSelectedAlbum, setAlbumCover } = useAlbums();

  /**
   * handleAddToAlbumClick - Handles add to album click.
   */
  const handleAddToAlbumClick = useCallback(() => {
    fetchAlbums();
    setIsAddToAlbumOpen(true);
  }, [fetchAlbums]);

  /**
   * handleSelectAlbumToAdd - Handles select album to add.
   */
  const handleSelectAlbumToAdd = useCallback(async (albumId: number) => {
    const photoIds = Array.from(selectedIds).map(Number);
    if (photoIds.length > 0) {
      await addPhotosToAlbum(albumId, photoIds);
      setAlbumAddedSignal((s) => s + 1);
    }
    setIsAddToAlbumOpen(false);
  }, [selectedIds, addPhotosToAlbum]);

  /**
   * handleCreateAlbumAndAdd - Handles create album and add.
   */
  const handleCreateAlbumAndAdd = useCallback(async (name: string) => {
    const album = await createAlbum(name);
    if (album && selectedIds.size > 0) {
      const photoIds = Array.from(selectedIds).map(Number);
      await addPhotosToAlbum(Number(album.id), photoIds);
      setAlbumAddedSignal((s) => s + 1);
    }
    setIsAddToAlbumOpen(false);
  }, [selectedIds, createAlbum, addPhotosToAlbum]);

  /**
   * handleRemovePhotosFromActiveAlbum - Handles remove photos from active album.
   */
  const handleRemovePhotosFromActiveAlbum = useCallback(async () => {
    if (!selectedAlbum || selectedAlbum.type === 'smart') return;
    const photoIds = Array.from(selectedIds).map(Number);
    if (photoIds.length > 0) {
      await removePhotosFromAlbum(Number(selectedAlbum.id), photoIds);
    }
  }, [selectedAlbum, selectedIds, removePhotosFromAlbum]);


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
    setSortMode,
    selectedIds,
    onAddToAlbumClick: handleAddToAlbumClick,
  });

  /**
   * setCurrentView - Performs set current view.
   */
  const setCurrentView = useCallback((v: typeof currentView) => {
    setView(v, () => setContextPhotos(null));
  }, [setView]);

  /**
   * setSelectedPhoto - Performs set selected photo.
   */
  const setSelectedPhoto = useCallback((photo: Photo | null) => {
    setPhotoSelection(photo, () => setContextPhotos(null));
  }, [setPhotoSelection]);

  /**
   * handleRemoveSingleFromActiveAlbum - Handles remove single from active album.
   */
  const handleRemoveSingleFromActiveAlbum = useCallback(async (photoId: number) => {
    if (!selectedAlbum || selectedAlbum.type === 'smart') return;
    await removePhotosFromAlbum(Number(selectedAlbum.id), [photoId]);
    setSelectedPhoto(null);
  }, [selectedAlbum, removePhotosFromAlbum, setSelectedPhoto]);

  /**
   * handleSetAlbumCover - Handles set album cover.
   */
  const handleSetAlbumCover = useCallback(async (photoId: number) => {
    if (!selectedAlbum || selectedAlbum.type === 'smart') return;
    await setAlbumCover(Number(selectedAlbum.id), photoId);
  }, [selectedAlbum, setAlbumCover]);

  /**
   * handleUpload - Handles upload.
   */
  const handleUpload = useCallback((newPhotos: Photo[]) => {
    setPhotos(prev => {
      /**
       * existingIds - Performs existing ids.
       */
      const existingIds = new Set(prev.map(p => p.id));
      /**
       * filteredNew - Performs filtered new.
       */
      const filteredNew = newPhotos.filter(p => !existingIds.has(p.id));
      return [...filteredNew, ...prev];
    });
    setSortMode('added');
  }, [setPhotos]);

  /**
   * handleNextPhoto - Handles next photo.
   */
  const handleNextPhoto = useCallback(() => {
    const nextPhoto = getNextPhoto();
    if (nextPhoto) setPhotoSelection(nextPhoto, () => setContextPhotos(null));
  }, [getNextPhoto, setPhotoSelection]);

  /**
   * handlePrevPhoto - Handles prev photo.
   */
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
    handleRemovePhotosFromActiveAlbum,
    selectedAlbum,
    handleRemoveSingleFromActiveAlbum,
    handleSetAlbumCover,
    albumAddedSignal,
  };
}
