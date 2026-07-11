import { useMemo } from 'react';
import { Photo } from '../../../types';

export const usePhotoGeoData = (photos: Photo[]) => {
  // Filter photos with valid GPS data — memoized to avoid re-filtering on every render
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

  const timelinePhotos = useMemo(() => {
    return [...geoPhotos].sort((a, b) => {
      const left = Date.parse(a.date || a.date_taken || '') || 0;
      const right = Date.parse(b.date || b.date_taken || '') || 0;
      return left - right;
    });
  }, [geoPhotos]);

  const bounds = useMemo(() => {
    if (geoPhotos.length === 0) return null;

    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const photo of geoPhotos) {
      const lat = Number(photo.latitude);
      const lng = Number(photo.longitude);
      north = Math.max(north, lat);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      west = Math.min(west, lng);
    }

    return {
      north,
      south,
      east,
      west,
      hasArea: north !== south || east !== west,
    };
  }, [geoPhotos]);

  return { geoPhotos, center, timelinePhotos, bounds };
};

/**
 * Filter geo photos by viewport bounds for performance.
 * Call from a component that has access to the map instance.
 * Usage: const visiblePhotos = filterByViewport(geoPhotos, map.getBounds());
 */
export const filterByViewport = (
  photos: Photo[],
  bounds: { getNorth(): number; getSouth(): number; getEast(): number; getWest(): number }
): Photo[] => {
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  return photos.filter(p => {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    return lat >= south && lat <= north && lng >= west && lng <= east;
  });
};
