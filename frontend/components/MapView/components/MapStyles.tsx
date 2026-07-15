import React from 'react';

export const MapStyles: React.FC = () => {
  return (
    <style>{`
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
        appearance: none;
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
      .temporal-slider::-webkit-slider-runnable-track {
        height: 100%;
        background: transparent;
      }
      .temporal-slider::-moz-range-track {
        height: 100%;
        background: transparent;
      }
    `}</style>
  );
};
