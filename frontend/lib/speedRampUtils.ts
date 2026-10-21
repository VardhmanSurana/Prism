/**
 * speedRampUtils.ts — Dynamic speed ramping and variable time remapping.
 * Calculates frame-accurate source playback time by integrating keyframed speed values over time.
 */

import type { Keyframe } from '@/types/nle';
import { evaluateKeyframes } from '@/lib/keyframes';

export type SpeedRampPresetType = 'hero' | 'fast' | 'bullet' | 'accelerate';

/**
 * Evaluates the instantaneous speed at a given relative timeline offset.
 */
export function getCurrentSpeedAtTime(
  speedKeyframes: Keyframe[] | undefined,
  baseSpeed: number,
  relativeTime: number
): number {
  if (!speedKeyframes || speedKeyframes.length === 0) {
    return baseSpeed;
  }
  const speed = evaluateKeyframes(speedKeyframes, relativeTime);
  return Math.max(0.05, speed); // Minimum 0.05x playback rate to avoid static freezing
}

/**
 * Computes source time for a given relative timeline position t (in seconds),
 * accounting for speed keyframes or a constant base speed.
 *
 * sourceTime = inPoint + integral_0^t (speed(tau) dtau)
 */
export function calculateRampedSourceTime(
  speedKeyframes: Keyframe[] | undefined,
  baseSpeed: number,
  inPoint: number,
  relativeTime: number
): number {
  if (relativeTime <= 0) return inPoint;

  if (!speedKeyframes || speedKeyframes.length === 0) {
    return Math.max(0, inPoint + relativeTime * baseSpeed);
  }

  // Numerical integration over relativeTime using Simpson's/Midpoint rule
  const STEPS = 32;
  const dt = relativeTime / STEPS;
  let accumulated = 0;

  for (let i = 0; i < STEPS; i++) {
    const tMid = (i + 0.5) * dt;
    const currentSpeed = getCurrentSpeedAtTime(speedKeyframes, baseSpeed, tMid);
    accumulated += currentSpeed * dt;
  }

  return Math.max(0, inPoint + accumulated);
}

/**
 * Generate standard speed ramping keyframe presets relative to clip duration.
 */
export function getSpeedRampPreset(presetType: SpeedRampPresetType, clipDuration: number): Keyframe[] {
  const dur = Math.max(0.5, clipDuration);
  switch (presetType) {
    case 'hero': // 1.0x -> 0.25x (slow-mo center) -> 1.0x
      return [
        { t: 0, v: 1.0, interpolation: 'ease-out' },
        { t: dur * 0.35, v: 0.25, interpolation: 'ease-in-out' },
        { t: dur * 0.65, v: 0.25, interpolation: 'ease-in' },
        { t: dur, v: 1.0, interpolation: 'linear' },
      ];
    case 'fast': // 1.0x -> 3.5x (fast burst) -> 1.0x
      return [
        { t: 0, v: 1.0, interpolation: 'ease-out' },
        { t: dur * 0.4, v: 3.5, interpolation: 'ease-in-out' },
        { t: dur * 0.6, v: 3.5, interpolation: 'ease-in' },
        { t: dur, v: 1.0, interpolation: 'linear' },
      ];
    case 'bullet': // 1.0x -> 0.1x (extreme slow-mo) -> 1.0x
      return [
        { t: 0, v: 1.0, interpolation: 'ease-out' },
        { t: dur * 0.3, v: 0.1, interpolation: 'ease-in-out' },
        { t: dur * 0.7, v: 0.1, interpolation: 'ease-in' },
        { t: dur, v: 1.0, interpolation: 'linear' },
      ];
    case 'accelerate': // 0.5x -> 4.0x (ramp up)
      return [
        { t: 0, v: 0.5, interpolation: 'ease-in' },
        { t: dur * 0.5, v: 1.5, interpolation: 'ease-in-out' },
        { t: dur, v: 4.0, interpolation: 'linear' },
      ];
  }
}
