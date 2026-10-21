/**
 * math.ts
 * Mathematical curve evaluation and particle position utilities.
 */

export function normalizeProgress(progress: number): number {
  return ((progress % 1) + 1) % 1;
}

export function getDetailScale(time: number, config: { pulseDurationMs: number }, phaseOffset = 0): number {
  const pulseProgress = ((time + phaseOffset * config.pulseDurationMs) % config.pulseDurationMs) / config.pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
}

export function getRotation(time: number, config: { rotate: boolean; rotationDurationMs: number }, phaseOffset = 0): number {
  if (!config.rotate) return 0;
  return -(((time + phaseOffset * config.rotationDurationMs) % config.rotationDurationMs) / config.rotationDurationMs) * 360;
}

export function buildPath(
  curve: { point: (progress: number, detailScale: number) => { x: number; y: number } },
  detailScale: number,
  steps = 360
): string {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const p = curve.point(index / steps, detailScale);
    return `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(' ');
}

export function getParticle(
  curve: {
    particleCount: number;
    trailSpan: number;
    point: (progress: number, detailScale: number) => { x: number; y: number };
  },
  index: number,
  progress: number,
  detailScale: number
) {
  const tailOffset = index / (curve.particleCount - 1);
  const p = curve.point(normalizeProgress(progress - tailOffset * curve.trailSpan), detailScale);
  const fade = Math.pow(1 - tailOffset, 0.56);

  return {
    x: p.x,
    y: p.y,
    radius: 0.9 + fade * 2.7,
    opacity: 0.04 + fade * 0.96,
  };
}

