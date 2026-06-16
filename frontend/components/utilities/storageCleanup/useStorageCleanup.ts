import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { Photo } from '../../../types';
import { CleanupTab, BlurryPhoto, DuplicateCluster } from './types';
import { customConfirm } from '../../../services/ConfirmService';

interface StorageStats {
  database_size_bytes: number;
  thumbnail_cache_size_bytes: number;
  database_path: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const useStorageCleanup = () => {
  const [activeSubTab, setActiveSubTab] = useState<CleanupTab>('blurry');
  const [blurryPhotos, setBlurryPhotos] = useState<BlurryPhoto[]>([]);
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>([]);
  const [documentPhotos, setDocumentPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [cacheActionStatus, setCacheActionStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isVacuuming, setIsVacuuming] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setStorageStats({
          database_size_bytes: data.database_size_bytes,
          thumbnail_cache_size_bytes: data.thumbnail_cache_size_bytes,
          database_path: data.database_path
        });
      }
    } catch {
      // Silently fail - stats are non-critical
    }
  }, []);

  const fetchCleanupData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [blurryRes, duplicatesRes, documentsRes, _] = await Promise.all([
        activeSubTab === 'blurry' ? fetch(`${API_BASE}/api/v1/utilities/blurry`) : Promise.resolve(null),
        activeSubTab === 'duplicates' ? fetch(`${API_BASE}/api/v1/utilities/duplicates`) : Promise.resolve(null),
        activeSubTab === 'documents' ? fetch(`${API_BASE}/api/v1/utilities/documents`) : Promise.resolve(null),
        fetchDiagnostics()
      ]);
      if (blurryRes?.ok) setBlurryPhotos(await blurryRes.json());
      if (duplicatesRes?.ok) setDuplicateClusters(await duplicatesRes.json());
      if (documentsRes?.ok) setDocumentPhotos(await documentsRes.json());
    } catch (e) {
      console.error("Failed to fetch cleanup data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeSubTab, fetchDiagnostics]);

  useEffect(() => {
    fetchCleanupData();
  }, [fetchCleanupData]);

  const handleClearCache = async () => {
    if (!await customConfirm('Clear all cached thumbnails? Photos will need to be re-indexed to regenerate thumbnails.', 'Clear Thumbnail Cache')) return;
    setIsClearingCache(true);
    setCacheActionStatus({ type: 'info', message: 'Clearing thumbnail cache...' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/clear-cache`, { method: 'POST' });
      if (!res.ok) throw new Error(`Clear cache failed: ${res.status}`);
      const data = await res.json();
      setCacheActionStatus({ type: 'success', message: `Cache cleared. ${data.deleted} thumbnail(s) removed.` });
      fetchDiagnostics();
    } catch (e) {
      setCacheActionStatus({ type: 'error', message: `Failed to clear cache: ${e instanceof Error ? e.message : 'Unknown error'}` });
    } finally {
      setIsClearingCache(false);
      setTimeout(() => setCacheActionStatus(null), 5000);
    }
  };

  const handleVacuumDatabase = async () => {
    if (!await customConfirm('Optimize the database? This reclaims disk space and improves performance.', 'Vacuum Database')) return;
    setIsVacuuming(true);
    setCacheActionStatus({ type: 'info', message: 'Vacuuming database...' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/vacuum`, { method: 'POST' });
      if (!res.ok) throw new Error(`Vacuum failed: ${res.status}`);
      setCacheActionStatus({ type: 'success', message: 'Database vacuumed successfully.' });
      fetchDiagnostics();
    } catch (e) {
      setCacheActionStatus({ type: 'error', message: `Failed to vacuum: ${e instanceof Error ? e.message : 'Unknown error'}` });
    } finally {
      setIsVacuuming(false);
      setTimeout(() => setCacheActionStatus(null), 5000);
    }
  };

  const handleDeletePhoto = async (id: number) => {
    if (!await customConfirm('Are you sure you want to move this photo to trash?', 'Confirm Trash')) return;
    try {
      await fetch(`${API_BASE}/api/v1/photos/${id}/trash`, { method: 'POST' });
      
      setBlurryPhotos(prev => prev.filter(p => p.id !== id));
      setDocumentPhotos(prev => prev.filter(p => p.id !== id));
      setDuplicateClusters(prev => prev.map(cluster => ({
        ...cluster,
        photos: cluster.photos.filter((p: any) => p.id !== id)
      })).filter(cluster => cluster.photos.length > 1));
    } catch (e) {
      console.error(e);
    }
  };

  return {
    activeSubTab,
    setActiveSubTab,
    blurryPhotos,
    duplicateClusters,
    documentPhotos,
    isLoading,
    storageStats,
    cacheActionStatus,
    isClearingCache,
    isVacuuming,
    handleClearCache,
    handleVacuumDatabase,
    handleDeletePhoto,
    formatBytes
  };
};
