import { useState, useEffect } from 'react';
import { API_BASE } from '../../constants';

export const useSyncConfig = () => {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSyncConfig();
  }, []);

  const fetchSyncConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/sync`);
      const data = await response.json();
      setSyncEnabled(data.is_enabled);
      setExcludedFolders(data.excluded_folders);
    } catch (e) {
      console.error('Failed to fetch sync config', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSyncConfig = async (enabled: boolean, folders: string[]) => {
    try {
      await fetch(`${API_BASE}/api/v1/settings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled, excluded_folders: folders })
      });
    } catch (e) {
      console.error('Failed to save sync config', e);
    }
  };

  const handleToggleSync = () => {
    const newValue = !syncEnabled;
    setSyncEnabled(newValue);
    saveSyncConfig(newValue, excludedFolders);
  };

  const updateExcludedFolders = (folders: string[]) => {
    setExcludedFolders(folders);
    saveSyncConfig(syncEnabled, folders);
  };

  return {
    syncEnabled,
    excludedFolders,
    isLoading,
    setExcludedFolders: updateExcludedFolders,
    handleToggleSync,
    refreshSyncConfig: fetchSyncConfig
  };
};
