import React, { useState, useEffect, useCallback } from 'react';
import { X, DownloadCloud, Trash2, HardDrive, CheckCircle2, Loader2, MapPin, Globe } from 'lucide-react';
import { API_BASE } from '../../../constants';

interface OfflineMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    hasArea: boolean;
  } | null;
  photoCount: number;
}

interface CacheStats {
  tile_count: number;
  size_bytes: number;
  size_human: string;
}

interface CacheProgress {
  is_downloading: boolean;
  total: usize;
  completed: usize;
  failed: usize;
  provider: string;
  message: string;
}

type usize = number;

/**
 * OfflineMapModal - Modal for managing offline map tiles and pre-downloading.
 */
export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  isOpen,
  onClose,
  bounds,
  photoCount,
}) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  // Fetch cache statistics
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch(`${API_BASE}/api/v1/maps/cache/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load map cache stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Poll progress if downloading
  useEffect(() => {
    if (!isOpen) return;
    fetchStats();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkProgress = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/maps/cache/progress`);
        if (res.ok) {
          const data: CacheProgress = await res.json();
          setProgress(data);
          if (!data.is_downloading && intervalId) {
            // Finished, refresh stats
            fetchStats();
          }
        }
      } catch (e) {
        console.error('Failed to check map download progress:', e);
      }
    };

    checkProgress();
    intervalId = setInterval(checkProgress, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, fetchStats]);

  // Handler: Download for all photos
  const handleDownloadPhotos = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/maps/cache/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_zoom: 2, max_zoom: 12 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'Failed to start download');
      } else {
        setActionSuccess(data.message || 'Download started in background');
      }
    } catch (e: any) {
      setActionError(e.message || 'Network error');
    } finally {
      setIsTriggering(false);
    }
  };

  // Handler: Download visible area
  const handleDownloadArea = async () => {
    if (!bounds) {
      setActionError('Map bounds not available yet.');
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/maps/cache/area`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_lat: bounds.south,
          max_lat: bounds.north,
          min_lng: bounds.west,
          max_lng: bounds.east,
          min_zoom: 4,
          max_zoom: 12,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data || 'Failed to start download');
      } else {
        setActionSuccess(data.message || 'Area download started');
      }
    } catch (e: any) {
      setActionError(e.message || 'Network error');
    } finally {
      setIsTriggering(false);
    }
  };

  // Handler: Clear cache
  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all offline map tiles?')) return;
    setActionError(null);
    setActionSuccess(null);
    setIsTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/maps/cache/clear`, { method: 'POST' });
      if (res.ok) {
        setActionSuccess('Map cache cleared successfully.');
        fetchStats();
      } else {
        setActionError('Failed to clear cache');
      }
    } catch (e: any) {
      setActionError(e.message || 'Network error');
    } finally {
      setIsTriggering(false);
    }
  };

  if (!isOpen) return null;

  const isDownloading = progress?.is_downloading ?? false;
  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#1d1b1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5a93c] flex items-center gap-1.5 font-medium">
              <Globe size={11} className="text-[#e5a93c]" />
              Offline Cartography
            </div>
            <h3 className="text-base font-serif text-white font-medium mt-0.5">Tile Cache & Storage</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Storage Stats Card */}
          <div className="bg-[#151312] border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#e5a93c]/10 text-[#e5a93c]">
                <HardDrive size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Local Disk Cache</p>
                <p className="text-base font-mono font-bold text-white">
                  {loadingStats ? 'Checking...' : stats?.size_human || '0.0 MB'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Cached Tiles</p>
              <p className="text-base font-mono font-bold text-zinc-200">
                {loadingStats ? '...' : (stats?.tile_count ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Active Download Progress */}
          {isDownloading && progress && (
            <div className="bg-[#e5a93c]/10 border border-[#e5a93c]/25 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-2 text-[#e5a93c]">
                  <Loader2 size={14} className="animate-spin" />
                  Caching Map Tiles...
                </span>
                <span className="font-mono font-bold text-[#e5a93c]">{percent}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#e5a93c] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-zinc-400 text-center">
                {progress.completed} of {progress.total} tiles cached
                {progress.failed > 0 ? ` (${progress.failed} skipped)` : ''}
              </p>
            </div>
          )}

          {/* Status feedback alerts */}
          {actionSuccess && !isDownloading && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs">
              {actionError}
            </div>
          )}

          {/* Description */}
          <p className="text-xs text-zinc-400 leading-relaxed">
            All map tiles viewed during browsing are stored locally in Prism's air-gapped cache. Pre-downloading ensures full cartographic fidelity without internet access.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleDownloadPhotos}
              disabled={isDownloading || isTriggering || photoCount === 0}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#e5a93c] text-black font-semibold text-xs transition hover:bg-[#f3ba57] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e5a93c]/10"
            >
              <MapPin size={15} />
              <span>Download Area for All Photos ({photoCount} geotagged)</span>
            </button>

            <button
              onClick={handleDownloadArea}
              disabled={isDownloading || isTriggering || !bounds}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white/5 text-white font-medium text-xs border border-white/10 transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadCloud size={15} />
              <span>Download Current Visible Area</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#151312] border-t border-white/10 flex items-center justify-between">
          <button
            onClick={handleClearCache}
            disabled={isDownloading || isTriggering || (stats?.tile_count ?? 0) === 0}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 transition font-medium"
          >
            <Trash2 size={13} />
            <span>Clear Map Cache</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 hover:text-white transition border border-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
