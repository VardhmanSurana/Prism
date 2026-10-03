import React from 'react';

/**
 * MapStyles - Renders map styles.
 */
export const MapStyles: React.FC = () => {
  return (
    <style>{`
      .map-tiles-dark .leaflet-tile {
        filter: brightness(0.65) invert(1) contrast(2.6) hue-rotate(195deg) saturate(0.2) brightness(0.75);
      }
      .leaflet-popup-content-wrapper {
        background: #1d1b1a !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 18px !important;
        color: #f5f0ed !important;
        padding: 0 !important;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05) !important;
      }
      .leaflet-popup-content {
        margin: 12px !important;
      }
      .leaflet-popup-tip {
        background: #1d1b1a !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: none !important;
      }
      .leaflet-popup-close-button {
        color: #a1a1aa !important;
        padding: 8px 8px 0 0 !important;
      }
      .leaflet-popup-close-button:hover {
        color: #ffffff !important;
      }
      .leaflet-container {
        font-family: inherit;
        background: #151312 !important;
      }
      .custom-cluster-icon > div {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      }
      .custom-cluster-icon:hover > div {
        transform: scale(1.08);
        box-shadow: 0 0 20px rgba(229, 169, 60, 0.4);
      }
      .temporal-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background: #e5a93c;
        border: 2px solid #151312;
        box-shadow: 0 0 10px rgba(229, 169, 60, 0.45);
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .temporal-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 0 16px rgba(229, 169, 60, 0.65);
      }
      .temporal-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background: #e5a93c;
        border: 2px solid #151312;
        box-shadow: 0 0 10px rgba(229, 169, 60, 0.45);
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .temporal-slider::-moz-range-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 0 16px rgba(229, 169, 60, 0.65);
      }
      .temporal-slider::-webkit-slider-runnable-track,
      .temporal-slider::-moz-range-track {
        height: 100%;
        background: transparent;
      }
    `}</style>
  );
};
