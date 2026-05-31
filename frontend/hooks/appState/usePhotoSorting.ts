import { useMemo, useRef } from 'react';
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

  const displayedPhotos = useMemo(() => {
    let result = [...photos];
    if (currentView !== 'locked') result = result.filter(p => !p.isLocked);
    else result = result.filter(p => p.isLocked);

    if (activeFilters) {
      if (activeFilters.location) result = result.filter(p => p.location?.toLowerCase().includes(activeFilters.location!.toLowerCase()));
      if (activeFilters.startDate) result = result.filter(p => new Date(p.date) >= new Date(activeFilters.startDate!));
      if (activeFilters.endDate) result = result.filter(p => new Date(p.date) <= new Date(activeFilters.endDate!));
      if (activeFilters.query && !activeFilters.location && !activeFilters.startDate) {
        const q = activeFilters.query.toLowerCase();
        result = result.filter(p => p.location?.toLowerCase().includes(q) || p.caption?.toLowerCase().includes(q) || p.url.toLowerCase().includes(q));
      }
    }

    if (currentView === 'trash') {
      result = result.filter(p => p.isTrash || p.is_trash);
    } else {
      result = result.filter(p => !(p.isTrash || p.is_trash));
    }

    switch (currentView) {
      case 'favorites':
        result = result.filter(p => (p.isFavorite || p.is_favorite) && !(p.isArchived || p.is_archived));
        break;
      case 'archived':
        result = result.filter(p => p.isArchived || p.is_archived);
        break;
      case 'locked':
        result = result.filter(p => p.isLocked || p.is_locked);
        break;
      case 'photos':
        result = result.filter(p => !(p.isArchived || p.is_archived) && !(p.isLocked || p.is_locked));
        break;
      default:
        break;
    }

    return result.sort((a, b) => {
      if (sortMode === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortMode === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortMode === 'added') return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      return 0;
    });
  }, [currentView, activeFilters, photos, sortMode]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 500) onFetchPhotos();
    }
  };

  const handleNextPhoto = () => {
    if (!selectedPhoto) return;
    const photoList = contextPhotos || displayedPhotos;
    const idx = photoList.findIndex(p => String(p.id) === String(selectedPhoto.id));
    if (idx !== -1 && idx < photoList.length - 1) return photoList[idx + 1];
    return null;
  };

  const handlePrevPhoto = () => {
    if (!selectedPhoto) return;
    const photoList = contextPhotos || displayedPhotos;
    const idx = photoList.findIndex(p => String(p.id) === String(selectedPhoto.id));
    if (idx > 0) return photoList[idx - 1];
    return null;
  };

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
