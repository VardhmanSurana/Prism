import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Photo } from '../../types';

export function usePhotoSelection(photos: Photo[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPhotoOverride, setSelectedPhotoOverride] = useState<Photo | null>(null);

  const photoId = searchParams.get('photo');

  const selectedPhoto = useMemo(() => {
    if (!photoId) return null;
    if (selectedPhotoOverride && String(selectedPhotoOverride.id) === String(photoId)) {
      return selectedPhotoOverride;
    }
    return photos.find(p => String(p.id) === String(photoId)) || null;
  }, [photoId, photos, selectedPhotoOverride]);

  const setSelectedPhoto = useCallback((photo: Photo | null, onClearContext?: () => void) => {
    setSelectedPhotoOverride(photo);
    if (photo) {
      setSearchParams({ photo: String(photo.id) });
    } else {
      setSearchParams({});
      onClearContext?.();
    }
  }, [setSearchParams]);

  return {
    selectedPhoto,
    setSelectedPhoto
  };
}
