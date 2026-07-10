import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Clip, Track, ClipEffects, ClipTransform, Transition, Keyframe } from '@/types/nle';
import { splitKeyframes } from '@/lib/keyframes';

export interface TimelineSlice {
  addTrack: (type: 'video' | 'audio' | 'text') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (sourceTrackId: string, targetTrackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLocked: (trackId: string) => void;
  selectTrack: (trackId: string | null) => void;
  renameTrack: (trackId: string, name: string) => void;

  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartFrame: number, newTrackId?: string) => void;
  splitClip: (clipId: string, frame: number) => void;
  trimClip: (clipId: string, side: 'in' | 'out', newFrame: number) => void;

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

  updateClipEffects: (clipId: string, updates: Partial<ClipEffects>) => void;
  updateClipTransform: (clipId: string, updates: Partial<ClipTransform>) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
}

export const createTimelineSlice: StateCreator<NLEStore, [], [], TimelineSlice> = (set, get) => ({
  addTrack: (type) => {
    set((state) => {
      state.pushHistory();
      const numType = state.tracks.filter((t: Track) => t.type === type).length + 1;
      const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : 'T';
      return {
        tracks: [
          {
            id: `${prefix.toLowerCase()}${Date.now()}`,
            name: `${prefix}${numType}`,
            type,
            clips: [],
            locked: false,
            hidden: false,
            ...(type === 'video' ? { opacity: 100 } : { volume: 100 }),
          } as any as Track,
          ...state.tracks,
        ],
        isDirty: true,
      };
    });
  },

  removeTrack: (trackId) => {
    set((state) => {
      state.pushHistory();
      return {
        tracks: state.tracks.filter((t: Track) => t.id !== trackId),
        isDirty: true,
      };
    });
  },

  reorderTrack: (sourceTrackId, targetTrackId) => {
    set((state) => {
      state.pushHistory();
      const newTracks = [...state.tracks];
      const sourceIndex = newTracks.findIndex(t => t.id === sourceTrackId);
      const targetIndex = newTracks.findIndex(t => t.id === targetTrackId);
      if (sourceIndex === -1 || targetIndex === -1) return state;

      const [removed] = newTracks.splice(sourceIndex, 1);
      newTracks.splice(targetIndex, 0, removed);
      return { tracks: newTracks, isDirty: true };
    });
  },

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, ...updates } : t)),
      isDirty: true,
    }));
  },

  toggleTrackMute: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, muted: !(t as any).muted } : t)),
      isDirty: true,
    }));
  },

  toggleTrackSolo: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, solo: !(t as any).solo } : t)),
      isDirty: true,
    }));
  },

  toggleTrackVisibility: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, hidden: !(t as any).hidden } : t)),
      isDirty: true,
    }));
  },

  toggleTrackLocked: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
      isDirty: true,
    }));
  },

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  renameTrack: (trackId, name) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => (t.id === trackId ? { ...t, name } : t)),
      isDirty: true,
    }));
  },

  addClip: (trackId, clip) => {
    set((state) => {
      state.pushHistory();
      return {
        tracks: state.tracks.map((t: Track) =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
        isDirty: true,
      };
    });
  },

  removeClip: (clipId) => {
    set((state) => {
      state.pushHistory();
      const newTracks = state.tracks.map((t: Track) => ({
        ...t,
        clips: t.clips.filter((c: Clip) => c.id !== clipId),
      }));
      return {
        tracks: newTracks,
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
        isDirty: true,
      };
    });
  },

  moveClip: (clipId, newStartFrame, newTrackId) => {
    set((state) => {
      state.pushHistory();
      let clipToMove: Clip | null = null;
      let originalTrackId: string | null = null;

      for (const t of state.tracks) {
        const found = t.clips.find((c: Clip) => c.id === clipId);
        if (found) {
          clipToMove = found;
          originalTrackId = t.id;
          break;
        }
      }

      if (!clipToMove || !originalTrackId) return state;

      const duration = (clipToMove as any).endFrame - (clipToMove as any).startFrame;
      const targetTrackId = newTrackId ?? originalTrackId;
      const updatedClip = {
        ...clipToMove,
        startFrame: newStartFrame,
        endFrame: newStartFrame + duration,
        trackId: targetTrackId
      } as Clip;

      return {
        tracks: state.tracks.map((t: Track) => {
          if (t.id === originalTrackId && t.id === targetTrackId) {
            return {
              ...t,
              clips: t.clips.map((c: Clip) => c.id === clipId ? updatedClip : c),
            };
          } else if (t.id === originalTrackId) {
            return {
              ...t,
              clips: t.clips.filter((c: Clip) => c.id !== clipId),
            };
          } else if (t.id === targetTrackId) {
            return {
              ...t,
              clips: [...t.clips, updatedClip],
            };
          }
          return t;
        }),
        isDirty: true,
      };
    });
  },

  splitClip: (clipId, frame) => {
    set((state) => {
      state.pushHistory();
      let newTracks = [...state.tracks];

      newTracks = newTracks.map(track => {
        const clipIdx = track.clips.findIndex((c: Clip) => c.id === clipId);
        if (clipIdx === -1) return track;

        const c = track.clips[clipIdx];
        if (frame <= (c as any).startFrame || frame >= (c as any).endFrame) return track;

        const splitTimeRel = frame - (c as any).startFrame;

        const leftClip: Clip = {
          ...c,
          endFrame: frame,
          sourceEndFrame: (c as any).sourceStartFrame + splitTimeRel,
          effects: { ...c.effects, ...(splitKeyframes(c.effects as any, splitTimeRel) as any) },
        } as Clip;

        const rightClip: Clip = {
          ...c,
          id: `clip_${Date.now()}`,
          startFrame: frame,
          sourceStartFrame: (c as any).sourceStartFrame + splitTimeRel,
          effects: { ...c.effects, ...(splitKeyframes(c.effects as any, splitTimeRel) as any) },
        } as Clip;

        const updatedClips = [...track.clips];
        updatedClips.splice(clipIdx, 1, leftClip, rightClip);
        return { ...track, clips: updatedClips };
      });

      return { tracks: newTracks, isDirty: true };
    });
  },

  trimClip: (clipId, side, newFrame) => {
    set((state) => {
      state.pushHistory();
      return {
        tracks: state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            if (c.id !== clipId) return c;
            const start = (c as any).startFrame;
            const end = (c as any).endFrame;

            if (side === 'in') {
              const diff = newFrame - start;
              return {
                ...c,
                startFrame: newFrame,
                sourceStartFrame: (c as any).sourceStartFrame + diff
              } as Clip;
            } else {
              const diff = newFrame - end;
              return {
                ...c,
                endFrame: newFrame,
                sourceEndFrame: (c as any).sourceEndFrame + diff
              } as Clip;
            }
          })
        })),
        isDirty: true
      };
    });
  },

  updateClipEffects: (clipId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => ({
        ...t,
        clips: t.clips.map((c: Clip) =>
          c.id === clipId
            ? { ...c, effects: { ...c.effects, ...updates } }
            : c
        )
      })),
      isDirty: true
    }));
  },

  updateClipTransform: (clipId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => ({
        ...t,
        clips: t.clips.map((c: Clip) =>
          c.id === clipId
            ? { ...c, transform: { ...c.transform, ...updates } }
            : c
        )
      })),
      isDirty: true
    }));
  },

  updateClip: (clipId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t: Track) => ({
        ...t,
        clips: t.clips.map((c: Clip) =>
          c.id === clipId
            ? { ...c, ...updates }
            : c
        )
      })),
      isDirty: true
    }));
  },

  setClipSpeed: (clipId, speed) => get().updateClip(clipId, { speed } as any),
  setClipVolume: (clipId, volume) => get().updateClip(clipId, { volume } as any),
  setClipMuted: (clipId, muted) => get().updateClip(clipId, { muted } as any),
  setClipEffects: (clipId, effects) => get().updateClipEffects(clipId, effects),
  setClipFadeIn: (clipId, duration) => get().updateClip(clipId, { fadeIn: duration } as any),
  setClipFadeOut: (clipId, duration) => get().updateClip(clipId, { fadeOut: duration } as any),
  setClipTransform: (clipId, transform) => get().updateClipTransform(clipId, transform),
  setClipTransition: (clipId, transition) => get().updateClip(clipId, { transition } as any),
  setClipKeyframes: (clipId, property, keyframes) => {
    const state = get();
    const clip = state.getSelectedClip();
    if (!clip || clip.id !== clipId) return;

    if (property in clip.transform) {
      get().updateClipTransform(clipId, { [property]: keyframes });
    } else {
      get().updateClipEffects(clipId, { [property]: keyframes });
    }
  },
  addFreezeFrame: (clipId, atTime) => {
    get().splitClip(clipId, atTime);
  },
});
