import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Track } from '@/types/nle';
import { MAX_HISTORY } from './helpers';
import { computeTimelineDuration } from './timelineMath';

export interface HistorySlice {
  _history: Track[][];
  _historyIndex: number;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const createHistorySlice: StateCreator<NLEStore, [], [], HistorySlice> = (set, get) => ({
  _history: [],
  _historyIndex: -1,

  pushHistory: () => {
    const s = get();
    const snapshot = JSON.parse(JSON.stringify(s.tracks));
    const newHistory = s._history.slice(0, s._historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > MAX_HISTORY) {
      newHistory.splice(0, newHistory.length - MAX_HISTORY);
    }
    set({
      _history: newHistory,
      _historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const s = get();
    if (s._historyIndex < 0) return;
    const snapshot = s._history[s._historyIndex];
    set({
      _historyIndex: s._historyIndex - 1,
      tracks: snapshot,
      duration: computeTimelineDuration(snapshot, s.projectFps),
      isDirty: true,
      selectedClipId: null,
      selectedTrackId: null,
    });
  },

  redo: () => {
    const s = get();
    if (s._historyIndex >= s._history.length - 1) return;
    const snapshot = s._history[s._historyIndex + 1];
    set({
      _historyIndex: s._historyIndex + 1,
      tracks: snapshot,
      duration: computeTimelineDuration(snapshot, s.projectFps),
      isDirty: true,
      selectedClipId: null,
      selectedTrackId: null,
    });
  },

  canUndo: () => {
    const s = get();
    return s._historyIndex >= 0;
  },

  canRedo: () => {
    const s = get();
    return s._historyIndex < s._history.length - 1;
  },
});
