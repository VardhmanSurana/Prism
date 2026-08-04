import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { API_BASE } from '../constants';
import { eventService } from '../services/EventService';

interface PhotoStats {
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

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  isLoading: false,
  error: null,
  fetchStats: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/photos/stats`);
        if (response.ok) {
          const data = await response.json();
          set({ stats: data, error: null });
          return;
        }
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(1.5, attempt)));
          continue;
        }
        throw new Error(`Failed to fetch statistics: ${response.status}`);
      } catch (e) {
        if (attempt < MAX_RETRIES && isConnectionError(e)) {
          await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(1.5, attempt)));
          continue;
        }
        console.error('Failed to fetch photo stats:', e);
        set({ error: e instanceof Error ? e : new Error(String(e)) });
        return;
      }
    }
    set({ isLoading: false });
  }
}));

function isConnectionError(e: unknown): boolean {
  if (e instanceof TypeError) {
    const msg = e.message.toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network');
  }
  return false;
}

export function useStats(photosCount?: number) {
  const { stats, isLoading, error, fetchStats } = useStatsStore();
  const prevCountRef = useRef(photosCount);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (photosCount !== undefined && prevCountRef.current !== undefined) {
      const diff = Math.abs(photosCount - prevCountRef.current);
      if (diff < 20) return;
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
