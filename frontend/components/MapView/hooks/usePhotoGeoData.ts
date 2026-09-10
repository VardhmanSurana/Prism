import { useMemo } from 'react';
import { Photo } from '../../../types';

/**
 * usePhotoGeoData - Hook managing photo geo data state.
 */
export const usePhotoGeoData = (photos: Photo[]) => {
  return useMemo(() => {
    const geoPhotos: Photo[] = [];
    let sumLat = 0;
    let sumLng = 0;
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const p of photos) {
      if (p.latitude != null && p.longitude != null) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          geoPhotos.push(p);
          sumLat += lat;
          sumLng += lng;
          if (lat > north) north = lat;
          if (lat < south) south = lat;
          if (lng > east) east = lng;
          if (lng < west) west = lng;
        }
      }
    }

    if (geoPhotos.length === 0) {
      return {
        geoPhotos: [],
        center: [20, 0] as [number, number],
        timelinePhotos: [],
        bounds: null,
      };
    }

    const center: [number, number] = [sumLat / geoPhotos.length, sumLng / geoPhotos.length];
    const bounds = {
      north,
      south,
      east,
      west,
      hasArea: north !== south || east !== west,
    };
    const timelinePhotos = [...geoPhotos].sort((a, b) => {
      const left = Date.parse(a.date || a.date_taken || '') || 0;
      const right = Date.parse(b.date || b.date_taken || '') || 0;
      return left - right;
    });

    return { geoPhotos, center, timelinePhotos, bounds };
  }, [photos]);
};
