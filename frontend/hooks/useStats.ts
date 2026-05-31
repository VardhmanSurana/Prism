import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants';

export interface PhotoStats {
  total_photos: number;
  people_found: number;
  albums: number;
  locked_encrypted: number;
  total_size_bytes: number;
}

export function useStats(photosDependency?: any) {
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/photos/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch statistics');
      }
    } catch (e) {
      console.error('Failed to fetch photo stats:', e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, photosDependency]);

  return { stats, isLoading, error, refetch: fetchStats };
}
