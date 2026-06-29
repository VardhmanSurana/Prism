import { create } from 'zustand';

export type ClipType = 'video' | 'audio' | 'text' | 'subtitle';
export type TransitionType = 'none' | 'crossfade' | 'fadeBlack' | 'fadeWhite';

export interface Effect {
  type: string;
  params: Record<string, number>;
}

export interface Clip {
  id: string;
  type: ClipType;
  sourcePath?: string;
  sourceDuration?: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  x?: number;
  y?: number;
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  transitionDuration?: number;
  effects?: Effect[];
}

export interface Track {
  id: string;
  type: ClipType;
  name: string;
  clips: Clip[];
  muted: boolean;
  volume: number;
}

export interface VideoEditorProject {
  id: string;
  name: string;
  tracks: Track[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipId: string | null;
  selectedTrackId: string | null;
}

interface VideoEditorState {
  project: VideoEditorProject | null;
  isOpen: boolean;
  openEditor: (videoPath: string, videoDuration: number) => void;
  closeEditor: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setZoom: (zoom: number) => void;
  addTrack: (type: ClipType, name: string) => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  splitClip: (trackId: string, clipId: string, splitTime: number) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  reorderClips: (trackId: string, clipIds: string[]) => void;
  setProjectDuration: (duration: number) => void;
}

export const useVideoEditorStore = create<VideoEditorState>((set, get) => ({
  project: null,
  isOpen: false,

  openEditor: (videoPath, videoDuration) => {
    const videoId = 'video_' + Date.now();
    const audioId = 'audio_' + Date.now();
    set({
      isOpen: true,
      project: {
        id: 'project_' + Date.now(),
        name: 'Untitled Project',
        duration: videoDuration,
        currentTime: 0,
        isPlaying: false,
        zoom: 100,
        selectedClipId: null,
        selectedTrackId: null,
        tracks: [
          {
            id: videoId,
            type: 'video',
            name: 'Video',
            clips: [{
              id: 'clip_' + Date.now(),
              type: 'video',
              sourcePath: videoPath,
              sourceDuration: videoDuration,
              startTime: 0,
              duration: videoDuration,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              effects: [],
            }],
            muted: false,
            volume: 1,
          },
          {
            id: audioId,
            type: 'audio',
            name: 'Audio',
            clips: [],
            muted: false,
            volume: 1,
          },
        ],
      },
    });
  },

  closeEditor: () => set({ isOpen: false, project: null }),

  setPlaying: (playing) => set((s) => s.project ? { project: { ...s.project, isPlaying: playing } } : {}),

  setCurrentTime: (time) => set((s) => s.project ? { project: { ...s.project, currentTime: Math.max(0, time) } } : {}),

  setZoom: (zoom) => set((s) => s.project ? { project: { ...s.project, zoom: Math.max(10, Math.min(500, zoom)) } } : {}),

  addTrack: (type, name) => set((s) => {
    if (!s.project) return {};
    const newTrack: Track = {
      id: 'track_' + Date.now(),
      type,
      name,
      clips: [],
      muted: false,
      volume: 1,
    };
    return { project: { ...s.project, tracks: [...s.project.tracks, newTrack] } };
  }),

  removeTrack: (trackId) => set((s) => {
    if (!s.project) return {};
    return { project: { ...s.project, tracks: s.project.tracks.filter(t => t.id !== trackId) } };
  }),

  addClip: (trackId, clip) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
      },
    };
  }),

  removeClip: (trackId, clipId) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t =>
          t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t
        ),
      },
    };
  }),

  updateClip: (trackId, clipId, updates) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t =>
          t.id === trackId
            ? { ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) }
            : t
        ),
      },
    };
  }),

  splitClip: (trackId, clipId, splitTime) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => {
          if (t.id !== trackId) return t;
          const clip = t.clips.find(c => c.id === clipId);
          if (!clip) return t;
          const relativeTime = splitTime - clip.startTime;
          if (relativeTime <= 0 || relativeTime >= clip.duration) return t;
          const firstClip: Clip = { ...clip, duration: relativeTime, id: clip.id };
          const secondClip: Clip = {
            ...clip,
            id: 'clip_' + Date.now(),
            startTime: splitTime,
            duration: clip.duration - relativeTime,
            trimStart: clip.trimStart + relativeTime * clip.speed,
          };
          const idx = t.clips.indexOf(clip);
          const newClips = [...t.clips];
          newClips.splice(idx, 1, firstClip, secondClip);
          return { ...t, clips: newClips };
        }),
      },
    };
  }),

  selectClip: (clipId) => set((s) => s.project ? { project: { ...s.project, selectedClipId: clipId } } : {}),
  selectTrack: (trackId) => set((s) => s.project ? { project: { ...s.project, selectedTrackId: trackId } } : {}),

  updateTrack: (trackId, updates) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t),
      },
    };
  }),

  reorderClips: (trackId, clipIds) => set((s) => {
    if (!s.project) return {};
    return {
      project: {
        ...s.project,
        tracks: s.project.tracks.map(t => {
          if (t.id !== trackId) return t;
          const clipMap = new Map(t.clips.map(c => [c.id, c]));
          const reordered = clipIds.map(id => clipMap.get(id)!).filter(Boolean);
          return { ...t, clips: reordered };
        }),
      },
    };
  }),

  setProjectDuration: (duration) => set((s) => s.project ? { project: { ...s.project, duration } } : {}),
}));
