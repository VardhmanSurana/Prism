import { useState, useEffect, useCallback, useRef } from 'react';
import { Photo, RawPhoto, normalizePhoto } from '../types';
import { API_BASE } from '../constants';
import { eventService } from '../services/EventService';
import { useSyncStore } from '../store/syncStore';

const PAGE_SIZE = 50;

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>(() => []);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const setSyncStatus = useSyncStore((s) => s.setSyncStatus);

  const fetchPhotos = useCallback(async (reset = false) => {
    if (!hasMoreRef.current && !reset) return;

    setIsLoading(true);
    try {
      const currentOffset = reset ? 0 : offsetRef.current;
      const response = await fetch(`${API_BASE}/api/v1/photos/?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      if (!response.ok) throw new Error(`Photos API error: ${response.status}`);
      const data: RawPhoto[] = await response.json();
      
      const normalizedData = data.map(normalizePhoto);
      
      if (normalizedData.length < PAGE_SIZE) hasMoreRef.current = false;
      else hasMoreRef.current = true;
      
      if (reset) {
        setPhotos(normalizedData);
        offsetRef.current = PAGE_SIZE;
      } else {
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPhotos = normalizedData.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPhotos];
        });
        offsetRef.current = currentOffset + PAGE_SIZE;
      }
    } catch (e) {
      console.error('Failed to fetch photos', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect/disconnect and subscribe to SSE events once on mount
  useEffect(() => {
    eventService.connect();

    // Fetch initial status via REST API (fallback if SSE hasn't pushed yet)
    const fetchInitialStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/utilities/diagnostics`);
        if (response.ok) {
          const data = await response.json();
          if (data.sync_status) {
            setSyncStatus(data.sync_status);
          }
        }
      } catch (e) {
        console.error('Failed to fetch initial sync status', e);
      } finally {
        setIsStatusLoading(false);
      }
    };
    fetchInitialStatus();
    
    const unsubStatus = eventService.subscribe('status', (data) => {
      const statusData = data.data as { is_scanning: boolean; total_files: number; processed_files: number; progress: number };
      setSyncStatus(statusData);
    });

    const unsubNewPhoto = eventService.subscribe('new_photo', (data) => {
      const rawPhoto = data.photo as RawPhoto;
      setPhotos(prev => {
        if (prev.find(p => p.id === rawPhoto.id)) return prev;
        return [normalizePhoto(rawPhoto), ...prev];
      });
    });

    const unsubTrash = eventService.subscribe('photo_trashed', (data) => {
      setPhotos(prev => prev.filter(p => p.id !== data.photoId));
    });

    // Re-fetch all photos when SSE reconnects (backend restart recovery)
    const unsubReconnect = eventService.subscribe('reconnected', () => {
      fetchPhotos(true);
    });

    return () => {
      unsubStatus();
      unsubNewPhoto();
      unsubTrash();
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
