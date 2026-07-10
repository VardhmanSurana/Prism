import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Clip, Bookmark } from '@/types/nle';
import { BOOKMARK_COLORS } from '@/types/nle';

export interface UISlice {
  setSelectedClip: (clipId: string | null) => void;
  setSelectedTrack: (trackId: string | null) => void;
  setZoomLevel: (zoom: number) => void;
  setScrollOffset: (offset: number) => void;
  toggleExportDialog: (open?: boolean) => void;
  toggleSnap: () => void;

  copyClip: (clip: Clip) => void;
  pasteClip: (trackId: string, startFrame: number) => void;

  addBookmark: (label?: string, color?: string) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Bookmark>) => void;
}

export const createUISlice: StateCreator<NLEStore, [], [], UISlice> = (set, get) => ({
  setSelectedClip: (clipId) => set({ selectedClipId: clipId }),
  setSelectedTrack: (trackId) => set({ selectedTrackId: trackId }),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.max(10, Math.min(zoom, 1000)) }),
  setScrollOffset: (offset) => set({ scrollOffset: Math.max(0, offset) }),
  toggleExportDialog: (open) => set((state) => ({ isExportDialogOpen: open ?? !state.isExportDialogOpen })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  copyClip: (clip) => {
    set({ clipboardClip: JSON.parse(JSON.stringify(clip)) });
  },

  pasteClip: (trackId, startFrame) => {
    set((state) => {
      if (!state.clipboardClip) return state;
      state.pushHistory();

      const clip = JSON.parse(JSON.stringify(state.clipboardClip)) as Clip;
      const duration = (clip as any).endFrame - (clip as any).startFrame;

      clip.id = `clip_${Date.now()}`;
      (clip as any).trackId = trackId;
      (clip as any).startFrame = startFrame;
      (clip as any).endFrame = startFrame + duration;
      (clip as any).linkedGroupId = undefined;

      return {
        tracks: state.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
        isDirty: true,
      };
    });
  },

  addBookmark: (label, color) => {
    set((state) => {
      state.pushHistory();
      const newBookmark: Bookmark = {
        id: `bm_${Date.now()}`,
        time: state.playheadPosition,
        label: label ?? `Bookmark ${state.bookmarks.length + 1}`,
        color: color ?? BOOKMARK_COLORS[state.bookmarks.length % BOOKMARK_COLORS.length],
      };
      return {
        bookmarks: [...state.bookmarks, newBookmark].sort((a, b) => a.time - b.time),
        isDirty: true,
      };
    });
  },

  removeBookmark: (bookmarkId) => {
    set((state) => {
      state.pushHistory();
      return {
        bookmarks: state.bookmarks.filter(b => b.id !== bookmarkId),
        isDirty: true,
      };
    });
  },

  updateBookmark: (bookmarkId, updates) => {
    set((state) => ({
      bookmarks: state.bookmarks.map(b => b.id === bookmarkId ? { ...b, ...updates } : b).sort((a, b) => a.time - b.time),
      isDirty: true,
    }));
  }
});
