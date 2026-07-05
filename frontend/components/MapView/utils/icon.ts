import L from 'leaflet';
import { Photo } from '../../../types';
import { resolveUrl } from '../../../constants';

export const createPhotoIcon = (photo: Photo) => {
  const thumbUrl = resolveUrl(`/api/v1/photos/${photo.id}/thumbnail?size=96`);
  return L.divIcon({
    className: 'custom-photo-marker',
    html: `
      <div class="relative w-10 h-10 rounded-lg border-2 border-white shadow-xl overflow-hidden transform-gpu bg-surface">
        <img src="${thumbUrl}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};
