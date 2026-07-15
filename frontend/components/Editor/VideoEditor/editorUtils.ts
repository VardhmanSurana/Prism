import type { Clip, Track } from '@/types/nle';

export function getActiveVideoClips(tracks: Track[], playheadPosition: number, fps: number): Clip[] {
  const playheadFrame = Math.round(playheadPosition * fps);
  const active = tracks.flatMap((track) =>
    !track.visible || track.type !== 'video'
      ? []
      : track.clips.filter((clip) => playheadFrame >= clip.startFrame && playheadFrame < clip.startFrame + clip.durationFrames),
  );
  if (active.length > 0) return active;

  let previous: Clip | null = null;
  for (const track of tracks) {
    if (track.type !== 'video') continue;
    for (const clip of track.clips) {
      if (clip.startFrame < playheadFrame && (!previous || clip.startFrame > previous.startFrame)) previous = clip;
    }
  }
  return previous ? [previous] : [];
}

export function formatTimecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secondsPart = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${minutes}:${String(secondsPart).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}
