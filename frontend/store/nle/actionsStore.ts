import { StateCreator } from 'zustand';
import { NLEStore } from './types';
import { Clip, Track, DEFAULT_EFFECTS, DEFAULT_TRANSFORM } from '@/types/nle';
import { apiClient } from '@/services/apiClient';
import { clipsOverlap, computeTimelineDuration } from './timelineMath';
import { nextClipId } from './helpers';

export interface ActionsSlice {
  addClipFromLibrary: (
    trackId: string,
    photo: { id: number; path: string; filename?: string; duration?: number; width?: number; height?: number; fps?: number }
  ) => Promise<void>;
  linkClips: (clipIdA: string, clipIdB: string) => void;
  unlinkClip: (clipId: string) => void;
  generateSubtitles: (trackId: string, sourcePath: string) => Promise<void>;
  getSelectedClip: () => Clip | null;
  getTimelineDuration: () => number;
}

export const createActionsSlice: StateCreator<NLEStore, [], [], ActionsSlice> = (set, get) => ({
  addClipFromLibrary: async (trackId, photo) => {
    const state = get();
    const fps = photo.fps ?? state.projectFps;
    const duration = photo.duration ?? 5;

    let clipAnalysis: { clip_id: number; source_path: string; duration: number; fps?: number } | null = null;
    try {
      clipAnalysis = await apiClient.post(`/api/v1/nle/clips/analyze`, { photo_id: photo.id, source_path: photo.path });
    } catch (e) {
      console.error('Failed to analyze video clip:', e);
      return;
    }

    const clipDuration = clipAnalysis?.duration ?? duration;
    const clipFps = clipAnalysis?.fps ?? fps;

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

    get().pushHistory();
    set((s) => {
      const tracks = s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      );
      return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
    });
  },

  linkClips: (clipIdA, clipIdB) => {
    const groupId = `link_${Date.now()}`;
    get().pushHistory();
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
    get().pushHistory();
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

  generateSubtitles: async (trackId, sourcePath) => {
    const state = get();
    const fps = state.projectFps;
    try {
      const data: any = await apiClient.post(`/api/v1/video/subtitles/generate`, { source_path: sourcePath });
      const segments: Array<{ start: number; end: number; text: string }> = data.subtitles ?? [];

      if (segments.length === 0) return;

      get().pushHistory();

      const subtitleClips: Clip[] = segments.map((seg) => ({
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
        return { tracks, duration: computeTimelineDuration(tracks, s.projectFps), isDirty: true };
      });
    } catch (e) {
      console.error('Failed to generate subtitles:', e);
    }
  },

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
    return computeTimelineDuration(s.tracks, s.projectFps);
  },
});
