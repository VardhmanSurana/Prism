import React, { useMemo } from 'react';
import { CircleMarker, Polyline, Popup } from 'react-leaflet';
import { Photo } from '../../../types';

interface TravelRouteLayerProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

function formatTimelineLabel(photo: Photo) {
  const rawDate = photo.date || photo.date_taken || '';
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return photo.location || photo.filename || 'Unknown stop';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const TravelRouteLayer: React.FC<TravelRouteLayerProps> = ({ photos, onPhotoClick }) => {
  const routePoints = useMemo(() => {
    return photos.map((photo) => [Number(photo.latitude), Number(photo.longitude)] as [number, number]);
  }, [photos]);

  if (routePoints.length < 2) {
    return null;
  }

  const firstPhoto = photos[0];
  const lastPhoto = photos[photos.length - 1];

  return (
    <>
      <Polyline
        positions={routePoints}
        pathOptions={{
          color: '#d2ff72',
          weight: 3,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '10 8',
        }}
      />

      <CircleMarker
        center={[Number(firstPhoto.latitude), Number(firstPhoto.longitude)]}
        radius={8}
        pathOptions={{ color: '#d2ff72', fillColor: '#d2ff72', fillOpacity: 1, weight: 2 }}
      >
        <Popup>
          <button type="button" className="text-left" onClick={() => onPhotoClick(firstPhoto)}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-lime-300">Start</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {firstPhoto.location || firstPhoto.filename || 'First stop'}
            </div>
            <div className="mt-1 text-xs text-gray-300">{formatTimelineLabel(firstPhoto)}</div>
          </button>
        </Popup>
      </CircleMarker>

      <CircleMarker
        center={[Number(lastPhoto.latitude), Number(lastPhoto.longitude)]}
        radius={8}
        pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
      >
        <Popup>
          <button type="button" className="text-left" onClick={() => onPhotoClick(lastPhoto)}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-200">Latest</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {lastPhoto.location || lastPhoto.filename || 'Latest stop'}
            </div>
            <div className="mt-1 text-xs text-gray-300">{formatTimelineLabel(lastPhoto)}</div>
          </button>
        </Popup>
      </CircleMarker>
    </>
  );
};
