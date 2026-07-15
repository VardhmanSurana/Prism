import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Clip, Track, ClipEffects, ClipTransform, Transition, Keyframe } from '@/types/nle';
import { clipsOverlap, computeTimelineDuration } from './timelineMath';
import { nextClipId, nextTrackId } from './helpers';
import { splitKeyframes, shiftKeyframes } from '@/lib/keyframes';

export interface TimelineSlice {
  tracks: Track[];
  duration: number;

  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartFrame: number, newTrackId?: string) => void;
  splitClip: (clipId: string, atTime: number) => void;
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

  addTrack: (type: 'video' | 'audio' | 'text') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (sourceTrackId: string, targetTrackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLocked: (trackId: string) => void;
  selectTrack: (trackId: string | null) => void;
  renameTrack: (trackId: string, name: string) => void;
}

export const createTimelineSlice: StateCreator<NLEStore, [], [], TimelineSlice> = (set, get) => ({
  tracks: [],
  duration: 0,

  addClip: (trackId, clip) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (track?.locked) return;
    get().pushHistory();
    set((s) => {
      const tracks = s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      );
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  removeClip: (clipId) => {
    get().pushHistory();
    set((s) => {
      const tracks = s.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }));
      return {
        tracks,
        duration: computeTimelineDuration(tracks, s.projectFps),
        isDirty: true,
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      };
    });
  },

  moveClip: (clipId, newStartFrame, newTrackId) => {
    get().pushHistory();
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
          let snappedFrame = movedClip.startFrame;
          if (s.snapEnabled) {
            const SNAP_THRESHOLD = 5;
            const snapPoints: number[] = [0];
            snapPoints.push(Math.round(s.playheadPosition * s.projectFps));
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
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  splitClip: (clipId, atTime) => {
    get().pushHistory();
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
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  trimClip: (clipId, side, newFrame) => {
    get().pushHistory();
    set((s) => {
      let trimmedClip: Clip | null = null;
      let targetTrackId: string | null = null;
      let targetTrackIndex = -1;

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

      const targetTrack = s.tracks[targetTrackIndex];
      const hasOverlap = targetTrack.clips.some((c) => {
        if (c.id === clipId) return false;
        return clipsOverlap(trimmedClip!, c);
      });
      if (hasOverlap) return {};

      const tracks = s.tracks.map((t) => {
        if (t.id !== targetTrackId) return t;
        const newClips = t.clips.map((c) => c.id === clipId ? trimmedClip! : c);
        return { ...t, clips: newClips };
      });
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

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

        const freezeDuration = 2 * s.projectFps;
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
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  addTrack: (type) => {
    get().pushHistory();
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
    get().pushHistory();
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      isDirty: true,
    }));
  },

  reorderTrack: (sourceTrackId, targetTrackId) => {
    get().pushHistory();
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
});
