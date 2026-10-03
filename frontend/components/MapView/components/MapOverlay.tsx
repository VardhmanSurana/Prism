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

/**
 * formatRouteDate - Formats format route date.
 */
function formatRouteDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

/**
 * MapOverlay - Renders map overlay.
 */
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
      <div className="max-w-[320px] sm:max-w-[340px] bg-[#1d1b1a]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl transition-all duration-300 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c] flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] animate-pulse" />
            Prism Cartography
          </div>
          <div className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
            Offline Ready
          </div>
        </div>

        <h2 className="text-xl font-serif text-white tracking-tight">Spatial Archive</h2>
        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 font-medium">
          <span className="text-[#f5f0ed] font-semibold">{geoPhotoCount}</span>
          <span>geolocated moments</span>
          {totalGeoPhotoCount > geoPhotoCount && (
            <span className="text-zinc-500 font-mono text-[11px]">({totalGeoPhotoCount} total)</span>
          )}
        </div>

        {temporalFilterActive && (
          <div className="mt-3 flex items-start gap-2 bg-[#e5a93c]/10 border border-[#e5a93c]/20 px-2.5 py-1.5 rounded-xl font-mono text-[11px] text-amber-200/90 leading-relaxed">
            <span className="text-[#e5a93c] font-bold">◷</span>
            <span>Filter active: {geoPhotoCount} of {totalGeoPhotoCount} visible</span>
          </div>
        )}

        {timeLapseActive && timeLapseDateLabel && (
          <div className="mt-2.5 flex items-start gap-2 bg-[#e5a93c]/15 border border-[#e5a93c]/30 px-2.5 py-1.5 rounded-xl font-mono text-[11px] text-amber-100 leading-relaxed">
            <span className="text-[#e5a93c] font-bold">▶</span>
            <span>Replay at {timeLapseDateLabel}</span>
          </div>
        )}

        {densityEnabled && (
          <div className="mt-2.5 flex items-start gap-2 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl font-mono text-[11px] text-zinc-300 leading-relaxed">
            <span className="text-[#e5a93c] font-bold">◈</span>
            <span>Density heatmap reveals shoot distribution</span>
          </div>
        )}

        {editMode && (
          <div className="mt-2.5 flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 rounded-xl font-mono text-[11px] text-amber-200 leading-relaxed">
            <span className="text-amber-400 font-bold">✎</span>
            <span>Drag pins to calibrate GPS.{saveCount > 0 ? ` Saving ${saveCount}...` : ''}</span>
          </div>
        )}

        {routeEnabled && routePhotoCount > 1 && (
          <div className="mt-3.5 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c]">
              <span>Journey Route</span>
              <span className="text-zinc-500 font-mono">{routePhotoCount} stops</span>
            </div>
            <div className="mt-1.5 text-xs text-[#f5f0ed] leading-snug font-medium truncate">
              {firstRoutePhoto?.location || firstRoutePhoto?.city || firstRoutePhoto?.filename || 'Origin'}
              <span className="text-[#e5a93c] mx-1.5 font-mono">→</span>
              {lastRoutePhoto?.location || lastRoutePhoto?.city || lastRoutePhoto?.filename || 'Destination'}
            </div>
            <div className="mt-1 text-[11px] font-mono text-zinc-400">
              {formatRouteDate(firstRoutePhoto?.date || firstRoutePhoto?.date_taken)} – {formatRouteDate(lastRoutePhoto?.date || lastRoutePhoto?.date_taken)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
