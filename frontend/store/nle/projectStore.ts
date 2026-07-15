import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { apiClient } from '@/services/apiClient';
import { nextTrackId } from './helpers';
import { computeTimelineDuration } from './timelineMath';

export interface ProjectSlice {
  projectId: number | null;
  projectName: string;
  projectWidth: number;
  projectHeight: number;
  projectFps: number;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  projectAssets: NLEStore['projectAssets'];

  loadProject: (project: any) => void;
  saveProject: () => Promise<void>;
  createProject: (photoId: number, photoPath: string, name?: string) => Promise<number>;
  toProjectJson: () => Record<string, unknown>;
  addProjectAsset: (asset: any) => void;
  removeProjectAsset: (assetId: number) => void;
}

export const createProjectSlice: StateCreator<NLEStore, [], [], ProjectSlice> = (set, get) => ({
  projectId: null,
  projectName: 'Untitled Edit',
  projectWidth: 1920,
  projectHeight: 1080,
  projectFps: 30,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  projectAssets: [],

  loadProject: (project) => {
    const tj = project.project_json;
    set({
      projectId: project.id,
      projectName: project.name,
      projectWidth: project.width,
      projectHeight: project.height,
      projectFps: project.fps,
      tracks: tj?.tracks ?? [],
      duration: tj?.duration ?? 0,
      playheadPosition: 0,
      isDirty: false,
      selectedClipId: null,
      selectedTrackId: null,
      projectAssets: tj?.projectAssets ?? [],
      _history: [],
      _historyIndex: -1,
    });
  },

  saveProject: async () => {
    const state = get();
    if (!state.projectId) return;
    set({ isSaving: true });
    try {
      const body = {
        name: state.projectName,
        project_json: JSON.stringify(state.toProjectJson()),
      };
      await apiClient.put(`/api/v1/nle/projects/${state.projectId}`, body);
      set({ isDirty: false, lastSavedAt: Date.now() });
    } catch (e) {
      console.error('Failed to save project:', e);
    } finally {
      set({ isSaving: false });
    }
  },

  createProject: async (photoId, photoPath, name) => {
    const body = {
      name: name ?? 'Untitled Edit',
      cover_photo_id: photoId,
      project_json: JSON.stringify({
        tracks: [{
          id: nextTrackId(),
          type: 'video',
          name: 'Video 1',
          muted: false,
          solo: false,
          visible: true,
          locked: false,
          clips: [],
        }],
        duration: 0,
        playheadPosition: 0,
        zoomLevel: 100,
        scrollOffset: 0,
      }),
    };
    const data: any = await apiClient.post(`/api/v1/nle/projects`, body);
    set({ projectId: data.id, projectName: body.name, isDirty: false });
    return data.id;
  },

  toProjectJson: () => {
    const s = get();
    return {
      tracks: s.tracks,
      duration: computeTimelineDuration(s.tracks, s.projectFps),
      playheadPosition: s.playheadPosition,
      zoomLevel: s.zoomLevel,
      scrollOffset: s.scrollOffset,
      fps: s.projectFps,
      resolution: { w: s.projectWidth, h: s.projectHeight },
      projectAssets: s.projectAssets,
    };
  },

  addProjectAsset: (asset) => set((s) => {
    if (s.projectAssets.some((a) => a.id === asset.id && a.type === asset.type)) return s;
    return { projectAssets: [...s.projectAssets, asset] };
  }),

  removeProjectAsset: (assetId) => set((s) => ({
    projectAssets: s.projectAssets.filter((a) => a.id !== assetId),
  })),
});
