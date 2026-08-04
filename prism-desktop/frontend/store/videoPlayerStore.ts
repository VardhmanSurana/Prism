import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persistent video preferences that survive between video opens.
 * All transient playback state (isPlaying, currentTime, etc.) lives
 * in VideoPlayer component local state to avoid race conditions.
 */
interface VideoPreferencesState {
  volume: number;
  isMuted: boolean;
  playbackRate: number;

  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

export const useVideoPlayerStore = create<VideoPreferencesState>()(
  persist(
    (set) => ({
      volume: 1,
      isMuted: false,
      playbackRate: 1,

      setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
      setMuted: (isMuted) => set({ isMuted }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
    }),
    { name: 'prism-video-player' }
  )
);
