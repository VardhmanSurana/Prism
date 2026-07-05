import { create } from 'zustand';

interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  showControls: boolean;
  isPiP: boolean;
  isLoading: boolean;
  hasError: boolean;
  hasAudio: boolean;

  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setShowControls: (show: boolean) => void;
  setPiP: (pip: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: boolean) => void;
  setHasAudio: (hasAudio: boolean) => void;
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,
  showControls: true,
  isPiP: false,
  isLoading: true,
  hasError: false,
  hasAudio: true,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  setMuted: (isMuted) => set({ isMuted }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setShowControls: (showControls) => set({ showControls }),
  setPiP: (isPiP) => set({ isPiP }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (hasError) => set({ hasError }),
  setHasAudio: (hasAudio) => set({ hasAudio }),
  reset: () => set(initialState),
}));
