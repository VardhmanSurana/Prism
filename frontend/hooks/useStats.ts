import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { API_BASE } from '../constants';
import { eventService } from '../services/EventService';

export interface PhotoStats {
  total_photos: number;
  people_found: number;
  albums: number;
  locked_encrypted: number;
  total_size_bytes: number;
}

interface StatsState {
  stats: PhotoStats | null;
  isLoading: boolean;
  error: Error | null;
  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  isLoading: false,
  error: null,
  fetchStats: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/stats`);
      if (response.ok) {
        const data = await response.json();
        set({ stats: data, error: null });
      } else {
        throw new Error('Failed to fetch statistics');
      }
    } catch (e) {
      console.error('Failed to fetch photo stats:', e);
      set({ error: e instanceof Error ? e : new Error(String(e)) });
    } finally {
      set({ isLoading: false });
    }
  }
}));

export function useStats(photosCount?: number) {
  const { stats, isLoading, error, fetchStats } = useStatsStore();
  const prevCountRef = useRef(photosCount);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (photosCount !== undefined && prevCountRef.current !== undefined) {
      const diff = Math.abs(photosCount - prevCountRef.current);
      if (diff < 5) return;
    }
    prevCountRef.current = photosCount;
    fetchStats();
  }, [photosCount, fetchStats]);

  useEffect(() => {
    const unsub = eventService.subscribe('photo_trashed', () => {
      fetchStats();
    });
    return () => unsub();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}
