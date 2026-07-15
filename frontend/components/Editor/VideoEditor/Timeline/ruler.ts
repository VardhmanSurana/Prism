const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;
const SECOND_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;
const MIN_LABEL_SPACING_PX = 120;
const MIN_TICK_SPACING_PX = 18;

export function getRulerConfig(pixelsPerSec: number, fps: number) {
  const pixelsPerFrame = pixelsPerSec / fps;
  let labelIntervalSeconds = 60;
  for (const frameInterval of LABEL_FRAME_INTERVALS) {
    if (pixelsPerFrame * frameInterval >= MIN_LABEL_SPACING_PX) {
      labelIntervalSeconds = frameInterval / fps;
      break;
    }
  }
  if (labelIntervalSeconds === 60) {
    for (const secondMultiplier of SECOND_MULTIPLIERS) {
      if (pixelsPerSec * secondMultiplier >= MIN_LABEL_SPACING_PX) {
        labelIntervalSeconds = secondMultiplier;
        break;
      }
    }
  }

  let rawTickIntervalSeconds = 60;
  for (const frameInterval of TICK_FRAME_INTERVALS) {
    if (pixelsPerFrame * frameInterval >= MIN_TICK_SPACING_PX) {
      rawTickIntervalSeconds = frameInterval / fps;
      break;
    }
  }
  if (rawTickIntervalSeconds === 60) {
    for (const secondMultiplier of SECOND_MULTIPLIERS) {
      if (pixelsPerSec * secondMultiplier >= MIN_TICK_SPACING_PX) {
        rawTickIntervalSeconds = secondMultiplier;
        break;
      }
    }
  }

  let tickIntervalSeconds = rawTickIntervalSeconds;
  const labelFrames = Math.round(labelIntervalSeconds * fps);
  const tickFrames = Math.round(tickIntervalSeconds * fps);
  if (labelFrames % tickFrames !== 0) {
    for (const candidateFrames of TICK_FRAME_INTERVALS) {
      if (labelFrames % candidateFrames === 0 && pixelsPerFrame * candidateFrames >= MIN_TICK_SPACING_PX) {
        tickIntervalSeconds = candidateFrames / fps;
        return { labelIntervalSeconds, tickIntervalSeconds };
      }
    }
    for (const candidateSeconds of SECOND_MULTIPLIERS) {
      const ratio = labelIntervalSeconds / candidateSeconds;
      if (Math.abs(ratio - Math.round(ratio)) < 0.0001 && pixelsPerSec * candidateSeconds >= MIN_TICK_SPACING_PX) {
        tickIntervalSeconds = candidateSeconds;
        return { labelIntervalSeconds, tickIntervalSeconds };
      }
    }
    tickIntervalSeconds = labelIntervalSeconds;
  }

  return { labelIntervalSeconds, tickIntervalSeconds };
}

export function formatRulerLabel(timeInSeconds: number, fps: number): string {
  const epsilon = 0.0001;
  const remainder = timeInSeconds % 1;
  if (remainder < epsilon || remainder > 1 - epsilon) {
    const totalSeconds = Math.round(timeInSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  return `${Math.round(remainder * fps)}f`;
}
