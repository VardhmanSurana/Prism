import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Clip, Bookmark } from '@/types/nle';

export interface UISlice {
  zoomLevel: number;
  scrollOffset: number;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  previewFrameUrl: string | null;
  isExportDialogOpen: boolean;
  snapEnabled: boolean;
  bookmarks: Bookmark[];
  clipboardClip: Clip | null;

  setExportDialogOpen: (open: boolean) => void;
  setZoomLevel: (level: number) => void;
  toggleSnap: () => void;
  setClipboardClip: (clip: Clip | null) => void;
  addBookmark: (label?: string, color?: string) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Bookmark>) => void;
  selectClip: (clipId: string | null) => void;
}

export const createUISlice: StateCreator<NLEStore, [], [], UISlice> = (set, get) => ({
  zoomLevel: 100,
  scrollOffset: 0,
  selectedClipId: null,
  selectedTrackId: null,
  previewFrameUrl: null,
  isExportDialogOpen: false,
  snapEnabled: true,
  bookmarks: [],
  clipboardClip: null,

  setExportDialogOpen: (open) => set({ isExportDialogOpen: open }),
  setZoomLevel: (level) => set({ zoomLevel: Math.max(10, Math.min(500, level)) }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setClipboardClip: (clip) => set({ clipboardClip: clip }),

  addBookmark: (label, color) => {
    const { playheadPosition, bookmarks } = get();
    const bookmark: Bookmark = {
      id: `bm_${Date.now()}_${bookmarks.length}`,
      time: playheadPosition,
      label: label ?? `Marker ${bookmarks.length + 1}`,
      color: color ?? '#3b82f6',
    };
    set({ bookmarks: [...bookmarks, bookmark], isDirty: true });
  },

  removeBookmark: (bookmarkId) => {
    set((s) => ({
      bookmarks: s.bookmarks.filter((b) => b.id !== bookmarkId),
      isDirty: true,
    }));
  },

  updateBookmark: (bookmarkId, updates) => {
    set((s) => ({
      bookmarks: s.bookmarks.map((b) =>
        b.id === bookmarkId ? { ...b, ...updates } : b
      ),
      isDirty: true,
    }));
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),
});
