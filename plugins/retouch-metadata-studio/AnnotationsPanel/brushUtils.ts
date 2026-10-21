/**
 * brushUtils.ts
 * Procedural parameters, presets, and filter calculation for all MS Paint brushes:
 * Chalk, Crayon, Oil / Dry Brush, Watercolor, Calligraphy nibs, and Dash/Taper dynamics.
 */

export * from './chalkUtils';

// ==========================================
// 1. CRAYON
// ==========================================

export interface CrayonFilterValues {
  baseFreq: string;
  scale: number;
  offset: string;
}

export interface CrayonPreset {
  name: string;
  density: number;
  grain: number;
  roughness: number;
  description: string;
}

export const CRAYON_PRESETS: CrayonPreset[] = [
  {
    name: 'Heavy Wax',
    density: 80,
    grain: 60,
    roughness: 30,
    description: 'Rich, glossy wax laydown with minimal tooth skip',
  },
  {
    name: 'Classic Crayon',
    density: 50,
    grain: 50,
    roughness: 50,
    description: 'Standard textured wax crayon on drawing paper',
  },
  {
    name: 'Gritty Rubbing',
    density: 25,
    grain: 25,
    roughness: 80,
    description: 'Light rub revealing coarse pebbled paper tooth',
  },
];

export function getCrayonFilterValues(
  density: number = 50,
  grain: number = 50,
  roughness: number = 50
): CrayonFilterValues {
  const d = Math.max(0, Math.min(100, density));
  const offsetNum = -0.55 + (d / 100) * 0.40;
  const offset = offsetNum.toFixed(2);

  const g = Math.max(0, Math.min(100, grain));
  const freqNum = 0.25 + (g / 100) * 0.40;
  const baseFreq = freqNum.toFixed(2);

  const r = Math.max(0, Math.min(100, roughness));
  const scale = Number(((r / 100) * 11.0).toFixed(1));

  return { baseFreq, scale, offset };
}

// ==========================================
// 2. DRY BRUSH & OIL
// ==========================================

export interface DrybrushFilterValues {
  baseFreq: string;
  scale: number;
  offset: string;
}

export interface DrybrushPreset {
  name: string;
  density: number;
  streaks: number;
  roughness: number;
  description: string;
}

export const DRYBRUSH_PRESETS: DrybrushPreset[] = [
  {
    name: 'Rich Impasto',
    density: 80,
    streaks: 40,
    roughness: 30,
    description: 'Thick oil paint with subtle directional brush marks',
  },
  {
    name: 'Bristle Drag',
    density: 50,
    streaks: 50,
    roughness: 50,
    description: 'Classic drybrush bristle streaks and dragged edges',
  },
  {
    name: 'Dry Scratch',
    density: 25,
    streaks: 85,
    roughness: 75,
    description: 'Faint, bristly dragged strokes with broken tooth',
  },
];

export function getDrybrushFilterValues(
  density: number = 50,
  streaks: number = 50,
  roughness: number = 50
): DrybrushFilterValues {
  const d = Math.max(0, Math.min(100, density));
  const offsetNum = -0.48 + (d / 100) * 0.40;
  const offset = offsetNum.toFixed(2);

  const s = Math.max(0, Math.min(100, streaks));
  const freqX = (0.52 + (s / 100) * 0.60).toFixed(2);
  const freqY = (0.04 + (s / 100) * 0.08).toFixed(2);
  const baseFreq = `${freqX} ${freqY}`;

  const r = Math.max(0, Math.min(100, roughness));
  const scale = Number(((r / 100) * 6.0).toFixed(1));

  return { baseFreq, scale, offset };
}

// ==========================================
// 3. WATERCOLOR
// ==========================================

export interface WatercolorFilterValues {
  baseFreq: string;
  scale: number;
  stdDeviation: string;
  opacity: number;
}

export interface WatercolorPreset {
  name: string;
  bleed: number;
  spread: number;
  wetness: number;
  description: string;
}

export const WATERCOLOR_PRESETS: WatercolorPreset[] = [
  {
    name: 'Light Glaze',
    bleed: 30,
    spread: 25,
    wetness: 25,
    description: 'Delicate transparent wash with crisp feathering',
  },
  {
    name: 'Wet-on-Dry',
    bleed: 50,
    spread: 50,
    wetness: 50,
    description: 'Balanced pigment laydown with soft organic edges',
  },
  {
    name: 'Wet-on-Wet',
    bleed: 85,
    spread: 80,
    wetness: 75,
    description: 'Deep bleeding diffusion into wet paper',
  },
];

export function getWatercolorFilterValues(
  bleed: number = 50,
  spread: number = 50,
  wetness: number = 50
): WatercolorFilterValues {
  const b = Math.max(0, Math.min(100, bleed));
  const stdDevNum = 0.2 + (b / 100) * 1.2;
  const stdDeviation = stdDevNum.toFixed(1);

  const sp = Math.max(0, Math.min(100, spread));
  const scale = Number((0.5 + (sp / 100) * 4.0).toFixed(1));

  const w = Math.max(0, Math.min(100, wetness));
  const opacity = Number((0.25 + (w / 100) * 0.40).toFixed(2));

  return {
    baseFreq: '0.05',
    scale,
    stdDeviation,
    opacity,
  };
}

// ==========================================
// 4. CALLIGRAPHY NIBS
// ==========================================

export interface CalligraphyNibValues {
  angle: number;
  weightRatio: number;
}

export interface CalligraphyPreset {
  name: string;
  angle: number;
  weight: number;
  description: string;
}

export const CALLIGRAPHY_PRESETS: CalligraphyPreset[] = [
  {
    name: 'Italic 45°',
    angle: 45,
    weight: 50,
    description: 'Standard right-handed 45° italic chisel',
  },
  {
    name: 'Left Hand -45°',
    angle: -45,
    weight: 50,
    description: 'Inverted -45° chisel angle for left-handed calligraphy',
  },
  {
    name: 'Broad Edge 0°',
    angle: 0,
    weight: 65,
    description: 'Flat horizontal nib producing dramatic vertical ribbons',
  },
  {
    name: 'Vertical 90°',
    angle: 90,
    weight: 65,
    description: 'Perpendicular nib producing wide horizontal cross-strokes',
  },
];

export function getCalligraphyNibValues(
  angle: number = 45,
  weight: number = 50
): CalligraphyNibValues {
  const clampedWeight = Math.max(10, Math.min(100, weight));
  // At 50: 0.5 + 0.5 * 0.5 = 0.75 (exact match to default sw * 0.75)
  const weightRatio = Number((0.5 + (clampedWeight / 100) * 0.5).toFixed(2));
  return {
    angle,
    weightRatio,
  };
}

// ==========================================
// 5. DASH & GAP DYNAMICS
// ==========================================

export function getDashArrayString(
  strokeWidth: number,
  style?: 'solid' | 'dashed' | 'dotted',
  dashLength: number = 5,
  dashGap: number = 4
): string | undefined {
  if (style === 'dashed') {
    const l = Math.max(1, dashLength);
    const g = Math.max(1, dashGap);
    const dashLen = Number((strokeWidth * (l / 2)).toFixed(1));
    const gapLen = Number((strokeWidth * (g / 2)).toFixed(1));
    return `${dashLen} ${gapLen}`;
  }
  if (style === 'dotted') {
    const g = Math.max(1, dashGap);
    const gapLen = Number((strokeWidth * (g * 0.4)).toFixed(1));
    return `0.1 ${gapLen}`;
  }
  return undefined;
}

