import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../../constants';

export interface WatcherStatus {
  is_scanning: boolean;
  auto_enabled: boolean;
  total_imported: number;
  last_scan_imported: number;
  last_scan_skipped: number;
  last_scan_failed: number;
  last_scan_manual: boolean;
  last_scan_started_ms: number;
  last_scan_finished_ms: number;
}

const WATCHER_POLL_MS = 3000;

/**
 * useSyncConfig - Hook managing sync config.
 */
export const useSyncConfig = () => {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null);
  const [isRescanQueued, setIsRescanQueued] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSyncConfig();
  }, []);

  // Poll watcher status periodically so the indicator stays live.
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/settings/watcher-status`);
        if (res.ok) {
          setWatcherStatus((await res.json()) as WatcherStatus);
        }
      } catch {
        // Backend unreachable — keep last known status.
      }
    };
    poll();
    pollRef.current = setInterval(poll, WATCHER_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /**
   * fetchSyncConfig - Retrieves fetch sync config.
   */
  const fetchSyncConfig = async () => {
    try {
      const syncResponse = await fetch(`${API_BASE}/api/v1/settings/sync`);
      const syncData = await syncResponse.json();
      setSyncEnabled(syncData.is_enabled);

      const foldersResponse = await fetch(`${API_BASE}/api/v1/settings/folders`);
      const foldersData = await foldersResponse.json();
      setWatchedFolders(foldersData.watched_folders || []);
      setExcludedFolders(foldersData.excluded_folders || []);
    } catch (e) {
      console.error('Failed to fetch sync config', e);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * saveSyncConfig - Performs save sync config.
   */
  const saveSyncConfig = async (enabled: boolean, excluded: string[]) => {
    try {
      await fetch(`${API_BASE}/api/v1/settings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled, excluded_folders: excluded })
      });
    } catch (e) {
      console.error('Failed to save sync config', e);
    }
  };

  /**
   * saveFoldersConfig - Performs save folders config.
   */
  const saveFoldersConfig = async (watched: string[], excluded: string[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched_folders: watched, excluded_folders: excluded })
      });
      if (res.ok) {
        const data = await res.json();
        setWatchedFolders(data.watched_folders || watched);
        setExcludedFolders(data.excluded_folders || excluded);
      }
    } catch (e) {
      console.error('Failed to save folders config', e);
    }
  };

  /**
   * handleToggleSync - Handles toggle sync.
   */
  const handleToggleSync = () => {
    const newValue = !syncEnabled;
    setSyncEnabled(newValue);
    saveSyncConfig(newValue, excludedFolders);
  };

  /**
   * rescanNow - Requests an immediate manual rescan of watched folders.
   */
  const rescanNow = useCallback(async () => {
    setIsRescanQueued(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/watcher/rescan`, { method: 'POST' });
      if (res.ok) {
        // Refresh the status right away so "Scanning…" appears immediately.
        const statusRes = await fetch(`${API_BASE}/api/v1/settings/watcher-status`);
        if (statusRes.ok) {
          setWatcherStatus((await statusRes.json()) as WatcherStatus);
        }
      }
    } catch (e) {
      console.error('Failed to queue watcher rescan', e);
    } finally {
      // Keep the queued badge until a scan actually starts (poll catches it).
      setTimeout(() => setIsRescanQueued(false), 4000);
    }
  }, []);

  /**
   * updateWatchedFolders - Performs update watched folders.
   */
  const updateWatchedFolders = (folders: string[]) => {
    setWatchedFolders(folders);
    saveFoldersConfig(folders, excludedFolders);
  };

  /**
   * updateExcludedFolders - Performs update excluded folders.
   */
  const updateExcludedFolders = (folders: string[]) => {
    setExcludedFolders(folders);
    saveFoldersConfig(watchedFolders, folders);
  };

  return {
    syncEnabled,
    watchedFolders,
    excludedFolders,
    isLoading,
    watcherStatus,
    isRescanQueued,
    rescanNow,
    setWatchedFolders: updateWatchedFolders,
    setExcludedFolders: updateExcludedFolders,
    handleToggleSync,
    refreshSyncConfig: fetchSyncConfig
  };
};
