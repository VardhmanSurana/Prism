import { create } from 'zustand';

interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
  mode: 'fit' | 'custom';
}

interface EditorUIState {
  zoom: ZoomState;
  setZoom: (zoom: Partial<ZoomState>) => void;
  resetZoom: () => void;
}

const DEFAULT_ZOOM: ZoomState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  mode: 'fit',
};

export const useEditorUIStore = create<EditorUIState>((set) => ({
  zoom: { ...DEFAULT_ZOOM },

  setZoom: (zoom) => set((state) => ({
    zoom: { ...state.zoom, ...zoom },
  })),

  resetZoom: () => set({ zoom: { ...DEFAULT_ZOOM } }),
}));
