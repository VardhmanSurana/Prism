import { useMemo, useRef, useCallback } from 'react';
import { Photo, ViewMode, SearchFilters, SortMode } from '../../types';

interface UsePhotoSortingProps {
  photos: Photo[];
  currentView: ViewMode;
  activeFilters: SearchFilters | null;
  sortMode: SortMode;
  contextPhotos: Photo[] | null;
  selectedPhoto: Photo | null;
  onFetchPhotos: () => void;
  onSetContextPhotos: (photos: Photo[] | null) => void;
}

export function usePhotoSorting({
  photos,
  currentView,
  activeFilters,
  sortMode,
  contextPhotos,
  selectedPhoto,
  onFetchPhotos,
  onSetContextPhotos
}: UsePhotoSortingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const displayedPhotos = useMemo(() => {
    const isTrashView = currentView === 'trash';
    const isLockedView = currentView === 'locked';
    const isGalleryView = currentView === 'gallery';
    const isFavoritesView = currentView === 'favorites';

    const startDate = activeFilters?.startDate ? new Date(activeFilters.startDate) : null;
    const endDate = activeFilters?.endDate ? new Date(activeFilters.endDate) : null;
    const locationFilter = activeFilters?.location?.toLowerCase() ?? null;
    const queryFilter = activeFilters?.query && !activeFilters?.location && !activeFilters?.startDate
      ? activeFilters.query.toLowerCase()
      : null;

    const result: Photo[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];

      const isLocked = p.isLocked || p.is_locked;
      const isTrash = p.isTrash || p.is_trash;

      if (isTrashView) {
        if (!isTrash) continue;
      } else {
        if (isTrash) continue;
      }

      if (isLockedView) {
        if (!isLocked) continue;
      } else if (isGalleryView) {
        if (isLocked) continue;
      }

      if (isFavoritesView && !(p.isFavorite || p.is_favorite)) continue;

      if (locationFilter && !p.location?.toLowerCase().includes(locationFilter)) continue;
      if (startDate && new Date(p.date) < startDate) continue;
      if (endDate && new Date(p.date) > endDate) continue;
      if (queryFilter) {
        const loc = p.location?.toLowerCase() ?? '';
        const cap = p.caption?.toLowerCase() ?? '';
        const url = p.url.toLowerCase();
        if (!loc.includes(queryFilter) && !cap.includes(queryFilter) && !url.includes(queryFilter)) continue;
      }

      result.push(p);
    }

    if (sortMode === 'newest') {
      return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    if (sortMode === 'oldest') {
      return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    if (sortMode === 'added') {
      return result.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }
    return result;
  }, [currentView, activeFilters, photos, sortMode]);

  const handleScroll = useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          if (scrollTop + clientHeight >= scrollHeight - 500) {
            onFetchPhotos();
          }
        }
        isScrollingRef.current = false;
      });
    }
  }, [onFetchPhotos]);

  const handleNextPhoto = useCallback(() => {
    if (!selectedPhoto) return null;
    const photoList = contextPhotos || displayedPhotos;
    const idx = photoList.findIndex(p => String(p.id) === String(selectedPhoto.id));
    if (idx !== -1 && idx < photoList.length - 1) return photoList[idx + 1];
    return null;
  }, [selectedPhoto, contextPhotos, displayedPhotos]);

  const handlePrevPhoto = useCallback(() => {
    if (!selectedPhoto) return null;
    const photoList = contextPhotos || displayedPhotos;
    const idx = photoList.findIndex(p => String(p.id) === String(selectedPhoto.id));
    if (idx > 0) return photoList[idx - 1];
    return null;
  }, [selectedPhoto, contextPhotos, displayedPhotos]);

  return {
    scrollRef,
    displayedPhotos,
    handleScroll,
    handleNextPhoto,
    handlePrevPhoto,
    contextPhotos,
    setContextPhotos: onSetContextPhotos
  };
}
