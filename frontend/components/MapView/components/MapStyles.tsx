import React from 'react';

/**
 * MapStyles - Renders map styles.
 */
export const MapStyles: React.FC = () => {
  return (
    <style>{`
      .map-tiles-dark .leaflet-tile {
        filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
      }
      .leaflet-popup-content-wrapper {
        background: rgb(var(--color-surface-popover) / 0.95) !important;
        border: 1px solid rgb(var(--color-ink) / 0.1);
        border-radius: 16px !important;
        color: rgb(var(--color-ink)) !important;
        padding: 0 !important;
      }
      .leaflet-popup-content {
        margin: 12px !important;
      }
      .leaflet-popup-tip {
        background: rgb(var(--color-surface-popover) / 0.9) !important;
        border: 1px solid rgb(var(--color-ink) / 0.1);
      }
      .leaflet-container {
        font-family: inherit;
      }
      .temporal-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background: rgb(var(--color-ink) / 0.97);
        border: 2px solid rgb(var(--color-canvas) / 0.85);
        box-shadow: 0 0 0 4px rgb(var(--color-ink) / 0.08);
        cursor: pointer;
      }
      .temporal-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background: rgb(var(--color-ink) / 0.97);
        border: 2px solid rgb(var(--color-canvas) / 0.85);
        box-shadow: 0 0 0 4px rgb(var(--color-ink) / 0.08);
        cursor: pointer;
      }
      .temporal-slider::-webkit-slider-runnable-track,
      .temporal-slider::-moz-range-track {
        height: 100%;
        background: transparent;
      }
    `}</style>
  );
};
