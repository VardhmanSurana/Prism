import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Photo } from '../../types';

import { useMapStyle } from './hooks/useMapStyle';
import { usePhotoGeoData } from './hooks/usePhotoGeoData';
import { PhotoMarkers } from './components/PhotoMarkers';
import { MapStyleSelector } from './components/MapStyleSelector';
import { MapOverlay } from './components/MapOverlay';
import { MapStyles } from './components/MapStyles';

interface MapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

interface ChangeMapViewProps {
  center: [number, number];
  zoom: number;
}

const ChangeMapView: React.FC<ChangeMapViewProps> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ photos, onPhotoClick }) => {
  const { selectedStyleId, currentStyle, handleStyleChange } = useMapStyle();
  const { geoPhotos, center } = usePhotoGeoData(photos);
  const zoom = geoPhotos.length > 0 ? 4 : 2;

  return (
    <div className="w-full h-full relative bg-[#0a0a0a]">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ width: '100%', height: '100%', background: '#0a0a0a' }}
        zoomControl={false}
      >
        <ChangeMapView center={center} zoom={zoom} />
        <TileLayer
          key={selectedStyleId}
          attribution={currentStyle.attribution}
          url={currentStyle.url}
        />
        <PhotoMarkers geoPhotos={geoPhotos} onPhotoClick={onPhotoClick} />
      </MapContainer>

      <MapOverlay geoPhotoCount={geoPhotos.length} />
      <MapStyleSelector 
        selectedStyleId={selectedStyleId} 
        onStyleChange={handleStyleChange} 
      />
      <MapStyles />
    </div>
  );
};
