/**
 * NLE Zustand store — timeline state, project, selection, playback.
 * Composed from responsibility-focused slices.
 */
import { create } from 'zustand';
import { NLEStore } from './nle/types';
import { createProjectSlice } from './nle/projectStore';
import { createTimelineSlice } from './nle/timelineStore';
import { createPlaybackSlice } from './nle/playbackStore';
import { createUISlice } from './nle/uiStore';
import { createHistorySlice } from './nle/historyStore';
import { createActionsSlice } from './nle/actionsStore';

export type { ProjectAsset } from './nle/types';

export const useNLEStore = create<NLEStore>((set, get, store) => ({
  ...createProjectSlice(set, get, store),
  ...createTimelineSlice(set, get, store),
  ...createPlaybackSlice(set, get, store),
  ...createUISlice(set, get, store),
  ...createHistorySlice(set, get, store),
  ...createActionsSlice(set, get, store),
}));
