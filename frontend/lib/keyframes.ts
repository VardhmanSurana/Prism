import type { Keyframe, BezierCP } from '@/types/nle';

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function sampleBezier(cp: BezierCP, t: number): number {
  const x1 = cp.x1, y1 = cp.y1, x2 = cp.x2, y2 = cp.y2;
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (cubicBezier(mid, 0, x1, x2, 1) < t) lo = mid;
    else hi = mid;
  }
  return cubicBezier((lo + hi) / 2, 0, y1, y2, 1);
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return t * (2 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function interpolateSegment(a: Keyframe, b: Keyframe, t: number): number {
  const progress = (t - a.t) / (b.t - a.t);
  switch (b.interpolation) {
    case 'linear':
      return a.v + (b.v - a.v) * progress;
    case 'ease-in':
      return a.v + (b.v - a.v) * easeIn(progress);
    case 'ease-out':
      return a.v + (b.v - a.v) * easeOut(progress);
    case 'ease-in-out':
      return a.v + (b.v - a.v) * easeInOut(progress);
    case 'bezier':
      if (b.bezierCP) {
        return a.v + (b.v - a.v) * sampleBezier(b.bezierCP, progress);
      }
      return a.v + (b.v - a.v) * progress;
    default:
      return a.v + (b.v - a.v) * progress;
  }
}

export function evaluateKeyframes(keyframes: Keyframe[], time: number): number {
  if (keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (time <= sorted[0].t) return sorted[0].v;
  if (time >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].t && time <= sorted[i + 1].t) {
      return interpolateSegment(sorted[i], sorted[i + 1], time);
    }
  }
  return sorted[sorted.length - 1].v;
}


export function splitKeyframes(
  kfs: Record<string, Keyframe[]>,
  t: number,
): { before: Record<string, Keyframe[]>; after: Record<string, Keyframe[]> } {
  const before: Record<string, Keyframe[]> = {};
  const after: Record<string, Keyframe[]> = {};
  for (const prop of Object.keys(kfs)) {
    const b: Keyframe[] = [];
    const a: Keyframe[] = [];
    for (const kf of kfs[prop]) {
      if (kf.t <= t) b.push(kf);
      else a.push(kf);
    }
    before[prop] = b;
    after[prop] = a;
  }
  return { before, after };
}

export function shiftKeyframes(
  kfs: Record<string, Keyframe[]>,
  delta: number,
): Record<string, Keyframe[]> {
  const result: Record<string, Keyframe[]> = {};
  for (const prop of Object.keys(kfs)) {
    result[prop] = kfs[prop].map((kf) => ({ ...kf, t: kf.t + delta }));
  }
  return result;
}
