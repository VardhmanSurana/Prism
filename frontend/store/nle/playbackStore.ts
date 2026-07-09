import { StateCreator } from 'zustand';
import { NLEStore } from './types';

export interface PlaybackSlice {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setPlayheadPosition: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const createPlaybackSlice: StateCreator<NLEStore, [], [], PlaybackSlice> = (set) => ({
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time: number) => set({ playheadPosition: time }),
  setPlayheadPosition: (frame) => set({ playheadPosition: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
});
