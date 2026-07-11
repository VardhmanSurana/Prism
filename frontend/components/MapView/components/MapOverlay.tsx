import React from 'react';
import { Photo } from '../../../types';

interface MapOverlayProps {
  geoPhotoCount: number;
  totalGeoPhotoCount: number;
  routeEnabled: boolean;
  densityEnabled: boolean;
  editMode: boolean;
  saveCount: number;
  temporalFilterActive: boolean;
  timeLapseActive: boolean;
  timeLapseDateLabel?: string | null;
  routePhotoCount: number;
  firstRoutePhoto?: Photo;
  lastRoutePhoto?: Photo;
}

function formatRouteDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export const MapOverlay: React.FC<MapOverlayProps> = ({
  geoPhotoCount,
  totalGeoPhotoCount,
  routeEnabled,
  densityEnabled,
  editMode,
  saveCount,
  temporalFilterActive,
  timeLapseActive,
  timeLapseDateLabel,
  routePhotoCount,
  firstRoutePhoto,
  lastRoutePhoto,
}) => {
  return (
    <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
      <div className="max-w-[320px] bg-surface border border-white/10 p-4 rounded-2xl shadow-2xl">
        <h2 className="text-xl font-serif italic text-white mb-1">World View</h2>
        <p className="text-xs text-gray-500 font-medium">
          {geoPhotoCount} Geolocated moments captured
        </p>
        {temporalFilterActive && (
          <p className="mt-3 text-xs text-sky-200/80">
            Timeline filter active. {geoPhotoCount} of {totalGeoPhotoCount} mapped photos remain visible.
          </p>
        )}
        {timeLapseActive && timeLapseDateLabel && (
          <p className="mt-3 text-xs text-lime-200/85">
            Time-lapse replay at {timeLapseDateLabel}.
          </p>
        )}
        {densityEnabled && (
          <p className="mt-3 text-xs text-sky-200/80">
            Density mode reveals repeated shooting hotspots without depending on cluster expansion.
          </p>
        )}
        {editMode && (
          <p className="mt-3 text-xs text-amber-200/85">
            Drag markers to correct GPS data.{saveCount > 0 ? ` Saving ${saveCount} change${saveCount === 1 ? '' : 's'}...` : ''}
          </p>
        )}
        {routeEnabled && routePhotoCount > 1 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-lime-300/90">
              Journey timeline
            </div>
            <p className="mt-2 text-sm text-white">
              {routePhotoCount} stops connected from {formatRouteDate(firstRoutePhoto?.date || firstRoutePhoto?.date_taken)} to{' '}
              {formatRouteDate(lastRoutePhoto?.date || lastRoutePhoto?.date_taken)}.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {firstRoutePhoto?.location || firstRoutePhoto?.filename || 'First stop'} to{' '}
              {lastRoutePhoto?.location || lastRoutePhoto?.filename || 'latest stop'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
