import React from 'react';
import { Flame, Route, LocateFixed, Pencil, Loader2, HardDriveDownload, Clapperboard } from 'lucide-react';

interface MapToolbarProps {
  canShowRoute: boolean;
  showRoute: boolean;
  showDensity: boolean;
  editMode: boolean;
  saveCount: number;
  timeLapseActive: boolean;
  onToggleRoute: () => void;
  onToggleDensity: () => void;
  onToggleEditMode: () => void;
  onToggleTimeLapse: () => void;
  onZoomToExtents: () => void;
  onOpenOfflineModal?: () => void;
}

/**
 * MapToolbar - Floating architectural command dock for cartography actions.
 */
export const MapToolbar: React.FC<MapToolbarProps> = ({
  canShowRoute,
  showRoute,
  showDensity,
  editMode,
  saveCount,
  timeLapseActive,
  onToggleRoute,
  onToggleDensity,
  onToggleEditMode,
  onToggleTimeLapse,
  onZoomToExtents,
  onOpenOfflineModal,
}) => {
  return (
    <div className="absolute bottom-6 right-6 z-[1000] flex flex-wrap items-center justify-end gap-1.5 p-1.5 rounded-2xl bg-[#1d1b1a]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
      {/* Route Toggle */}
      <button
        type="button"
        onClick={onToggleRoute}
        disabled={!canShowRoute}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
          showRoute
            ? 'bg-[#302d2c] text-white border-white/15 shadow-sm'
            : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
        } ${!canShowRoute ? 'cursor-not-allowed opacity-40' : ''}`}
        title="Toggle chronological travel route polyline"
      >
        <Route size={14} className={showRoute ? 'text-[#e5a93c]' : 'text-zinc-400'} />
        <span>Route</span>
        {showRoute && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] shrink-0" />}
      </button>

      {/* Density Toggle */}
      <button
        type="button"
        onClick={onToggleDensity}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
          showDensity
            ? 'bg-[#302d2c] text-white border-white/15 shadow-sm'
            : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
        }`}
        title="Toggle photo distribution density heatmap"
      >
        <Flame size={14} className={showDensity ? 'text-[#e5a93c]' : 'text-zinc-400'} />
        <span>Density</span>
        {showDensity && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] shrink-0" />}
      </button>

      {/* Edit Mode Toggle */}
      <button
        type="button"
        onClick={onToggleEditMode}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
          editMode
            ? 'bg-amber-500/20 text-amber-200 border-amber-500/30 shadow-sm'
            : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
        }`}
        title="Toggle GPS pin coordinate calibration"
      >
        {saveCount > 0 ? (
          <Loader2 size={14} className="animate-spin text-amber-400" />
        ) : (
          <Pencil size={14} className={editMode ? 'text-amber-400' : 'text-zinc-400'} />
        )}
        <span>{editMode ? 'Editing GPS' : 'Calibrate'}</span>
      </button>

      {/* Time-lapse Toggle */}
      <button
        type="button"
        onClick={onToggleTimeLapse}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
          timeLapseActive
            ? 'bg-[#302d2c] text-white border-white/15 shadow-sm'
            : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
        }`}
        title="Toggle chronological time-lapse replay"
      >
        <Clapperboard size={14} className={timeLapseActive ? 'text-[#e5a93c]' : 'text-zinc-400'} />
        <span>Time-Lapse</span>
        {timeLapseActive && <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] shrink-0" />}
      </button>

      <div className="w-px h-5 bg-white/10 mx-0.5 hidden sm:block" />

      {/* Zoom to Extents */}
      <button
        type="button"
        onClick={onZoomToExtents}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 border border-transparent"
        title="Fit map viewport to all geolocated photo bounds"
      >
        <LocateFixed size={14} className="text-zinc-400" />
        <span>Fit Bounds</span>
      </button>

      {/* Offline Maps Manager */}
      {onOpenOfflineModal && (
        <button
          type="button"
          onClick={onOpenOfflineModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 border border-transparent"
          title="Manage cached map tiles and offline storage"
        >
          <HardDriveDownload size={14} className="text-[#e5a93c]" />
          <span>Offline Maps</span>
        </button>
      )}
    </div>
  );
};
