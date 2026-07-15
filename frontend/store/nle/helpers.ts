let _clipCounter = 0;

export function nextClipId(): string {
  return `clip_${Date.now()}_${++_clipCounter}`;
}

export function nextTrackId(): string {
  return `track_${Date.now()}_${++_clipCounter}`;
}

export const MAX_HISTORY = 30;
