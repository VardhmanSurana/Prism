import { useCallback, Dispatch, SetStateAction } from 'react';
import { Photo, ViewMode } from '../types';
import { API_BASE } from '../constants';

interface UseBulkActionsProps {
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  currentView: ViewMode;
  clearSelection: () => void;
  setSortMode: (mode: 'newest' | 'oldest' | 'added') => void;
}

export function useBulkActions({
  photos,
  setPhotos,
  currentView,
  clearSelection,
  setSortMode
}: UseBulkActionsProps) {

  const handleBulkDelete = useCallback((selectedIds: Set<string>) => {
    const isPermanent = currentView === 'trash';
    const message = isPermanent
      ? `Permanently delete ${selectedIds.size} items from Trash?`
      : `Move ${selectedIds.size} items to Trash?`;

    if (window.confirm(message)) {
      if (isPermanent) {
        setPhotos(prev => prev.filter(p => !selectedIds.has(String(p.id))));
      } else {
        setPhotos(prev => prev.map(p => selectedIds.has(String(p.id)) ? { ...p, isTrash: true } : p));
      }
      clearSelection();
    }
  }, [currentView, setPhotos, clearSelection]);

  const handleBulkArchive = useCallback((selectedIds: Set<string>) => {
    setPhotos(prev => prev.map(p => selectedIds.has(String(p.id)) ? { ...p, isArchived: true } : p));
    clearSelection();
  }, [setPhotos, clearSelection]);

  const handleBulkFavorite = useCallback(async (selectedIds: Set<string>) => {
    const idsArray = Array.from(selectedIds);
    const allFavorited = idsArray.every(id => {
      const p = photos.find(ph => String(ph.id) === id);
      return p?.isFavorite || p?.is_favorite;
    });
    const targetFavorite = !allFavorited;

    let successCount = 0;
    for (const id of idsArray) {
      const photo = photos.find(p => String(p.id) === id);
      const alreadyCorrect = targetFavorite
        ? (photo?.isFavorite || photo?.is_favorite)
        : !(photo?.isFavorite || photo?.is_favorite);
      if (alreadyCorrect) { successCount++; continue; }
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${id}/favorite`, { method: 'POST' });
        if (res.ok) successCount++;
      } catch (e) {
        console.error(`Failed to toggle favorite for photo ${id}:`, e);
      }
    }

    if (successCount > 0) {
      setPhotos(prev => prev.map(p =>
        selectedIds.has(String(p.id)) ? { ...p, isFavorite: targetFavorite, is_favorite: targetFavorite } : p
      ));
    }
    clearSelection();
  }, [photos, setPhotos, clearSelection]);

  const handleBulkLockToggle = useCallback(async (selectedIds: Set<string>) => {
    const isLocking = currentView !== 'locked';
    if (isLocking) {
      if (!window.confirm(`Encrypt and move ${selectedIds.size} selected items to the Locked Folder?`)) return;
    } else {
      if (!window.confirm(`Decrypt and restore ${selectedIds.size} selected items to your general photos grid?`)) return;
    }

    const idsArray = Array.from(selectedIds);
    let successCount = 0;

    for (const id of idsArray) {
      try {
        const endpoint = isLocking ? `/lock` : `/unlock`;
        const res = await fetch(`${API_BASE}/api/v1/photos/${id}${endpoint}`, {
          method: 'POST'
        });
        if (res.ok) {
          successCount++;
        } else {
          console.error(`Failed to lock/unlock photo ${id}:`, await res.text());
        }
      } catch (e) {
        console.error(`Error toggling lock state for photo ${id}:`, e);
      }
    }

    if (successCount > 0) {
      setPhotos(prev => prev.map(p => {
        if (selectedIds.has(String(p.id))) {
          return { ...p, isLocked: isLocking };
        }
        return p;
      }));
    }

    clearSelection();
  }, [currentView, setPhotos, clearSelection]);

  return {
    handleBulkDelete,
    handleBulkArchive,
    handleBulkFavorite,
    handleBulkLockToggle
  };
}
