import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Photo, RawPhoto, normalizePhoto } from '../../types';
import { apiClient } from '@/services/apiClient';

export function usePhotoSelection(photos: Photo[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPhotoOverride, setSelectedPhotoOverride] = useState<Photo | null>(null);

  const photoKey = searchParams.get('photo');

  // Fallback: If photoKey is specified in the URL (e.g. browser reload in lightbox/editor)
  // but photos array hasn't loaded yet or does not include this photo, fetch it directly.
  useEffect(() => {
    if (!photoKey) {
      setSelectedPhotoOverride(null);
      return;
    }

    const foundInPhotos = photos.some(
      p => (p.uuid && String(p.uuid) === String(photoKey)) || String(p.id) === String(photoKey)
    );
    if (foundInPhotos) return;

    if (
      selectedPhotoOverride &&
      ((selectedPhotoOverride.uuid && String(selectedPhotoOverride.uuid) === String(photoKey)) ||
        String(selectedPhotoOverride.id) === String(photoKey))
    ) {
      return;
    }

    let active = true;
    apiClient
      .get<RawPhoto>(`/api/v1/photos/${photoKey}`)
      .then(raw => {
        if (active && raw) {
          setSelectedPhotoOverride(normalizePhoto(raw));
        }
      })
      .catch(err => {
        console.warn(`[usePhotoSelection] Failed to fetch photo ${photoKey}:`, err);
      });

    return () => {
      active = false;
    };
  }, [photoKey, photos, selectedPhotoOverride]);

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
