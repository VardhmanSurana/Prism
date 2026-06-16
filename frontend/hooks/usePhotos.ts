import { useState, useEffect, useCallback, useRef } from 'react';
import { Photo, RawPhoto, normalizePhoto } from '../types';
import { API_BASE } from '../constants';
import { eventService } from '../services/EventService';

const PAGE_SIZE = 50;

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [syncStatus, setSyncStatus] = useState({
    is_scanning: false,
    total_files: 0,
    processed_files: 0,
    progress: 0
  });

  const fetchPhotos = useCallback(async (reset = false) => {
    if (!hasMore && !reset) return;

    setIsLoading(true);
    try {
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(`${API_BASE}/api/v1/photos/?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      if (!response.ok) throw new Error(`Photos API error: ${response.status}`);
      const data: RawPhoto[] = await response.json();
      
      const normalizedData = data.map(normalizePhoto);
      
      if (normalizedData.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);
      
      if (reset) {
        setPhotos(normalizedData);
        setOffset(PAGE_SIZE);
      } else {
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPhotos = normalizedData.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPhotos];
        });
        setOffset(currentOffset + PAGE_SIZE);
      }
    } catch (e) {
      console.error('Failed to fetch photos', e);
    } finally {
      setIsLoading(false);
    }
  }, [offset, hasMore]);

  // Stable ref so SSE callbacks always call the latest version without triggering dep loops
  const fetchPhotosRef = useRef(fetchPhotos);
  useEffect(() => { fetchPhotosRef.current = fetchPhotos; }, [fetchPhotos]);

  // Connect/disconnect and subscribe to SSE events once on mount
  useEffect(() => {
    eventService.connect();
    
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
      fetchPhotosRef.current(true);
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

  // Fetch photos on mount once — ref guard prevents re-triggering when fetchPhotos identity changes
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchPhotos(true);
    }
  }, [fetchPhotos]);

  return { 
    photos, 
    setPhotos, 
    fetchPhotos, 
    isLoading,
    syncStatus,
    hasMore 
  };
}
