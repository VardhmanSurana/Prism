import { useState, useEffect } from 'react';
import { API_BASE } from '../../constants';

/**
 * useSyncConfig - Hook managing sync config.
 */
export const useSyncConfig = () => {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSyncConfig();
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
    setWatchedFolders: updateWatchedFolders,
    setExcludedFolders: updateExcludedFolders,
    handleToggleSync,
    refreshSyncConfig: fetchSyncConfig
  };
};
