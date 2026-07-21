import type { Clip, Track } from '@/types/nle';

export function getActiveVideoClips(tracks: Track[], playheadPosition: number, fps: number): Clip[] {
  const frame = Math.round(playheadPosition * fps);
  const active = tracks.flatMap((t) =>
    t.visible && t.type === 'video' ? t.clips.filter((c) => frame >= c.startFrame && frame < c.startFrame + c.durationFrames) : []
  );
  if (active.length > 0) return active;

  const videoClips = tracks.filter((t) => t.type === 'video').flatMap((t) => t.clips);
  const prev = videoClips.filter((c) => c.startFrame < frame).sort((a, b) => b.startFrame - a.startFrame)[0];
  return prev ? [prev] : [];
}

export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}
