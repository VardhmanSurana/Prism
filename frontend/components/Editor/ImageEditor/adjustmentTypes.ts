/**
 * adjustmentTypes.ts
 * All sub-types used by the main Adjustments interface.
 * Split from filterEngine.ts for modularity.
 */

import type { LutData } from './lutEngine';
import { RawSettings } from './rawEngine';

// ── HSL Per-Band Types ───────────────────────────────────────────────────────

export type HslBand =
  | 'reds' | 'oranges' | 'yellows' | 'greens'
  | 'aquas' | 'blues'  | 'purples' | 'pinks';

export interface HslChannelAdjustment {
  hue:        number; // -180 → +180
  saturation: number; // -100 → +100
  luminance:  number; // -100 → +100
}

export type HslAdjustments = Record<HslBand, HslChannelAdjustment>;

export const HSL_BAND_DEFAULTS: HslAdjustments = {
  reds:    { hue: 0, saturation: 0, luminance: 0 },
  oranges: { hue: 0, saturation: 0, luminance: 0 },
  yellows: { hue: 0, saturation: 0, luminance: 0 },
  greens:  { hue: 0, saturation: 0, luminance: 0 },
  aquas:   { hue: 0, saturation: 0, luminance: 0 },
  blues:   { hue: 0, saturation: 0, luminance: 0 },
  purples: { hue: 0, saturation: 0, luminance: 0 },
  pinks:   { hue: 0, saturation: 0, luminance: 0 },
};

// ── Color Wheels ─────────────────────────────────────────────────────────────

export interface ColorWheelVal {
  x: number; // -100 to 100
  y: number; // -100 to 100
  yuma: number; // -100 to 100
}

export interface ColorWheelsAdjustments {
  mode: 'primary' | 'log';
  lift: ColorWheelVal;
  gamma: ColorWheelVal;
  gain: ColorWheelVal;
  offset: ColorWheelVal;
  shadows: ColorWheelVal;
  midtones: ColorWheelVal;
  highlights: ColorWheelVal;
  lowPivot: number;  // 0 -> 100
  highPivot: number; // 0 -> 100
}

// ── Defringe ─────────────────────────────────────────────────────────────────

export interface DefringeAdjustments {
  amount: number; // 0 -> 100
  hueStart: number; // 0 -> 360
  hueEnd: number; // 0 -> 360
  vignetteCos4: number; // 0 -> 100
}

// ── Portrait ─────────────────────────────────────────────────────────────────

export interface SingleFaceAdjustments {
  skinSmoothing?:  number; // 0 → 100
  skinTexture?:    number; // 0 → 100 (pore & authentic micro-texture retention, default 75)
  skinBrightness?: number; // -50 → 50
  skinWarmth?:     number; // -50 → 50
  skinTone?:       number; // -50 → 50 (magenta/green tint)
  realTone?:       number; // 0 → 100 (Google Pixel Real Tone ambient color cast calibration)
  eyeWhitening?:   number; // 0 → 100
  eyeEnhance?:     number; // 0 → 100 (iris clarity & micro-contrast)
  eyeCatchlight?:  number; // 0 → 100 (specular pupil catchlight sparkle)
  teethWhitening?: number; // 0 → 100
  lipVibrance?:    number; // -50 → 50
  eyebrowEnhance?: number; // 0 → 100
  masks?: {
    skin?: string;
    eyes?: string;
    lips?: string;
    teeth?: string;
    eyebrows?: string;
  };
  box?: [number, number, number, number];
}

export interface PortraitAdjustments extends SingleFaceAdjustments {
  selectedFaceId?: string; // 'all' or 'face_0', 'face_1'
  faces?: Record<string, SingleFaceAdjustments>; // per-face overrides
}

export const DEFAULT_SINGLE_FACE_ADJUSTMENTS: SingleFaceAdjustments = {
  skinSmoothing:  0,
  skinTexture:    75,
  skinBrightness: 0,
  skinWarmth:     0,
  skinTone:       0,
  realTone:       0,
  eyeWhitening:   0,
  eyeEnhance:     0,
  eyeCatchlight:  0,
  teethWhitening: 0,
  lipVibrance:    0,
  eyebrowEnhance: 0,
  masks: {},
};

export const DEFAULT_PORTRAIT_ADJUSTMENTS: PortraitAdjustments = {
  ...DEFAULT_SINGLE_FACE_ADJUSTMENTS,
  selectedFaceId: 'all',
  faces: {},
};

// ── Effects Sub-Types ────────────────────────────────────────────────────────

export interface SplitToningAdjustments {
  shadows:    { hue: number; saturation: number };
  highlights: { hue: number; saturation: number };
  balance:    number;
}

export interface GrainAdjustments {
  amount:  number;
  size:    'fine' | 'medium' | 'coarse';
  colored: boolean;
}

export interface LightLeakAdjustments {
  preset:  string | null;
  opacity: number;
  color?:  string;
  position?: 'left' | 'right' | 'top' | 'bottom' | 'top-right' | 'bottom-left' | 'center';
}

export interface FrameAdjustments {
  style:     'none' | 'polaroid' | 'filmstrip' | 'matte' | 'rounded' | 'thinline' | 'shadowbox';
  color:     string;
  thickness: number;
}

export interface BlendAdjustments {
  photoId:       number | null;
  blendImageSrc: string | null;
  mode:          GlobalCompositeOperation;
  opacity:       number;
  fit:           'cover' | 'contain' | 'center';
}

export interface TiltShiftAdjustments {
  enabled:       boolean;
  mode:          'linear' | 'radial';
  blurStrength:  number;
  focusPosition: number;
  focusWidth:    number;
}

export interface LutAdjustments {
  /** ID of a built-in LUT, or null if using a custom import */
  builtinId:   string | null;
  /** Custom imported LUT data (from parsed .cube file) */
  customData:  LutData | null;
  /** Blend opacity 0-100 */
  opacity:     number;
}

// ── Default Constants ────────────────────────────────────────────────────────

export const DEFAULT_COLOR_WHEEL_VAL: ColorWheelVal = { x: 0, y: 0, yuma: 0 };

export const DEFAULT_COLOR_WHEELS: ColorWheelsAdjustments = {
  mode: 'primary',
  lift: { ...DEFAULT_COLOR_WHEEL_VAL },
  gamma: { ...DEFAULT_COLOR_WHEEL_VAL },
  gain: { ...DEFAULT_COLOR_WHEEL_VAL },
  offset: { ...DEFAULT_COLOR_WHEEL_VAL },
  shadows: { ...DEFAULT_COLOR_WHEEL_VAL },
  midtones: { ...DEFAULT_COLOR_WHEEL_VAL },
  highlights: { ...DEFAULT_COLOR_WHEEL_VAL },
  lowPivot: 20,
  highPivot: 80,
};

export const DEFAULT_DEFRINGE: DefringeAdjustments = {
  amount: 0,
  hueStart: 270,
  hueEnd: 330,
  vignetteCos4: 0,
};
