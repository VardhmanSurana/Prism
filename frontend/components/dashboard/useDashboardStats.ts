import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/constants';

export interface PhotoStats {
  total_photos: number;
  total_videos: number;
  favorites_count: number;
  trash_count: number;
  locked_count: number;
  storage_used_bytes: number;
}

export interface StorageBreakdown {
  originals_bytes: number;
  thumbnails_bytes: number;
  models_bytes: number;
  proxies_bytes: number;
  database_bytes: number;
  total_bytes: number;
}

export interface LibraryBackupInfo {
  id: number;
  filename: string;
  path: string;
  size_bytes: number;
  integrity_status: string;
  created_at: string;
}

export interface LibraryHealth {
  storage: StorageBreakdown;
  missing_count: number;
  broken_paths_count: number;
  last_backup: LibraryBackupInfo | null;
  integrity_status: string;
  is_healthy: boolean;
}

export interface StageProgress {
  processed: number;
  total: number;
  progress: number;
  is_processing: boolean;
}

export interface BackgroundJobsStatus {
  total_photos: number;
  paused: boolean;
  is_processing: boolean;
  pause_reason?: string | null;
  paused_stages?: string[];
  thumbnail?: StageProgress;
  clip?: StageProgress;
  face?: StageProgress;
  gemma?: StageProgress;
  ocr?: StageProgress;
  queue?: {
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  };
}

export interface InferenceSlotStatus {
  busy: boolean;
  job?: string;
  held_seconds?: number;
}

export interface HardwareProfileResponse {
  profile?: {
    gpu_name?: string;
    vram_mb?: number;
    ram_mb?: number;
    cpu_model?: string;
    cpu_threads?: number;
    backend?: string;
    supports_heavyweight_generative?: boolean;
  };
  inference_slot?: InferenceSlotStatus;
}

export interface DashboardStatsState {
  photoStats: PhotoStats | null;
  libraryHealth: LibraryHealth | null;
  pipelineStatus: BackgroundJobsStatus | null;
  hardwareProfile: HardwareProfileResponse | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useDashboardStats(pollIntervalMs = 4000): DashboardStatsState {
  const [photoStats, setPhotoStats] = useState<PhotoStats | null>(null);
  const [libraryHealth, setLibraryHealth] = useState<LibraryHealth | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<BackgroundJobsStatus | null>(null);
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, healthRes, jobsStatusRes, hwRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/photos/stats`),
        fetch(`${API_BASE}/api/v1/library/health/status`),
        fetch(`${API_BASE}/api/v1/utilities/background-jobs/status`),
        fetch(`${API_BASE}/api/v1/system/hardware`),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setPhotoStats(data);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const data = await healthRes.value.json();
        setLibraryHealth(data);
      }

      if (jobsStatusRes.status === 'fulfilled' && jobsStatusRes.value.ok) {
        const data = await jobsStatusRes.value.json();
        setPipelineStatus(data);
      }

      if (hwRes.status === 'fulfilled' && hwRes.value.ok) {
        const data = await hwRes.value.json();
        setHardwareProfile(data);
      }

      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch live dashboard telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const manualRefresh = useCallback(async () => {
    setIsLoading(true);
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAll, pollIntervalMs]);

  return {
    photoStats,
    libraryHealth,
    pipelineStatus,
    hardwareProfile,
    isLoading,
    error,
    lastUpdated,
    refresh: manualRefresh,
  };
}
