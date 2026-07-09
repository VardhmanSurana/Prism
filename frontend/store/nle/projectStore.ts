import { StateCreator } from 'zustand';
import { NLEStore, ProjectAsset } from './types';
import { NLEProject } from '@/types/nle';
import { apiClient } from '@/services/apiClient';

export interface ProjectSlice {
  loadProject: (project: NLEProject) => void;
  saveProject: () => Promise<void>;
  createProject: (photoId: number, sourcePath: string, name?: string) => Promise<number>;
  toProjectJson: () => Record<string, unknown>;
  addProjectAsset: (asset: ProjectAsset) => void;
  removeProjectAsset: (assetId: number) => void;
}

export const createProjectSlice: StateCreator<NLEStore, [], [], ProjectSlice> = (set, get) => ({
  addProjectAsset: (asset) => {
    set(state => {
      if (state.projectAssets.some(a => a.id === asset.id)) return state;
      return {
        projectAssets: [...state.projectAssets, asset],
        isDirty: true
      };
    });
  },

  removeProjectAsset: (assetId) => {
    set(state => ({
      projectAssets: state.projectAssets.filter(a => a.id !== assetId),
      isDirty: true
    }));
  },

  toProjectJson: () => {
    const state = get();
    return {
      version: 1,
      fps: state.projectFps,
      width: state.projectWidth,
      height: state.projectHeight,
      tracks: state.tracks,
      projectAssets: state.projectAssets,
      bookmarks: state.bookmarks,
      ui_state: {
        playheadPosition: state.playheadPosition,
        zoomLevel: state.zoomLevel,
        scrollOffset: state.scrollOffset,
      },
    };
  },

  loadProject: (project) => {
    try {
      const data = typeof project.project_json === 'string'
        ? JSON.parse(project.project_json)
        : project.project_json;

      set({
        projectId: project.id,
        projectName: project.name,
        projectFps: data.fps ?? 30,
        projectWidth: data.width ?? 1920,
        projectHeight: data.height ?? 1080,
        tracks: data.tracks ?? [],
        projectAssets: data.projectAssets ?? [],
        bookmarks: data.bookmarks ?? [],
        playheadPosition: data.ui_state?.playheadPosition ?? 0,
        zoomLevel: data.ui_state?.zoomLevel ?? 100,
        scrollOffset: data.ui_state?.scrollOffset ?? 0,
        isDirty: false,
        _history: [],
        _historyIndex: -1,
        selectedClipId: null,
      });
    } catch (e) {
      console.error('Failed to parse project JSON:', e);
    }
  },

  saveProject: async () => {
    const state = get();
    if (!state.projectId || !state.isDirty) return;

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

  createProject: async (photoId, sourcePath, name) => {
    const body = {
      cover_photo_id: photoId,
      name: name ?? 'New Project',
      project_json: JSON.stringify({
        version: 1,
        fps: 30,
        width: 1920,
        height: 1080,
        tracks: [
          { id: 'v1', name: 'V1', type: 'video', clips: [], locked: false, hidden: false, opacity: 100 },
          { id: 'a1', name: 'A1', type: 'audio', clips: [], locked: false, hidden: false, volume: 100 },
        ],
        projectAssets: [],
        bookmarks: [],
        ui_state: {
          playheadPosition: 0,
          zoomLevel: 100,
          scrollOffset: 0,
        },
      }),
    };
    const data: any = await apiClient.post(`/api/v1/nle/projects`, body);
    set({ projectId: data.id, projectName: body.name, isDirty: false });
    return data.id;
  },
});
