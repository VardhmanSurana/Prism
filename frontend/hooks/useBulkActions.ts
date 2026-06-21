import { useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import { Photo, ViewMode } from '../types';
import { API_BASE } from '../constants';

import { customConfirm } from '../services/ConfirmService';

async function fetchInBatches<T>(
  items: T[],
  taskCreator: (item: T) => Promise<Response>,
  concurrencyLimit = 6
): Promise<PromiseSettledResult<Response>[]> {
  const results: PromiseSettledResult<Response>[] = new Array(items.length);
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const chunk = items.slice(i, i + concurrencyLimit);
    const chunkPromises = chunk.map(taskCreator);
    const chunkResults = await Promise.allSettled(chunkPromises);
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j];
    }
  }
  return results;
}

interface UseBulkActionsProps {
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  currentView: ViewMode;
  clearSelection: () => void;
  setSortMode: (mode: 'newest' | 'oldest' | 'added') => void;
  selectedIds: Set<string>;
  onAddToAlbumClick?: () => void;
}

export function useBulkActions({
  photos,
  setPhotos,
  currentView,
  clearSelection,
  setSortMode,
  selectedIds,
  onAddToAlbumClick,
}: UseBulkActionsProps) {

  const isFavorited = useMemo(
    () => Array.from(selectedIds).every(id => {
      const p = photos.find(ph => String(ph.id) === id);
      return p?.isFavorite || p?.is_favorite;
    }),
    [selectedIds, photos],
  );

  const onAddToAlbum = useCallback(() => {
    if (onAddToAlbumClick) {
      onAddToAlbumClick();
    } else {
      const name = window.prompt('Album name:');
      if (name) alert(`Added ${selectedIds.size} to ${name}`);
    }
  }, [onAddToAlbumClick, selectedIds.size]);

  const handleBulkDelete = useCallback(async () => {
    const isPermanent = currentView === 'trash';
    const message = isPermanent
      ? `Permanently delete ${selectedIds.size} items from Trash?`
      : `Move ${selectedIds.size} items to Trash?`;

    if (!await customConfirm(message, 'Confirm Deletion')) return;

    const idsArray = Array.from(selectedIds);
    const originalPhotos = photos.filter(p => selectedIds.has(String(p.id)));

    // Optimistic update
    if (isPermanent) {
      setPhotos(prev => prev.filter(p => !selectedIds.has(String(p.id))));
    } else {
      setPhotos(prev => prev.map(p =>
        selectedIds.has(String(p.id)) ? { ...p, isTrash: true, is_trash: true } : p
      ));
    }
    clearSelection();

    if (isPermanent) {
      return;
    }

    // Call API for logical delete in chunks of 6
    const results = await fetchInBatches(
      idsArray,
      id => fetch(`${API_BASE}/api/v1/photos/${id}/trash`, { method: 'POST' })
    );

    // Rollback failed ones
    const failedIds = new Set<string>();
    results.forEach((r, idx) => {
      const id = idsArray[idx];
      if (r.status === 'rejected' || !r.value.ok) {
        failedIds.add(id);
      }
    });

    if (failedIds.size > 0) {
      setPhotos(prev => prev.map(p => {
        const idStr = String(p.id);
        if (failedIds.has(idStr)) {
          const original = originalPhotos.find(op => String(op.id) === idStr);
          return original ? { ...p, isTrash: original.isTrash, is_trash: original.is_trash } : p;
        }
        return p;
      }));
    }
  }, [currentView, photos, setPhotos, clearSelection, selectedIds]);

  const handleBulkFavorite = useCallback(async () => {
    const idsArray = Array.from(selectedIds);
    const allFavorited = idsArray.every(id => {
      const p = photos.find(ph => String(ph.id) === id);
      return p?.isFavorite || p?.is_favorite;
    });
    const targetFavorite = !allFavorited;

    // Save original states
    const originalStates = new Map<string, { isFavorite: boolean; is_favorite: boolean }>();
    photos.forEach(p => {
      if (selectedIds.has(String(p.id))) {
        originalStates.set(String(p.id), {
          isFavorite: p.isFavorite,
          is_favorite: p.is_favorite ?? p.isFavorite
        });
      }
    });

    // Optimistically update
    setPhotos(prev => prev.map(p =>
      selectedIds.has(String(p.id)) ? { ...p, isFavorite: targetFavorite, is_favorite: targetFavorite } : p
    ));
    clearSelection();

    // Call API in chunks of 6
    const results = await fetchInBatches(
      idsArray,
      id => fetch(`${API_BASE}/api/v1/photos/${id}/favorite`, { method: 'POST' })
    );

    // Rollback failed ones
    const failedIds = new Set<string>();
    results.forEach((r, idx) => {
      const id = idsArray[idx];
      if (r.status === 'rejected' || !r.value.ok) {
        failedIds.add(id);
      }
    });

    if (failedIds.size > 0) {
      setPhotos(prev => prev.map(p => {
        const idStr = String(p.id);
        if (failedIds.has(idStr)) {
          const original = originalStates.get(idStr);
          return original ? { ...p, isFavorite: original.isFavorite, is_favorite: original.is_favorite } : p;
        }
        return p;
      }));
    }
  }, [photos, setPhotos, clearSelection, selectedIds]);

  const handleBulkLockToggle = useCallback(async () => {
    const isLocking = currentView !== 'locked';
    if (isLocking) {
      if (!await customConfirm(`Encrypt and move ${selectedIds.size} selected items to the Locked Folder?`, 'Confirm Lock')) return;
    } else {
      if (!await customConfirm(`Decrypt and restore ${selectedIds.size} selected items to your general photos grid?`, 'Confirm Unlock')) return;
    }

    const idsArray = Array.from(selectedIds);
    const endpoint = isLocking ? `/lock` : `/unlock`;

    // Save original states
    const originalStates = new Map<string, { isLocked?: boolean; is_locked?: boolean }>();
    photos.forEach(p => {
      if (selectedIds.has(String(p.id))) {
        originalStates.set(String(p.id), {
          isLocked: p.isLocked,
          is_locked: p.is_locked
        });
      }
    });

    // Optimistically update state
    setPhotos(prev => prev.map(p => {
      if (selectedIds.has(String(p.id))) {
        return { ...p, isLocked: isLocking, is_locked: isLocking };
      }
      return p;
    }));
    clearSelection();

    // Call API in chunks of 6
    const results = await fetchInBatches(
      idsArray,
      id => fetch(`${API_BASE}/api/v1/photos/${id}${endpoint}`, { method: 'POST' })
    );

    // Rollback failed ones
    const failedIds = new Set<string>();
    results.forEach((r, idx) => {
      const id = idsArray[idx];
      if (r.status === 'rejected' || !r.value.ok) {
        failedIds.add(id);
      }
    });

    if (failedIds.size > 0) {
      setPhotos(prev => prev.map(p => {
        const idStr = String(p.id);
        if (failedIds.has(idStr)) {
          const original = originalStates.get(idStr);
          return original ? { ...p, isLocked: original.isLocked, is_locked: original.is_locked } : p;
        }
        return p;
      }));
    }
  }, [currentView, photos, setPhotos, clearSelection, selectedIds]);

  const handleBulkRestore = useCallback(async () => {
    const idsArray = Array.from(selectedIds);

    // Save original states
    const originalStates = new Map<string, { isTrash?: boolean; is_trash?: boolean }>();
    photos.forEach(p => {
      if (selectedIds.has(String(p.id))) {
        originalStates.set(String(p.id), {
          isTrash: p.isTrash,
          is_trash: p.is_trash
        });
      }
    });

    // Optimistic update - remove from view
    setPhotos(prev => prev.filter(p => !selectedIds.has(String(p.id))));
    clearSelection();

    // Call API in chunks of 6
    const results = await fetchInBatches(
      idsArray,
      id => fetch(`${API_BASE}/api/v1/photos/${id}/restore`, { method: 'POST' })
    );

    // Rollback failed ones
    const failedIds = new Set<string>();
    results.forEach((r, idx) => {
      const id = idsArray[idx];
      if (r.status === 'rejected' || !r.value.ok) {
        failedIds.add(id);
      }
    });

    if (failedIds.size > 0) {
      setPhotos(prev => {
        const restored = Array.from(failedIds).map(id => {
          const original = originalStates.get(id);
          return photos.find(p => String(p.id) === id) ? { ...photos.find(p => String(p.id) === id)!, isTrash: original?.isTrash, is_trash: original?.is_trash } : null;
        }).filter(Boolean) as Photo[];
        return [...prev, ...restored];
      });
    }
  }, [photos, setPhotos, clearSelection, selectedIds]);

  return {
    handleBulkDelete,
    handleBulkFavorite,
    handleBulkLockToggle,
    handleBulkRestore,
    isFavorited,
    onAddToAlbum,
  };
}
