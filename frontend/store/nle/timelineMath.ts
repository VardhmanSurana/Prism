import type { Track } from '@/types/nle';

export const clipsOverlap = (
  a: { startFrame: number; durationFrames: number },
  b: { startFrame: number; durationFrames: number },
): boolean => a.startFrame < b.startFrame + b.durationFrames && b.startFrame < a.startFrame + a.durationFrames;

export const computeTimelineDuration = (tracks: Track[], fps = 30): number => {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, (clip.startFrame + clip.durationFrames) / fps);
    }
  }
  return max;
};
