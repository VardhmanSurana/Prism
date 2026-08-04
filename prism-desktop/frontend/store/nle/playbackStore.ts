import { StateCreator } from 'zustand';
import { NLEStore } from './types';

export interface PlaybackSlice {
  isPlaying: boolean;
  playheadPosition: number;

  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

export const createPlaybackSlice: StateCreator<NLEStore, [], [], PlaybackSlice> = (set) => ({
  isPlaying: false,
  playheadPosition: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time) => set({ playheadPosition: time }),
});
