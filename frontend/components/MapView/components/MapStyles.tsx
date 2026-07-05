import React from 'react';

export const MapStyles: React.FC = () => {
  return (
    <style>{`
      .leaflet-popup-content-wrapper {
        background: rgba(26, 26, 26, 0.95) !important;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px !important;
        color: white !important;
        padding: 0 !important;
      }
      .leaflet-popup-content {
        margin: 12px !important;
      }
      .leaflet-popup-tip {
        background: rgba(26, 26, 26, 0.9) !important;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .leaflet-container {
        font-family: inherit;
      }
    `}</style>
  );
};
