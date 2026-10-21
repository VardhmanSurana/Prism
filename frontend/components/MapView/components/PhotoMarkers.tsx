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

/**
 * formatPopupLocation - Formats format popup location.
 */
function formatPopupLocation(photo: Photo, editMode: boolean, isSaving: boolean) {
  if (isSaving) return 'Saving location...';
  if (editMode) return 'Drag to update this photo location';
  return photo.location || photo.filename || '';
}

/**
 * PhotoMarkers - Renders photo markers.
 */
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
          html: `<div class="w-10 h-10 rounded-full bg-[#1d1b1a]/95 border-2 border-[#e5a93c] flex items-center justify-center text-[#f5f0ed] text-xs font-mono font-bold shadow-xl shadow-black/60">${count}</div>`,
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
            <div class="relative w-10 h-10 rounded-xl border-2 ${editMode ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/80'} shadow-2xl overflow-hidden transform-gpu bg-[#151312] transition-transform duration-200">
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
      const dateStr = photo.date ? new Date(photo.date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
      const geoDetail = [photo.city, photo.country].filter(Boolean).join(', ');

      marker.bindPopup(
        `<div class="w-52 cursor-pointer p-0.5" data-photo-id="${photo.id}">
          <div class="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 bg-[#151312] border border-white/10">
            <img src="${popupThumbUrl}" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="px-1 pb-1">
            <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-0.5">
              <span>${dateStr}</span>
              ${photo.isFavorite ? '<span class="text-[#e5a93c]">★</span>' : ''}
            </div>
            <p class="text-sm font-serif font-medium text-white truncate">
              ${formatPopupLocation(photo, editMode, isSaving)}
            </p>
            ${geoDetail ? `<p class="text-[11px] font-mono text-zinc-400 truncate mt-0.5">${geoDetail}</p>` : ''}
          </div>
        </div>`,
        { maxWidth: 220 }
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
