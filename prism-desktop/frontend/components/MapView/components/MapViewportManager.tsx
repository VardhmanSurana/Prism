import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface BoundsLike {
  north: number;
  south: number;
  east: number;
  west: number;
  hasArea: boolean;
}

interface MapViewportManagerProps {
  bounds: BoundsLike | null;
  center: [number, number];
  emptyZoom: number;
}

export const MapViewportManager: React.FC<MapViewportManagerProps> = ({ bounds, center, emptyZoom }) => {
  const map = useMap();
  const lastSignature = useRef<string>('');

  useEffect(() => {
    if (!bounds) {
      map.setView(center, emptyZoom, { animate: false });
      lastSignature.current = `empty:${center[0]}:${center[1]}:${emptyZoom}`;
      return;
    }

    const signature = `${bounds.south}:${bounds.west}:${bounds.north}:${bounds.east}`;
    if (lastSignature.current === signature) {
      return;
    }

    lastSignature.current = signature;

    if (bounds.hasArea) {
      map.fitBounds(
        L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ),
        { padding: [48, 48], animate: false }
      );
      return;
    }

    map.setView(center, 11, { animate: false });
  }, [bounds, center, emptyZoom, map]);

  return null;
};
