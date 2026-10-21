import React, { useMemo } from 'react';
import { CircleMarker, Polyline, Popup } from 'react-leaflet';
import { Photo } from '../../../types';

interface TravelRouteLayerProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

/**
 * formatTimelineLabel - Formats format timeline label.
 */
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

/**
 * TravelRouteLayer - Renders travel route layer.
 */
export const TravelRouteLayer: React.FC<TravelRouteLayerProps> = ({ photos, onPhotoClick }) => {
  /**
   * routePoints - Performs route points.
   */
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
          color: '#e5a93c',
          weight: 3,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '8 8',
        }}
      />

      <CircleMarker
        center={[Number(firstPhoto.latitude), Number(firstPhoto.longitude)]}
        radius={7}
        pathOptions={{ color: '#151312', fillColor: '#e5a93c', fillOpacity: 1, weight: 2 }}
      >
        <Popup>
          <button type="button" className="text-left w-full cursor-pointer" onClick={() => onPhotoClick(firstPhoto)}>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c] font-medium">Journey Origin</div>
            <div className="mt-1 text-sm font-serif font-medium text-white truncate">
              {firstPhoto.location || firstPhoto.city || firstPhoto.filename || 'First stop'}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-zinc-400">{formatTimelineLabel(firstPhoto)}</div>
          </button>
        </Popup>
      </CircleMarker>

      <CircleMarker
        center={[Number(lastPhoto.latitude), Number(lastPhoto.longitude)]}
        radius={7}
        pathOptions={{ color: '#151312', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
      >
        <Popup>
          <button type="button" className="text-left w-full cursor-pointer" onClick={() => onPhotoClick(lastPhoto)}>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-300 font-medium">Latest Destination</div>
            <div className="mt-1 text-sm font-serif font-medium text-white truncate">
              {lastPhoto.location || lastPhoto.city || lastPhoto.filename || 'Latest stop'}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-zinc-400">{formatTimelineLabel(lastPhoto)}</div>
          </button>
        </Popup>
      </CircleMarker>
    </>
  );
};
