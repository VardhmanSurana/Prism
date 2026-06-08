import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { Photo } from '../../../types';
import { CleanupTab, BlurryPhoto, DuplicateCluster } from './types';

import { customConfirm } from '../../../services/ConfirmService';

export const useStorageCleanup = () => {
  const [activeSubTab, setActiveSubTab] = useState<CleanupTab>('blurry');
  const [blurryPhotos, setBlurryPhotos] = useState<BlurryPhoto[]>([]);
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>([]);
  const [documentPhotos, setDocumentPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCleanupData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeSubTab === 'blurry') {
        const res = await fetch(`${API_BASE}/api/v1/utilities/blurry`);
        if (res.ok) setBlurryPhotos(await res.json());
      } else if (activeSubTab === 'duplicates') {
        const res = await fetch(`${API_BASE}/api/v1/utilities/duplicates`);
        if (res.ok) setDuplicateClusters(await res.json());
      } else if (activeSubTab === 'documents') {
        const res = await fetch(`${API_BASE}/api/v1/utilities/documents`);
        if (res.ok) setDocumentPhotos(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch cleanup data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetchCleanupData();
  }, [fetchCleanupData]);

  const handleDeletePhoto = async (id: number) => {
    if (!await customConfirm('Are you sure you want to move this photo to trash?', 'Confirm Trash')) return;
    try {
      await fetch(`${API_BASE}/api/v1/photos/${id}/trash`, { method: 'POST' });
      
      // Update local state
      setBlurryPhotos(prev => prev.filter(p => p.id !== id));
      setDocumentPhotos(prev => prev.filter(p => p.id !== id));
      setDuplicateClusters(prev => prev.map(cluster => ({
        ...cluster,
        photos: cluster.photos.filter((p: any) => p.id !== id)
      })).filter(cluster => cluster.photos.length > 1));
      
      alert("Item successfully moved to Trash!");
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
    handleDeletePhoto
  };
};
