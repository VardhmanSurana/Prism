import { create } from 'zustand';
import { API_BASE } from '@/constants';

export interface BackgroundJob {
  id: number;
  photo_id?: number | null;
  photo_filename?: string | null;
  job_type: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | string;
  current_stage?: string | null;
  stage_progress?: string | null;
  progress_pct: number;
  total_items: number;
  processed_items: number;
  metadata?: any;
  attempt_count: number;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface JobCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface HardwareTelemetry {
  cpu_usage: number;
  on_battery: boolean;
  battery_percent: number;
  cpu_temp_c: number;
  disk_free_bytes: number;
  disk_free_gb: number;
  disk_total_bytes?: number;
  disk_total_gb?: number;
  gpu_busy: boolean;
  external_disconnected: boolean;
  user_active: boolean;
  is_throttled: boolean;
}

interface JobsResponse {
  jobs: BackgroundJob[];
  counts: JobCounts;
  is_worker_paused: boolean;
  is_worker_processing: boolean;
  pause_reason?: string | null;
  paused_stages?: string[];
  hardware?: HardwareTelemetry | null;
}

interface JobsState {
  jobs: BackgroundJob[];
  counts: JobCounts;
  isWorkerPaused: boolean;
  isWorkerProcessing: boolean;
  pauseReason: string | null;
  pausedStages: string[];
  hardware: HardwareTelemetry | null;
  isLoading: boolean;
  error: string | null;

  fetchJobs: (status?: string) => Promise<void>;
  cancelJob: (id: number) => Promise<boolean>;
  retryJob: (id: number) => Promise<boolean>;
  pruneJobs: () => Promise<boolean>;
  pauseWorker: () => Promise<void>;
  resumeWorker: () => Promise<void>;
  pauseStage: (stage: string) => Promise<void>;
  resumeStage: (stage: string) => Promise<void>;
  prioritizeAlbum: (albumId: number) => Promise<boolean>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  counts: {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  },
  isWorkerPaused: false,
  isWorkerProcessing: false,
  pauseReason: null,
  pausedStages: [],
  hardware: null,
  isLoading: false,
  error: null,

  fetchJobs: async (status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = status
        ? `${API_BASE}/api/v1/jobs?status=${encodeURIComponent(status)}&limit=50`
        : `${API_BASE}/api/v1/jobs?limit=50`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: JobsResponse = await res.json();
      set({
        jobs: data.jobs || [],
        counts: data.counts || { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 },
        isWorkerPaused: !!data.is_worker_paused,
        isWorkerProcessing: !!data.is_worker_processing,
        pauseReason: data.pause_reason || null,
        pausedStages: data.paused_stages || [],
        hardware: data.hardware || null,
        isLoading: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
      set({ error: err.message || 'Failed to fetch jobs', isLoading: false });
    }
  },

  cancelJob: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        await get().fetchJobs();
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to cancel job ${id}:`, err);
      return false;
    }
  },

  retryJob: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        await get().fetchJobs();
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to retry job ${id}:`, err);
      return false;
    }
  },

  pruneJobs: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/prune`, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchJobs();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to prune jobs:', err);
      return false;
    }
  },

  pauseWorker: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/pause`, { method: 'POST' });
      if (res.ok) {
        set({ isWorkerPaused: true });
        await get().fetchJobs();
      }
    } catch (err) {
      console.error('Failed to pause worker:', err);
    }
  },

  resumeWorker: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/resume`, { method: 'POST' });
      if (res.ok) {
        set({ isWorkerPaused: false });
        await get().fetchJobs();
      }
    } catch (err) {
      console.error('Failed to resume worker:', err);
    }
  },

  pauseStage: async (stage: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/pause-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        await get().fetchJobs();
      }
    } catch (err) {
      console.error(`Failed to pause stage ${stage}:`, err);
    }
  },

  resumeStage: async (stage: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/resume-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        await get().fetchJobs();
      }
    } catch (err) {
      console.error(`Failed to resume stage ${stage}:`, err);
    }
  },

  prioritizeAlbum: async (albumId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs/prioritize-album/${albumId}`, {
        method: 'POST',
      });
      if (res.ok) {
        await get().fetchJobs();
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to prioritize album ${albumId}:`, err);
      return false;
    }
  },
}));
