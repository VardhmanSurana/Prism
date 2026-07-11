import React from 'react';
import { Flame, Route, LocateFixed, Pencil, Loader2 } from 'lucide-react';

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
}

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
}) => {
  return (
    <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3">
      <button
        type="button"
        onClick={onZoomToExtents}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-xs font-semibold text-white shadow-2xl transition hover:border-white/20 hover:bg-white/10"
      >
        <LocateFixed size={14} />
        Zoom to extents
      </button>

      <button
        type="button"
        onClick={onToggleTimeLapse}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition ${
          timeLapseActive
            ? 'border-lime-300/80 bg-lime-200/90 text-black'
            : 'border-white/10 bg-surface text-white hover:border-white/20 hover:bg-white/10'
        }`}
      >
        Time-lapse
      </button>

      <button
        type="button"
        onClick={onToggleEditMode}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition ${
          editMode
            ? 'border-amber-300/80 bg-amber-200/90 text-black'
            : 'border-white/10 bg-surface text-white hover:border-white/20 hover:bg-white/10'
        }`}
      >
        {saveCount > 0 ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
        {editMode ? 'Exit location edit' : 'Edit locations'}
      </button>

      <button
        type="button"
        onClick={onToggleDensity}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition ${
          showDensity
            ? 'border-sky-300/70 bg-sky-200/90 text-black'
            : 'border-white/10 bg-surface text-white hover:border-white/20 hover:bg-white/10'
        }`}
      >
        <Flame size={14} />
        {showDensity ? 'Hide density' : 'Show density'}
      </button>

      <button
        type="button"
        onClick={onToggleRoute}
        disabled={!canShowRoute}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition ${
          showRoute
            ? 'border-primary bg-primary text-black'
            : 'border-white/10 bg-surface text-white hover:border-white/20 hover:bg-white/10'
        } ${!canShowRoute ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <Route size={14} />
        {showRoute ? 'Hide route' : 'Show route'}
      </button>
    </div>
  );
};
