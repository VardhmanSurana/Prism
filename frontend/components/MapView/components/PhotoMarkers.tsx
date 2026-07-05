import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Photo } from '../../../types';
import { resolveUrl } from '../../../constants';
import { useMap } from 'react-leaflet';

interface PhotoMarkersProps {
  geoPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

export const PhotoMarkers: React.FC<PhotoMarkersProps> = ({ geoPhotos, onPhotoClick }) => {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: function (cluster: any) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="w-10 h-10 rounded-full bg-primary/80 border-2 border-primary flex items-center justify-center text-black text-xs font-bold shadow-lg">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [40, 40],
        });
      },
    });

    geoPhotos.forEach((photo) => {
      const thumbUrl = resolveUrl(`/api/v1/photos/${photo.id}/thumbnail?size=96`);
      const marker = L.marker([photo.latitude!, photo.longitude!], {
        icon: L.divIcon({
          className: 'custom-photo-marker',
          html: `
            <div class="relative w-10 h-10 rounded-lg border-2 border-white shadow-xl overflow-hidden transform-gpu bg-surface">
              <img src="${thumbUrl}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        }),
      });

      const fullUrl = resolveUrl(photo.url);
      const safePhoto = {
        id: photo.id,
        date: photo.date,
        location: photo.location,
        filename: photo.filename,
      };
      marker.bindPopup(
        `<div class="w-48 cursor-pointer" data-photo-id="${photo.id}">
          <div class="relative aspect-square rounded-lg overflow-hidden mb-2">
            <img src="${fullUrl}" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="px-1">
            <p class="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1">
              ${new Date(photo.date).toLocaleDateString()}
            </p>
            <p class="text-sm font-medium text-white truncate">
              ${photo.location || photo.filename || ''}
            </p>
          </div>
        </div>`,
        { maxWidth: 200 }
      );

      marker.on('popupopen', () => {
        const popupEl = marker.getPopup()?.getElement();
        if (!popupEl) return;
        const card = popupEl.querySelector('[data-photo-id]');
        if (card) {
          card.addEventListener('click', () => onPhotoClick(photo));
        }
      });

      group.addLayer(marker);
    });

    map.addLayer(group);
    groupRef.current = group;

    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [geoPhotos, onPhotoClick, map]);

  return null;
};
