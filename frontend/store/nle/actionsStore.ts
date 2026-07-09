import { StateCreator } from 'zustand';
import { NLEStore, ProjectAsset } from './types';
import { Photo } from '@/types';
import { apiClient } from '@/services/apiClient';
import { Clip, DEFAULT_EFFECTS, DEFAULT_TRANSFORM, Track } from '@/types/nle';

export interface ActionsSlice {
  importPhotoToTrack: (trackId: string, photo: Photo, insertAtTime?: number) => Promise<void>;
  addClipFromLibrary: (trackId: string, photo: any) => Promise<void>;
  generateSubtitles: (trackId: string, sourcePath: string) => Promise<void>;
  getSelectedClip: () => Clip | null;
  getTimelineDuration: () => number;
  linkClips: (clipIdA: string, clipIdB: string) => void;
  unlinkClip: (clipId: string) => void;
}

export const createActionsSlice: StateCreator<NLEStore, [], [], ActionsSlice> = (set, get) => ({
  importPhotoToTrack: async (trackId, photo, insertAtTime) => { return get().addClipFromLibrary(trackId, photo); },
  addClipFromLibrary: async (trackId, photo) => { const insertAtTime = get().playheadPosition;

    const state = get();
    const isVideo = photo.mime_type?.startsWith('video/');
    const duration = photo.duration ?? 5;

    // Analyze clip via backend
    let clipAnalysis: { clip_id: number; source_path: string; duration: number; fps?: number } | null = null;
    try {
      clipAnalysis = await apiClient.post(`/api/v1/nle/clips/analyze`, { photo_id: photo.id, source_path: photo.path });
    } catch (e) {
      console.error('Failed to analyze video clip:', e);
      return;
    }

    if (!clipAnalysis) return;

    // Check if asset is already in project, add if not
    const assetId = clipAnalysis.clip_id;
    if (!state.projectAssets.some((a: ProjectAsset) => a.id === assetId)) {
      state.addProjectAsset({
        id: assetId,
        path: clipAnalysis.source_path,
        type: isVideo ? 'video' : 'image',
        duration: clipAnalysis.duration,
        filename: photo.filename ?? 'unknown',
        thumbnailUrl: (photo as any).thumbnail_url
      });
    }

    const start = insertAtTime ?? state.playheadPosition;

    // Shift clips right to make room
    state.pushHistory();
    const newTracks = state.tracks.map((t: Track) => {
      if (t.id === trackId) {
        return {
          ...t,
          clips: t.clips.map((c: Clip) => {
            if ((c as any).startFrame >= start) {
              return {
                ...c,
                startFrame: (c as any).startFrame + duration,
                endFrame: (c as any).endFrame + duration
              };
            }
            return c;
          }),
        };
      }
      return t;
    });

    // Create new clip
    const newClip = {
      id: `clip_${Date.now()}`,
      assetId,
      trackId,
      sourceStartFrame: 0,
      sourceEndFrame: duration,
      startFrame: start,
      endFrame: start + duration,
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)),
      transform: JSON.parse(JSON.stringify(DEFAULT_TRANSFORM)),
      metadata: {
        filename: photo.filename,
        fps: clipAnalysis.fps,
        hasAudio: isVideo,
      }
    } as any as Clip;

    // Add clip to track
    const targetTrackIdx = newTracks.findIndex((t: Track) => t.id === trackId);
    if (targetTrackIdx !== -1) {
      newTracks[targetTrackIdx].clips.push(newClip);
    }

    set({ tracks: newTracks, isDirty: true });
  },

  generateSubtitles: async (trackId, sourcePath) => {
    const state = get();
    try {
      const data: any = await apiClient.post(`/api/v1/video/subtitles/generate`, { source_path: sourcePath });
      const segments: Array<{ start: number; end: number; text: string }> = data.subtitles ?? [];

      if (segments.length === 0) return;

      state.pushHistory();

      // Create new subtitle track
      const subTrackId = `subtitle_${Date.now()}`;
      const newTrack = {
        id: subTrackId,
        name: 'Subtitles',
        type: 'subtitle' as const,
        clips: [],
        locked: false,
        hidden: false,
        opacity: 100,
      } as any as Track;

      const newClips = segments.map((seg, i) => {
        const duration = seg.end - seg.start;
        return {
          id: `subclip_${Date.now()}_${i}`,
          assetId: -1,
          trackId: subTrackId,
          sourceStartFrame: 0,
          sourceEndFrame: duration,
          startFrame: seg.start,
          endFrame: seg.end,
          text: seg.text,
          effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)),
          transform: JSON.parse(JSON.stringify(DEFAULT_TRANSFORM)),
        } as any as Clip;
      });

      newTrack.clips = newClips;

      set({
        tracks: [newTrack, ...state.tracks],
        isDirty: true
      });
    } catch (e) {
      console.error('Failed to generate subtitles:', e);
    }
  },

  getSelectedClip: () => {
    const state = get();
    if (!state.selectedClipId) return null;
    for (const track of state.tracks) {
      const clip = track.clips.find((c: Clip) => c.id === state.selectedClipId);
      if (clip) return clip;
    }
    return null;
  },

  getTimelineDuration: () => {
    const state = get();
    let maxEnd = 0;
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if ((clip as any).endFrame > maxEnd) maxEnd = (clip as any).endFrame;
      }
    }
    return maxEnd;
  },

  linkClips: (clipIdA, clipIdB) => {
    set(state => {
      const groupId = `group_${Date.now()}`;
      return {
        tracks: state.tracks.map((t: Track) => ({
          ...t,
          clips: t.clips.map((c: Clip) =>
            (c.id === clipIdA || c.id === clipIdB)
              ? { ...c, linkedGroupId: (c as any).linkedGroupId ?? groupId }
              : c
          )
        })),
        isDirty: true
      };
    });
  },

  unlinkClip: (clipId) => {
    set(state => ({
      tracks: state.tracks.map((t: Track) => ({
        ...t,
        clips: t.clips.map((c: Clip) =>
          c.id === clipId
            ? { ...c, linkedGroupId: undefined }
            : c
        )
      })),
      isDirty: true
    }));
  }
});
