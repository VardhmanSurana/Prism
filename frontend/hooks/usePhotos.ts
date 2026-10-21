import { useState, useEffect, useCallback, useRef } from 'react';
import { Photo, RawPhoto, normalizePhoto } from '../types';
import { API_BASE } from '../constants';
import { apiClient } from '@/services/apiClient';
import { eventService } from '../services/EventService';
import { useSyncStore } from '../store/syncStore';

const PAGE_SIZE = 50;

/**
 * usePhotos - Hook managing photos.
 */
export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>(() => []);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const fetchingRef = useRef(false);
  /**
   * setSyncStatus - Performs set sync status.
   */
  const setSyncStatus = useSyncStore((s) => s.setSyncStatus);

  /**
   * fetchPhotos - Retrieves fetch photos.
   */
  const fetchPhotos = useCallback(async (reset = false) => {
    if (fetchingRef.current && !reset) return;
    if (!hasMoreRef.current && !reset) return;

    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const currentOffset = reset ? 0 : offsetRef.current;
      const data = await apiClient.get<RawPhoto[]>(`/api/v1/photos/?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      
      const normalizedData = data.map(normalizePhoto);
      
      if (normalizedData.length < PAGE_SIZE) hasMoreRef.current = false;
      else hasMoreRef.current = true;
      
      if (reset) {
        setPhotos(normalizedData);
        offsetRef.current = PAGE_SIZE;
      } else {
        setPhotos(prev => {
          /**
           * existingIds - Performs existing ids.
           */
          const existingIds = new Set(prev.map(p => p.id));
          /**
           * newPhotos - Performs new photos.
           */
          const newPhotos = normalizedData.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPhotos];
        });
        offsetRef.current = currentOffset + PAGE_SIZE;
      }
    } catch (e) {
      console.error('Failed to fetch photos', e);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Connect/disconnect and subscribe to SSE events once on mount
  useEffect(() => {
    eventService.connect();

    // Fetch initial status via REST API (fallback if SSE hasn't pushed yet)
    /**
     * fetchInitialStatus - Retrieves fetch initial status.
     */
    const fetchInitialStatus = async () => {
      try {
        const data: any = await apiClient.get(`/api/v1/utilities/diagnostics`);
        if (data.sync_status) {
          setSyncStatus(data.sync_status);
        }
      } catch (e) {
        console.error('Failed to fetch initial sync status', e);
      } finally {
        setIsStatusLoading(false);
      }
    };
    fetchInitialStatus();
    
    /**
     * unsubStatus - Performs unsub status.
     */
    const unsubStatus = eventService.subscribe('status', (data) => {
      const statusData = data.data as { is_scanning: boolean; total_files: number; processed_files: number; progress: number };
      setSyncStatus(statusData);
    });

    /**
     * unsubNewPhoto - Performs unsub new photo.
     */
    const unsubNewPhoto = eventService.subscribe('new_photo', (data) => {
      const rawPhoto = data.photo as RawPhoto;
      setPhotos(prev => {
        if (prev.find(p => p.id === rawPhoto.id)) return prev;
        return [normalizePhoto(rawPhoto), ...prev];
      });
    });

    /**
     * unsubTrash - Performs unsub trash.
     */
    const unsubTrash = eventService.subscribe('photo_trashed', (data) => {
      setPhotos(prev => prev.filter(p => p.id !== data.photoId));
    });

    /**
     * unsubUpdate - Performs unsub update.
     */
    const unsubUpdate = eventService.subscribe('photo_updated', (data) => {
      const rawPhoto = data.photo as RawPhoto;
      if (rawPhoto) {
        const updated = normalizePhoto(rawPhoto);
        setPhotos(prev => prev.map(p => {
          if (String(p.id) === String(updated.id)) {
            return {
              ...p,
              ...updated,
              url: `${updated.url || `/api/v1/photos/${updated.id}/thumbnail`}?h=${Date.now()}`
            };
          }
          return p;
        }));
      } else {
        fetchPhotos(true);
      }
    });

    // Re-fetch all photos when SSE reconnects (backend restart recovery)
    /**
     * unsubReconnect - Performs unsub reconnect.
     */
    const unsubReconnect = eventService.subscribe('reconnected', () => {
      fetchPhotos(true);
    });

    return () => {
      unsubStatus();
      unsubNewPhoto();
      unsubTrash();
      unsubUpdate();
      unsubReconnect();
      eventService.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch photos on mount once — stable identity means no ref guard needed
  useEffect(() => {
    fetchPhotos(true);
  }, [fetchPhotos]);

  return { 
    photos, 
    setPhotos, 
    fetchPhotos, 
    isLoading,
    isStatusLoading
  };
}
