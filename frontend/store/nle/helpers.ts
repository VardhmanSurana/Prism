let _clipCounter = 0;

export function nextClipId(): string {
  return `clip_${Date.now()}_${++_clipCounter}`;
}

export function nextTrackId(): string {
  return `track_${Date.now()}_${++_clipCounter}`;
}

export const MAX_HISTORY = 30;

export interface ClipLike {
  id: string;
}

export interface TrackLike<C extends ClipLike = ClipLike> {
  clips: C[];
}

/**
 * O(n) scan for a clip by id across tracks. Returns the clip's existing
 * reference (no copy), so callers subscribing to it via `useNLEStore` bail
 * on unrelated store writes via zustand's default shallow-equal compare.
 */
export function findClipById<C extends ClipLike>(
  tracks: TrackLike<C>[],
  clipId: string | null | undefined,
): C | null {
  if (!clipId) return null;
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}
