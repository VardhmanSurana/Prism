/**
 * useVideoProjects — Data hook for the Video Projects Dashboard.
 *
 * Wraps all CRUD operations against /api/v1/nle/projects and manages
 * local state with optimistic deletes and confirmed creates/renames.
 */
import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoProject {
  id: number;
  name: string;
  width: number;
  height: number;
  fps: number;
  cover_photo_id: number | null;
  created_at: string;
  updated_at: string;
}

interface UseVideoProjectsReturn {
  projects: VideoProject[];
  isLoading: boolean;
  error: string | null;
  createProject: (name: string, width: number, height: number, fps: number) => Promise<VideoProject>;
  renameProject: (id: number, name: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVideoProjects(): UseVideoProjectsReturn {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against concurrent refresh calls
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<VideoProject[]>('/api/v1/nle/projects');
      // Backend may return array directly or wrapped
      const list = Array.isArray(data) ? data : (data as any).projects ?? [];
      // Sort by most recently updated first
      list.sort(
        (a: VideoProject, b: VideoProject) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setProjects(list);
    } catch (err) {
      console.error('useVideoProjects: refresh failed', err);
      setError('Failed to load projects. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      refreshInFlight.current = false;
    }
  }, []);

  const createProject = useCallback(
    async (name: string, width: number, height: number, fps: number): Promise<VideoProject> => {
      const body = { name, width, height, fps };
      const created = await apiClient.post<VideoProject>('/api/v1/nle/projects', body);
      // Non-optimistic: insert at top after confirmed response
      setProjects((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const renameProject = useCallback(async (id: number, name: string): Promise<void> => {
    // Non-optimistic rename: update local state only after backend confirms
    const updated = await apiClient.put<VideoProject>(`/api/v1/nle/projects/${id}`, { name });
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: updated.name, updated_at: updated.updated_at } : p))
    );
  }, []);

  const deleteProject = useCallback(async (id: number): Promise<void> => {
    // Optimistic delete: remove from UI immediately, restore on error
    const snapshot = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await apiClient.delete(`/api/v1/nle/projects/${id}`);
    } catch (err) {
      console.error('useVideoProjects: delete failed, restoring', err);
      // Restore the previous state on failure
      setProjects(snapshot);
      throw err;
    }
  }, [projects]);

  return {
    projects,
    isLoading,
    error,
    createProject,
    renameProject,
    deleteProject,
    refresh,
  };
}
