import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Photo } from '../../types';

export function usePhotoSelection(photos: Photo[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPhotoOverride, setSelectedPhotoOverride] = useState<Photo | null>(null);

  const photoKey = searchParams.get('photo');

  const selectedPhoto = useMemo(() => {
    if (!photoKey) return null;
    if (
      selectedPhotoOverride &&
      (String(selectedPhotoOverride.uuid) === String(photoKey) || String(selectedPhotoOverride.id) === String(photoKey))
    ) {
      return selectedPhotoOverride;
    }
    return (
      photos.find(p => (p.uuid && String(p.uuid) === String(photoKey)) || String(p.id) === String(photoKey)) || null
    );
  }, [photoKey, photos, selectedPhotoOverride]);

  const setSelectedPhoto = useCallback((photo: Photo | null, onClearContext?: () => void) => {
    setSelectedPhotoOverride(photo);
    if (photo) {
      const key = photo.uuid || photo.id;
      setSearchParams({ photo: String(key) });
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
