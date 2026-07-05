import React from 'react';

interface MapOverlayProps {
  geoPhotoCount: number;
}

export const MapOverlay: React.FC<MapOverlayProps> = ({ geoPhotoCount }) => {
  return (
    <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
      <div className="bg-surface border border-white/10 p-4 rounded-2xl shadow-2xl">
        <h2 className="text-xl font-serif italic text-white mb-1">World View</h2>
        <p className="text-xs text-gray-500 font-medium">
          {geoPhotoCount} Geolocated moments captured
        </p>
      </div>
    </div>
  );
};
