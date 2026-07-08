/**
 * NLE Zustand store — timeline state, project, selection, playback.
 */
import { create } from 'zustand';
import type {
  TimelineState, Track, Clip, ClipEffects, ClipTransform, Transition,
  NLEProject, VideoClipAnalysis, Keyframe, Bookmark,
} from '@/types/nle';
import { DEFAULT_EFFECTS, DEFAULT_TRANSFORM, BOOKMARK_COLORS } from '@/types/nle';
import { API_BASE } from '@/constants';
import { splitKeyframes, shiftKeyframes } from '@/lib/keyframes';
import type { Photo } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An asset imported into this project for editing */
export interface ProjectAsset {
  id: number;
  path: string;
  filename?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  type: 'video' | 'image' | 'audio';
  thumbnailUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _clipCounter = 0;
function nextClipId(): string {
  return `clip_${Date.now()}_${++_clipCounter}`;
}

function nextTrackId(): string {
  return `track_${Date.now()}_${++_clipCounter}`;
}

const MAX_HISTORY = 30;

function clipsOverlap(a: { startFrame: number; durationFrames: number }, b: { startFrame: number; durationFrames: number }): boolean {
  return a.startFrame < b.startFrame + b.durationFrames && b.startFrame < a.startFrame + a.durationFrames;
}

function computeDuration(tracks: Track[], fps: number = 30): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = (clip.startFrame + clip.durationFrames) / fps;
      if (end > max) max = end;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// Undo/Redo helpers — operate on store state directly
// ---------------------------------------------------------------------------

function pushHistorySnapshot(tracks: Track[]) {
  const state = useNLEStore.getState();
  const snapshot: Track[] = JSON.parse(JSON.stringify(tracks));
  const newHistory = state._history.slice(0, state._historyIndex + 1);
  newHistory.push(snapshot);
  // Cap history depth
  if (newHistory.length > MAX_HISTORY) {
    newHistory.splice(0, newHistory.length - MAX_HISTORY);
  }
  useNLEStore.setState({
    _history: newHistory,
    _historyIndex: newHistory.length - 1,
  });
}

function undoSnapshot(): Track[] | null {
  const state = useNLEStore.getState();
  if (state._historyIndex < 0) return null;
  const snapshot = state._history[state._historyIndex];
  useNLEStore.setState({ _historyIndex: state._historyIndex - 1 });
  return snapshot;
}

function redoSnapshot(): Track[] | null {
  const state = useNLEStore.getState();
  if (state._historyIndex >= state._history.length - 1) return null;
  const snapshot = state._history[state._historyIndex + 1];
  useNLEStore.setState({ _historyIndex: state._historyIndex + 1 });
  return snapshot;
}

function canUndo(): boolean {
  return useNLEStore.getState()._historyIndex >= 0;
}

function canRedo(): boolean {
  const state = useNLEStore.getState();
  return state._historyIndex < state._history.length - 1;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface NLEStore {
  // Project
  projectId: number | null;
  projectName: string;
  projectWidth: number;
  projectHeight: number;
  projectFps: number;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;

  // Timeline
  tracks: Track[];
  duration: number;
  playheadPosition: number;
  zoomLevel: number;
  scrollOffset: number;

  // Selection
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // Playback
  isPlaying: boolean;

  // Preview
  previewFrameUrl: string | null;

  // UI
  isExportDialogOpen: boolean;
  snapEnabled: boolean;
  bookmarks: Bookmark[];
  clipboardClip: Clip | null;

  // Project assets (videos/images/audio imported for this project)
  projectAssets: ProjectAsset[];

  // Undo/Redo history
  _history: Track[][];
  _historyIndex: number;

  // ---- Actions ----
  // Project
  loadProject: (project: NLEProject) => void;
  saveProject: () => Promise<void>;
  createProject: (photoId: number, photoPath: string, name?: string) => Promise<number>;

  // Timeline mutations
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartFrame: number, newTrackId?: string) => void;
  splitClip: (clipId: string, atTime: number) => void;
  trimClip: (clipId: string, side: 'in' | 'out', newFrame: number) => void;

  // Clip properties
  setClipSpeed: (clipId: string, speed: number) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  setClipMuted: (clipId: string, muted: boolean) => void;
  setClipEffects: (clipId: string, effects: Partial<ClipEffects>) => void;
  setClipFadeIn: (clipId: string, duration: number) => void;
  setClipFadeOut: (clipId: string, duration: number) => void;
  setClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
  setClipTransition: (clipId: string, transition: Transition | undefined) => void;
  setClipKeyframes: (clipId: string, property: string, keyframes: Keyframe[]) => void;
  addFreezeFrame: (clipId: string, atTime: number) => void;

  // Track actions
  addTrack: (type: 'video' | 'audio' | 'text') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (sourceTrackId: string, targetTrackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLocked: (trackId: string) => void;
  selectTrack: (trackId: string | null) => void;
  renameTrack: (trackId: string, name: string) => void;

  // Multi-clip
  addClipFromLibrary: (trackId: string, photo: { id: number; path: string; filename?: string; duration?: number; width?: number; height?: number; fps?: number }) => Promise<void>;

  // Playback
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;

  // Selection
  selectClip: (clipId: string | null) => void;

  // UI
  setExportDialogOpen: (open: boolean) => void;
  setZoomLevel: (level: number) => void;
  toggleSnap: () => void;
  setClipboardClip: (clip: Clip | null) => void;

  // Bookmarks
  addBookmark: (label?: string, color?: string) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Bookmark>) => void;

  // Link / Unlink clips
  linkClips: (clipIdA: string, clipIdB: string) => void;
  unlinkClip: (clipId: string) => void;

  // Subtitles
  generateSubtitles: (trackId: string, sourcePath: string) => Promise<void>;

  // Project assets
  addProjectAsset: (asset: ProjectAsset) => void;
  removeProjectAsset: (assetId: number) => void;

  // Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Computed
  getSelectedClip: () => Clip | null;
  getTimelineDuration: () => number;
  toProjectJson: () => Record<string, unknown>;
}

export const useNLEStore = create<NLEStore>((set, get) => ({
  // ---- State ----
  projectId: null,
  projectName: 'Untitled Edit',
  projectWidth: 1920,
  projectHeight: 1080,
  projectFps: 30,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  tracks: [],
  duration: 0,
  playheadPosition: 0,
  zoomLevel: 100,
  scrollOffset: 0,

  selectedClipId: null,
  selectedTrackId: null,

  isPlaying: false,
  previewFrameUrl: null,
  isExportDialogOpen: false,
  snapEnabled: true,
  bookmarks: [],
  clipboardClip: null,
  projectAssets: [],
  _history: [],
  _historyIndex: -1,

  // ---- Project actions ----
  loadProject: (project) => {
    const tj = project.project_json;
    set({
      projectId: project.id,
      projectName: project.name,
      projectWidth: project.width,
      projectHeight: project.height,
      projectFps: project.fps,
      tracks: tj?.tracks ?? [],
      duration: tj?.duration ?? 0,
      playheadPosition: 0,
      isDirty: false,
      selectedClipId: null,
      selectedTrackId: null,
      projectAssets: tj?.projectAssets ?? [],
      _history: [],
      _historyIndex: -1,
    });
  },

  saveProject: async () => {
    const state = get();
    if (!state.projectId) return;
    set({ isSaving: true });
    try {
      const body = {
        name: state.projectName,
        project_json: JSON.stringify(state.toProjectJson()),
      };
      await fetch(`${API_BASE}/api/v1/nle/projects/${state.projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      set({ isDirty: false, lastSavedAt: Date.now() });
    } catch (e) {
      console.error('Failed to save project:', e);
    } finally {
      set({ isSaving: false });
    }
  },

  createProject: async (photoId, photoPath, name) => {
    const body = {
      name: name ?? 'Untitled Edit',
      cover_photo_id: photoId,
      project_json: JSON.stringify({
        tracks: [{
          id: nextTrackId(),
          type: 'video',
          name: 'Video 1',
          muted: false,
          solo: false,
          visible: true,
          locked: false,
          clips: [],
        }],
        duration: 0,
        playheadPosition: 0,
        zoomLevel: 100,
        scrollOffset: 0,
      }),
    };
    const res = await fetch(`${API_BASE}/api/v1/nle/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    set({ projectId: data.id, projectName: body.name, isDirty: false });
    return data.id;
  },

  // ---- Timeline mutations ----
  addClip: (trackId, clip) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (track?.locked) return;
    pushHistorySnapshot(get().tracks);
    set((s) => {
      const tracks = s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      );
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  removeClip: (clipId) => {
    pushHistorySnapshot(get().tracks);
    set((s) => {
      const tracks = s.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }));
      return {
        tracks,
        duration: computeDuration(tracks, s.projectFps),
        isDirty: true,
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      };
    });
  },

  moveClip: (clipId, newStartFrame, newTrackId) => {
    pushHistorySnapshot(get().tracks);
    set((s) => {
      let movedClip: Clip | undefined;
      let originalStartFrame = 0;
      let sourceTrackId: string | undefined;
      const tracks = s.tracks.map((t) => {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) return t;
        originalStartFrame = t.clips[idx].startFrame;
        movedClip = { ...t.clips[idx], startFrame: newStartFrame };
        sourceTrackId = t.id;
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
      });
      if (!movedClip) return {};
      const targetId = newTrackId ?? sourceTrackId;
      if (targetId) {
        const targetIdx = tracks.findIndex((t) => t.id === targetId);
        if (targetIdx !== -1) {
          // Snap logic: snap to playhead and other clip boundaries
          let snappedFrame = movedClip.startFrame;
          if (s.snapEnabled) {
            const SNAP_THRESHOLD = 5; // frames
            const snapPoints: number[] = [0]; // snap to start
            snapPoints.push(Math.round(s.playheadPosition * s.projectFps)); // snap to playhead
            for (const otherClip of tracks[targetIdx].clips) {
              if (otherClip.id === clipId) continue;
              snapPoints.push(otherClip.startFrame);
              snapPoints.push(otherClip.startFrame + otherClip.durationFrames);
            }
            for (const pt of snapPoints) {
              if (Math.abs(movedClip.startFrame - pt) <= SNAP_THRESHOLD) {
                snappedFrame = pt;
                break;
              }
            }
            movedClip = { ...movedClip, startFrame: snappedFrame };
          }
          const candidate = { startFrame: movedClip.startFrame, durationFrames: movedClip.durationFrames };
          const hasOverlap = tracks[targetIdx].clips.some((c) => clipsOverlap(candidate, c));
          if (hasOverlap) return {};
          const newClips = [...tracks[targetIdx].clips, movedClip];
          newClips.sort((a, b) => a.startFrame - b.startFrame);
          tracks[targetIdx] = { ...tracks[targetIdx], clips: newClips };

          // Move linked clips by the same delta
          if (movedClip.linkedId) {
            const deltaFrames = movedClip.startFrame - originalStartFrame;
            for (let ti = 0; ti < tracks.length; ti++) {
              if (ti === targetIdx) continue;
              tracks[ti] = {
                ...tracks[ti],
                clips: tracks[ti].clips.map((c) => {
                  if (c.linkedId === movedClip!.linkedId) {
                    return { ...c, startFrame: Math.max(0, c.startFrame + deltaFrames) };
                  }
                  return c;
                }).sort((a, b) => a.startFrame - b.startFrame),
              };
            }
          }
        }
      }
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  splitClip: (clipId, atTime) => {
    pushHistorySnapshot(get().tracks);
    set((s) => {
      const tracks = s.tracks.map((t) => {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) return t;
        const clip = t.clips[idx];
        const splitFrame = Math.round(atTime * s.projectFps);
        const clipStartFrame = clip.startFrame;
        const splitRelativeFrame = splitFrame - clipStartFrame;

        if (splitRelativeFrame <= 0 || splitRelativeFrame >= clip.durationFrames) return t;

        const splitRelativeTime = splitRelativeFrame / s.projectFps;
        const split = splitKeyframes(clip.keyframes, splitRelativeTime);

        const clip1: Clip = {
          ...clip,
          id: clip.id,
          durationFrames: splitRelativeFrame,
          outPoint: clip.inPoint + splitRelativeFrame / s.projectFps,
          keyframes: split.before,
        };
        const clip2: Clip = {
          ...clip,
          id: nextClipId(),
          startFrame: splitFrame,
          inPoint: clip.inPoint + splitRelativeFrame / s.projectFps,
          durationFrames: clip.durationFrames - splitRelativeFrame,
          keyframes: shiftKeyframes(split.after, -splitRelativeTime),
        };

        const newClips = [...t.clips];
        newClips.splice(idx, 1, clip1, clip2);
        return { ...t, clips: newClips };
      });
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  trimClip: (clipId, side, newFrame) => {
    pushHistorySnapshot(get().tracks);
    set((s) => {
      let trimmedClip: Clip | null = null;
      let targetTrackId: string | null = null;
      let targetTrackIndex = -1;

      // First, compute the trimmed clip and find its track
      for (const t of s.tracks) {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) continue;
        const clip = t.clips[idx];
        let updated: Clip;
        if (side === 'in') {
          const diff = newFrame - clip.startFrame;
          updated = {
            ...clip,
            startFrame: newFrame,
            durationFrames: clip.durationFrames - diff,
            inPoint: clip.inPoint + diff / s.projectFps,
          };
        } else {
          updated = {
            ...clip,
            durationFrames: newFrame - clip.startFrame,
            outPoint: clip.inPoint + (newFrame - clip.startFrame) / s.projectFps,
          };
        }
        trimmedClip = updated;
        targetTrackId = t.id;
        targetTrackIndex = s.tracks.indexOf(t);
        break;
      }

      if (!trimmedClip || targetTrackIndex === -1) return {};

      // Check for overlap with other clips on the same track
      const targetTrack = s.tracks[targetTrackIndex];
      const hasOverlap = targetTrack.clips.some((c) => {
        if (c.id === clipId) return false;
        return clipsOverlap(trimmedClip!, c);
      });
      if (hasOverlap) return {};

      // Apply the trim
      const tracks = s.tracks.map((t) => {
        if (t.id !== targetTrackId) return t;
        const newClips = t.clips.map((c) => c.id === clipId ? trimmedClip! : c);
        return { ...t, clips: newClips };
      });
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  // ---- Clip properties ----
  setClipSpeed: (clipId, speed) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => c.id === clipId ? { ...c, speed } : c),
      })),
      isDirty: true,
    }));
  },

  setClipVolume: (clipId, volume) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => c.id === clipId ? { ...c, volume } : c),
      })),
      isDirty: true,
    }));
  },

  setClipMuted: (clipId, muted) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => c.id === clipId ? { ...c, muted } : c),
      })),
      isDirty: true,
    }));
  },

  setClipEffects: (clipId, effects) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, effects: { ...c.effects, ...effects } }
            : c
        ),
      })),
      isDirty: true,
    }));
  },

  setClipFadeIn: (clipId, duration) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => c.id === clipId ? { ...c, fadeIn: duration } : c),
      })),
      isDirty: true,
    }));
  },

  setClipFadeOut: (clipId, duration) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => c.id === clipId ? { ...c, fadeOut: duration } : c),
      })),
      isDirty: true,
    }));
  },

  setClipTransform: (clipId, transform) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, transform: { ...c.transform, ...transform } }
            : c
        ),
      })),
      isDirty: true,
    }));
  },

  setClipTransition: (clipId, transition) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, transition } : c
        ),
      })),
      isDirty: true,
    }));
  },

  setClipKeyframes: (clipId, property, keyframes) => {
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, keyframes: { ...c.keyframes, [property]: keyframes } }
            : c
        ),
      })),
      isDirty: true,
    }));
  },

  addFreezeFrame: (clipId, atTime) => {
    set((s) => {
      const tracks = s.tracks.map((t) => {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) return t;
        const clip = t.clips[idx];
        const splitFrame = Math.round(atTime * s.projectFps);
        const splitRelativeFrame = splitFrame - clip.startFrame;
        if (splitRelativeFrame <= 0 || splitRelativeFrame >= clip.durationFrames) return t;

        const freezeDuration = 2 * s.projectFps; // 2 seconds
        const splitAt = clip.inPoint + splitRelativeFrame / s.projectFps;

        const clip1: Clip = {
          ...clip,
          durationFrames: splitRelativeFrame,
          outPoint: splitAt,
          keyframes: { ...clip.keyframes },
        };
        const freezeClip: Clip = {
          id: nextClipId(),
          sourceId: clip.sourceId,
          sourcePath: clip.sourcePath,
          sourceDuration: clip.sourceDuration,
          startFrame: splitFrame,
          durationFrames: freezeDuration,
          inPoint: splitAt,
          outPoint: splitAt,
          speed: 0,
          volume: clip.volume,
          muted: clip.muted,
          fadeIn: 0,
          fadeOut: 0,
          effects: { ...clip.effects },
          transform: { ...clip.transform },
          keyframes: {},
        };
        const clip2: Clip = {
          ...clip,
          id: nextClipId(),
          startFrame: splitFrame + freezeDuration,
          inPoint: splitAt,
          durationFrames: clip.durationFrames - splitRelativeFrame,
          keyframes: { ...clip.keyframes },
        };

        const newClips = [...t.clips];
        newClips.splice(idx, 1, clip1, freezeClip, clip2);
        return { ...t, clips: newClips };
      });
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  // ---- Track actions ----
  addTrack: (type) => {
    pushHistorySnapshot(get().tracks);
    set((s) => ({
      tracks: [...s.tracks, {
        id: nextTrackId(),
        type,
        name: type === 'video' ? `Video ${s.tracks.filter(t => t.type === 'video').length + 1}`
          : type === 'audio' ? `Audio ${s.tracks.filter(t => t.type === 'audio').length + 1}`
          : `Text ${s.tracks.filter(t => t.type === 'text').length + 1}`,
        muted: false,
        solo: false,
        visible: true,
        locked: false,
        clips: [],
      }],
      isDirty: true,
    }));
  },

  removeTrack: (trackId) => {
    pushHistorySnapshot(get().tracks);
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      isDirty: true,
    }));
  },

  reorderTrack: (sourceTrackId, targetTrackId) => {
    pushHistorySnapshot(get().tracks);
    set((s) => {
      const sourceIdx = s.tracks.findIndex(t => t.id === sourceTrackId);
      const targetIdx = s.tracks.findIndex(t => t.id === targetTrackId);
      if (sourceIdx === -1 || targetIdx === -1) return s;
      const newTracks = [...s.tracks];
      const [removed] = newTracks.splice(sourceIdx, 1);
      newTracks.splice(targetIdx, 0, removed);
      return { tracks: newTracks, isDirty: true };
    });
  },

  toggleTrackMute: (trackId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
      isDirty: true,
    }));
  },

  toggleTrackSolo: (trackId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
      ),
      isDirty: true,
    }));
  },

  toggleTrackVisibility: (trackId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, visible: !t.visible } : t
      ),
      isDirty: true,
    }));
  },

  toggleTrackLocked: (trackId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      ),
      isDirty: true,
    }));
  },

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  renameTrack: (trackId, name) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, name } : t
      ),
      isDirty: true,
    }));
  },

  // ---- Multi-clip ----
  addClipFromLibrary: async (trackId, photo) => {
    const state = get();
    const fps = photo.fps ?? state.projectFps;
    const duration = photo.duration ?? 5;

    // Analyze clip via backend
    let clipAnalysis: { clip_id: number; source_path: string; duration: number; fps?: number } | null = null;
    try {
      const res = await fetch(`${API_BASE}/api/v1/nle/clips/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photo.id, source_path: photo.path }),
      });
      if (!res.ok) throw new Error(`Failed to analyze video clip: ${res.status} ${res.statusText}`);
      clipAnalysis = await res.json();
    } catch (e) {
      console.error('Failed to analyze video clip:', e);
      return;
    }

    const clipDuration = clipAnalysis?.duration ?? duration;
    const clipFps = clipAnalysis?.fps ?? fps;

    // Find the end of existing clips on this track
    const track = state.tracks.find((t) => t.id === trackId);
    let startFrame = 0;
    if (track && track.clips.length > 0) {
      const lastClip = track.clips.reduce((latest, c) =>
        (c.startFrame + c.durationFrames) > (latest.startFrame + latest.durationFrames) ? c : latest
      );
      startFrame = lastClip.startFrame + lastClip.durationFrames;
    }

    const clip: Clip = {
      id: nextClipId(),
      sourceId: clipAnalysis?.clip_id ?? photo.id,
      sourcePath: clipAnalysis?.source_path ?? photo.path,
      proxyPath: (clipAnalysis as any)?.proxy_path,
      sourceDuration: clipDuration,
      startFrame,
      durationFrames: Math.round(clipDuration * clipFps),
      inPoint: 0,
      outPoint: clipDuration,
      speed: 1.0,
      volume: 1.0,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      effects: { ...DEFAULT_EFFECTS },
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: {},
    };

    pushHistorySnapshot(get().tracks);
    set((s) => {
      const tracks = s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      );
      return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  // ---- Playback ----
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time) => set({ playheadPosition: time }),

  // ---- Selection ----
  selectClip: (clipId) => set({ selectedClipId: clipId }),

  // ---- Bookmarks ----
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

  // ---- Link / Unlink ----
  linkClips: (clipIdA, clipIdB) => {
    // Store linked-clip pairs via a convention: both clips get a `linkedId`
    // pointing to a shared group id.
    const groupId = `link_${Date.now()}`;
    pushHistorySnapshot(get().tracks);
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id === clipIdA || c.id === clipIdB) {
            return { ...c, linkedId: groupId } as Clip;
          }
          return c;
        }),
      })),
      isDirty: true,
    }));
  },

  unlinkClip: (clipId) => {
    pushHistorySnapshot(get().tracks);
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id === clipId) {
            const { linkedId: _, ...rest } = c as Clip & { linkedId?: string };
            return rest as Clip;
          }
          return c;
        }),
      })),
      isDirty: true,
    }));
  },

  // ---- Subtitles ----
  generateSubtitles: async (trackId, sourcePath) => {
    const state = get();
    const fps = state.projectFps;
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/subtitles/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath }),
      });
      if (!res.ok) throw new Error(`Subtitle generation failed: ${res.status}`);
      const data = await res.json();
      const segments: Array<{ start: number; end: number; text: string }> = data.subtitles ?? [];

      if (segments.length === 0) return;

      pushHistorySnapshot(state.tracks);

      const subtitleClips: Clip[] = segments.map((seg, i) => ({
        id: nextClipId(),
        sourceId: 0,
        sourcePath: '',
        sourceDuration: seg.end - seg.start,
        startFrame: Math.round(seg.start * fps),
        durationFrames: Math.round((seg.end - seg.start) * fps),
        inPoint: 0,
        outPoint: seg.end - seg.start,
        speed: 1.0,
        volume: 1.0,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        effects: { ...DEFAULT_EFFECTS },
        transform: { ...DEFAULT_TRANSFORM },
        keyframes: {},
        text: {
          text: seg.text,
          fontSize: 24,
          fontFamily: 'sans-serif',
          fontColor: '#ffffff',
          x: 0,
          y: 0,
          start: seg.start,
          end: seg.end,
        },
      }));

      set((s) => {
        const tracks = s.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, ...subtitleClips] } : t
        );
        return { tracks, duration: computeDuration(tracks, s.projectFps), isDirty: true };
      });
    } catch (e) {
      console.error('Failed to generate subtitles:', e);
    }
  },

  // ---- UI ----
  setExportDialogOpen: (open) => set({ isExportDialogOpen: open }),
  setZoomLevel: (level) => set({ zoomLevel: Math.max(10, Math.min(500, level)) }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setClipboardClip: (clip) => set({ clipboardClip: clip }),

  // ---- Project Assets ----
  addProjectAsset: (asset) => set((s) => {
    // Avoid duplicates
    if (s.projectAssets.some((a) => a.id === asset.id && a.type === asset.type)) return s;
    return { projectAssets: [...s.projectAssets, asset] };
  }),

  removeProjectAsset: (assetId) => set((s) => ({
    projectAssets: s.projectAssets.filter((a) => a.id !== assetId),
  })),

  // ---- Undo/Redo ----
  pushHistory: () => {
    const { tracks } = get();
    pushHistorySnapshot(tracks);
  },

  undo: () => {
    const snapshot = undoSnapshot();
    if (snapshot) {
      set((s) => ({
        tracks: snapshot,
        duration: computeDuration(snapshot, s.projectFps),
        isDirty: true,
        selectedClipId: null,
        selectedTrackId: null,
      }));
    }
  },

  redo: () => {
    const snapshot = redoSnapshot();
    if (snapshot) {
      set((s) => ({
        tracks: snapshot,
        duration: computeDuration(snapshot, s.projectFps),
        isDirty: true,
        selectedClipId: null,
        selectedTrackId: null,
      }));
    }
  },

  canUndo: () => canUndo(),
  canRedo: () => canRedo(),

  // ---- Computed ----
  getSelectedClip: () => {
    const { tracks, selectedClipId } = get();
    if (!selectedClipId) return null;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  },

  getTimelineDuration: () => {
    const s = get();
    return computeDuration(s.tracks, s.projectFps);
  },

  toProjectJson: () => {
    const s = get();
    return {
      tracks: s.tracks,
      duration: computeDuration(s.tracks, s.projectFps),
      playheadPosition: s.playheadPosition,
      zoomLevel: s.zoomLevel,
      scrollOffset: s.scrollOffset,
      fps: s.projectFps,
      resolution: { w: s.projectWidth, h: s.projectHeight },
      projectAssets: s.projectAssets,
    };
  },
}));
