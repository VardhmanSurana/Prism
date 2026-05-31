import { useMemo } from 'react';
import { Photo } from '../../../types';

export const usePhotoGeoData = (photos: Photo[]) => {
  // Filter photos with valid GPS data
  const geoPhotos = useMemo(() => {
    return photos.filter(p => 
      p.latitude !== undefined && p.latitude !== null && !isNaN(Number(p.latitude)) &&
      p.longitude !== undefined && p.longitude !== null && !isNaN(Number(p.longitude))
    );
  }, [photos]);

  // Default center (or center of all photos)
  const center = useMemo(() => {
    if (geoPhotos.length === 0) return [20, 0] as [number, number];
    const lat = geoPhotos.reduce((sum, p) => sum + Number(p.latitude || 0), 0) / geoPhotos.length;
    const lng = geoPhotos.reduce((sum, p) => sum + Number(p.longitude || 0), 0) / geoPhotos.length;
    return [lat, lng] as [number, number];
  }, [geoPhotos]);

  return { geoPhotos, center };
};
