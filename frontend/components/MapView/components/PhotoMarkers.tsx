import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Photo } from '../../../types';
import { resolveUrl } from '../../../constants';
import { createPhotoIcon } from '../utils/icon';

interface PhotoMarkersProps {
  geoPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

export const PhotoMarkers: React.FC<PhotoMarkersProps> = ({ geoPhotos, onPhotoClick }) => {
  return (
    <>
      {geoPhotos.map(photo => (
        <Marker 
          key={photo.id} 
          position={[photo.latitude!, photo.longitude!]}
          icon={createPhotoIcon(photo)}
        >
          <Popup className="photo-popup">
            <div 
              className="w-48 group cursor-pointer"
              onClick={() => onPhotoClick(photo)}
            >
              <div className="relative aspect-square rounded-lg overflow-hidden mb-2">
                <img src={resolveUrl(photo.url)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="px-1">
                <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1">
                  {new Date(photo.date).toLocaleDateString()}
                </p>
                <p className="text-sm font-medium text-white truncate">
                  {photo.location || photo.filename}
                </p>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};
