import L from 'leaflet';
import { Photo } from '../../../types';
import { resolveUrl } from '../../../constants';

export const createPhotoIcon = (photo: Photo) => {
  return L.divIcon({
    className: 'custom-photo-marker',
    html: `
      <div class="relative w-12 h-12 rounded-lg border-2 border-white shadow-xl overflow-hidden transform hover:scale-110 transition-transform duration-200 bg-surface">
        <img src="${resolveUrl(photo.url)}" class="w-full h-full object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
  });
};
