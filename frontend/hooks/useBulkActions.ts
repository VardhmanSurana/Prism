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
  setSortMode: (mode: 'newest' | 'oldest' | 'added') => void;
  selectedIds: Set<string>;
  onAddToAlbumClick?: () => void;
}

export function useBulkActions({
  photos,
  setPhotos,
  currentView,
  setSortMode,
  selectedIds,
  onAddToAlbumClick,
}: UseBulkActionsProps) {

  const selectedPhotoMap = useMemo(() => {
    const map = new Map<string, Photo>();
    for (const p of photos) {
      if (selectedIds.has(String(p.id))) {
        map.set(String(p.id), p);
      }
    }
    return map;
  }, [photos, selectedIds]);

  const isFavorited = useMemo(
    () => selectedIds.size > 0 && Array.from(selectedIds).every(id => {
      const p = selectedPhotoMap.get(id);
      return p?.isFavorite || p?.is_favorite;
    }),
    [selectedIds, selectedPhotoMap],
  );

  const onAddToAlbum = useCallback(() => {
    if (onAddToAlbumClick) {
      onAddToAlbumClick();
    } else {
      const name = window.prompt('Album name:');
      if (name) alert(`Added ${selectedIds.size} to ${name}`);
    }
  }, [onAddToAlbumClick, selectedIds.size]);

  const handleBulkDelete = useCallback(async (skipConfirmArg?: boolean | Set<string>) => {
    const skipConfirm = typeof skipConfirmArg === 'boolean' ? skipConfirmArg : false;
    const isPermanent = currentView === 'trash';
    const message = isPermanent
      ? `Permanently delete ${selectedIds.size} items from Trash?`
      : `Move ${selectedIds.size} items to Trash?`;

    if (!skipConfirm) {
      if (!await customConfirm(message, 'Confirm Deletion')) return;
    }

    const idsArray = Array.from(selectedIds);

    if (isPermanent) {
      // Permanent delete: purge ALL app-side data per item via the backend
      // (DB row, thumbnails, faces, albums). Media files are never touched.
      // Snapshot for rollback of failed purges.
      let snapshot: Photo[] = [];
      setPhotos(prev => {
        snapshot = prev;
        return prev.filter(p => !selectedIds.has(String(p.id)));
      });

      const results = await fetchInBatches(
        idsArray,
        id => {
          const target = selectedPhotoMap.get(id);
          return fetch(`${API_BASE}/api/v1/photos/${target?.uuid ?? id}/purge`, {
            method: 'DELETE',
          });
        }
      );

      const failedIds = new Set<string>();
      results.forEach((r, idx) => {
        if (r.status === 'rejected' || !r.value.ok) {
          failedIds.add(idsArray[idx]);
        }
      });

      if (failedIds.size > 0) {
        console.error(`Permanent delete failed for ${failedIds.size} item(s)`);
        setPhotos(prev => [
          ...snapshot.filter(p => failedIds.has(String(p.id))),
          ...prev,
        ]);
      }

      return;
    }

    // Logical delete (move to trash): optimistic update + API call in chunks
    setPhotos(prev => prev.map(p =>
      selectedIds.has(String(p.id)) ? { ...p, isTrash: true, is_trash: true } : p
    ));

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
          const original = selectedPhotoMap.get(idStr);
          return original ? { ...p, isTrash: original.isTrash, is_trash: original.is_trash } : p;
        }
        return p;
      }));
    }
  }, [currentView, selectedPhotoMap, setPhotos, selectedIds]);

  const handleBulkFavorite = useCallback(async () => {
    const idsArray = Array.from(selectedIds);
    const allFavorited = idsArray.every(id => {
      const p = selectedPhotoMap.get(id);
      return p?.isFavorite || p?.is_favorite;
    });
    const targetFavorite = !allFavorited;

    // Save original states
    const originalStates = new Map<string, { isFavorite: boolean; is_favorite: boolean }>();
    for (const [id, p] of selectedPhotoMap) {
      originalStates.set(id, {
        isFavorite: p.isFavorite,
        is_favorite: p.is_favorite ?? p.isFavorite
      });
    }

    // Optimistically update
    setPhotos(prev => prev.map(p =>
      selectedIds.has(String(p.id)) ? { ...p, isFavorite: targetFavorite, is_favorite: targetFavorite } : p
    ));

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
  }, [selectedPhotoMap, setPhotos, selectedIds]);

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
    for (const [id, p] of selectedPhotoMap) {
      originalStates.set(id, {
        isLocked: p.isLocked,
        is_locked: p.is_locked
      });
    }

    // Optimistically update state
    setPhotos(prev => prev.map(p => {
      if (selectedIds.has(String(p.id))) {
        return { ...p, isLocked: isLocking, is_locked: isLocking };
      }
      return p;
    }));

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
  }, [currentView, selectedPhotoMap, setPhotos, selectedIds]);

  const handleBulkRestore = useCallback(async () => {
    const idsArray = Array.from(selectedIds);

    // Optimistic update: un-trash so photos leave trash view and reappear in the gallery
    setPhotos(prev => prev.map(p =>
      selectedIds.has(String(p.id)) ? { ...p, isTrash: false, is_trash: false } : p
    ));

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
      setPhotos(prev => prev.map(p => {
        const idStr = String(p.id);
        if (failedIds.has(idStr)) {
          return { ...p, isTrash: true, is_trash: true };
        }
        return p;
      }));
    }
  }, [setPhotos, selectedIds]);

  return {
    handleBulkDelete,
    handleBulkFavorite,
    handleBulkLockToggle,
    handleBulkRestore,
    isFavorited,
    onAddToAlbum,
  };
}
