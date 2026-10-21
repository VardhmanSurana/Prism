/**
 * chalkUtils.ts
 * Procedural parameters and presets for the Chalk brush texture filter.
 */

export interface ChalkFilterValues {
  /** Fractal noise frequency (grain scale) */
  baseFreq: string;
  /** Displacement scale (edge crumble / roughness) */
  scale: number;
  /** Color matrix cutoff offset (pressure / coverage density) */
  offset: string;
}

export interface ChalkPreset {
  name: string;
  pressure: number;
  grain: number;
  roughness: number;
  description: string;
}

export const CHALK_PRESETS: ChalkPreset[] = [
  {
    name: 'Soft Dust',
    pressure: 45,
    grain: 85,
    roughness: 25,
    description: 'Fine powdery dust with gentle edge crumble',
  },
  {
    name: 'Blackboard',
    pressure: 60,
    grain: 50,
    roughness: 50,
    description: 'Classic school chalkboard stick',
  },
  {
    name: 'Sidewalk',
    pressure: 75,
    grain: 20,
    roughness: 80,
    description: 'Heavy coarse grit on rough asphalt',
  },
];

/**
 * Computes SVG filter attribute values from 0-100 percentage inputs:
 * - pressure: 0% -> -0.52 (faint, valleys exposed), 60% -> -0.22 (default), 100% -> -0.02 (solid)
 * - grain: 0% -> 0.34 (chunky grit), 50% -> 0.68 (default), 100% -> 1.02 (fine dust)
 * - roughness: 0% -> 0 (clean borders), 50% -> 4.2 (default), 100% -> 8.4 (rugged)
 */
export function getChalkFilterValues(
  pressure: number = 60,
  grain: number = 50,
  roughness: number = 50
): ChalkFilterValues {
  const clampedPressure = Math.max(0, Math.min(100, pressure));
  const offsetNum = -0.52 + (clampedPressure / 100) * 0.50;
  const offset = offsetNum.toFixed(2);

  const clampedGrain = Math.max(0, Math.min(100, grain));
  const freqNum = 0.34 + (clampedGrain / 100) * 0.68;
  const baseFreq = freqNum.toFixed(2);

  const clampedRoughness = Math.max(0, Math.min(100, roughness));
  const scale = Number(((clampedRoughness / 100) * 8.4).toFixed(1));

  return {
    baseFreq,
    scale,
    offset,
  };
}

