import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Photo } from '../../../types';
import { resolveUrl } from '../../../constants';
import { useMap } from 'react-leaflet';

interface PhotoMarkersProps {
  geoPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  editMode?: boolean;
  savingPhotoIds?: Set<string>;
  onPhotoLocationChange?: (photo: Photo, coords: { latitude: number; longitude: number }) => Promise<void>;
}

function formatPopupLocation(photo: Photo, editMode: boolean, isSaving: boolean) {
  if (isSaving) return 'Saving location...';
  if (editMode) return 'Drag to update this photo location';
  return photo.location || photo.filename || '';
}

export const PhotoMarkers: React.FC<PhotoMarkersProps> = ({
  geoPhotos,
  onPhotoClick,
  editMode = false,
  savingPhotoIds,
  onPhotoLocationChange,
}) => {
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
      const originalLat = Number(photo.latitude);
      const originalLng = Number(photo.longitude);
      const isSaving = savingPhotoIds?.has(String(photo.id)) ?? false;
      const thumbUrl = resolveUrl(`/api/v1/photos/${photo.id}/thumbnail?size=96`);
      const marker = L.marker([originalLat, originalLng], {
        draggable: editMode && !isSaving,
        icon: L.divIcon({
          className: 'custom-photo-marker',
          html: `
            <div class="relative w-10 h-10 rounded-lg border-2 ${editMode ? 'border-amber-300' : 'border-white'} shadow-xl overflow-hidden transform-gpu bg-surface">
              <img src="${thumbUrl}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        }),
      });

      // Use thumbnail for popup preview (not full-size) — avoids loading heavy images
      const popupThumbUrl = resolveUrl(`/api/v1/photos/${photo.id}/thumbnail?size=400`);
      marker.bindPopup(
        `<div class="w-48 cursor-pointer" data-photo-id="${photo.id}">
          <div class="relative aspect-square rounded-lg overflow-hidden mb-2">
            <img src="${popupThumbUrl}" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="px-1">
            <p class="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1">
              ${new Date(photo.date).toLocaleDateString()}
            </p>
            <p class="text-sm font-medium text-white truncate">
              ${formatPopupLocation(photo, editMode, isSaving)}
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

      if (editMode && onPhotoLocationChange) {
        marker.on('dragend', async () => {
          const nextLatLng = marker.getLatLng();
          try {
            await onPhotoLocationChange(photo, {
              latitude: nextLatLng.lat,
              longitude: nextLatLng.lng,
            });
          } catch (error) {
            console.error('Failed to update photo location', error);
            marker.setLatLng([originalLat, originalLng]);
          }
        });
      }

      group.addLayer(marker);
    });

    map.addLayer(group);
    groupRef.current = group;

    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [editMode, geoPhotos, map, onPhotoClick, onPhotoLocationChange, savingPhotoIds]);

  return null;
};
