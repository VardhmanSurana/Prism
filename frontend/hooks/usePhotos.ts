import { useState, useEffect, useCallback } from 'react';
import { Photo, ViewMode, SearchFilters, SortMode, normalizePhoto } from '../types';
import { API_BASE } from '../constants';
import { eventService } from '../services/EventService';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
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
    
    try {
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(`${API_BASE}/api/v1/photos/?limit=50&offset=${currentOffset}`);
      const data = await response.json();
      
      // Normalize data: ensure both camelCase and snake_case fields exist
      const normalizedData = data.map(normalizePhoto);
      
      if (normalizedData.length < 50) setHasMore(false);
      else setHasMore(true);
      
      if (reset) {
        setPhotos(normalizedData);
        setOffset(50);
      } else {
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPhotos = normalizedData.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newPhotos];
        });
        setOffset(currentOffset + 50);
      }
    } catch (e) {
      console.error('Failed to fetch photos', e);
    }
  }, [offset, hasMore]);

  useEffect(() => {
    fetchPhotos(true);
    eventService.connect();
    
    const unsubStatus = eventService.subscribe('status', (data) => {
      setSyncStatus(data.data);
    });



    const unsubNewPhoto = eventService.subscribe('new_photo', (data) => {
      setPhotos(prev => {
        if (prev.find(p => p.id === data.photo.id)) return prev;
        return [normalizePhoto(data.photo), ...prev];
      });
    });

    return () => {
      unsubStatus();
      unsubNewPhoto();
      eventService.disconnect();
    };
  }, []);

  return { 
    photos, 
    setPhotos, 
    fetchPhotos, 
    syncStatus,
    hasMore 
  };
}
