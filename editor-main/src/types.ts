export type ActiveSidebarTab =
  | 'SORT'
  | 'MARKUP'
  | 'PRESETS'
  | 'AI_TOOLS'
  | 'LIGHT'
  | 'COLOR'
  | 'SPLIT_TONE'
  | 'DETAIL'
  | 'PORTRAIT'
  | 'REGIONS'
  | 'GRAIN_LEAKS'
  | 'FRAMES'
  | 'BLEND';

export type DrawingTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'text'
  | 'eraser'
  | 'textPath';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingLine {
  id: string;
  type: 'pen' | 'highlighter' | 'textPath';
  color: string;
  strokeWidth: number;
  points: Point[];
  doodleText?: string;
  fontSize?: number;
  fontFamily?: string;
  showGuidePath?: boolean;
}

export interface VectorShape {
  id: string;
  type: 'rect' | 'circle' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  opacity?: number; // 0 to 100
}

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  textAlign: 'left' | 'center' | 'right';
  width?: number; // percent of container width, e.g. 30
  height?: number; // percent of container height, e.g. 15
  opacity?: number; // 0 to 100
  rotation?: number; // 0 to 360
  lineHeight?: number; // ratio, e.g. 1.2
  letterSpacing?: number; // in pixels, e.g. 0
  bgColor?: string; // e.g. '#eab308' or transparent
  textStroke?: string; // e.g. '1px #eb5e28'
  textShadow?: string; // e.g. '0 0 10px #ff2a8d' for glowing/neon effects
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface ImageAdjustments {
  // Light
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  exposure: number;    // -100 to 100
  highlights: number;  // -100 to 100
  shadows: number;     // -100 to 100

  // Color
  saturation: number;  // -100 to 100
  temperature: number; // -100 to 100 (warm/cool)
  tint: number;        // -100 to 100 (magenta/green)
  vibrance: number;    // -100 to 100

  // Split Tone
  highHue: number;     // 0-360
  highSat: number;     // 0-100
  shadowHue: number;   // 0-360
  shadowSat: number;   // 0-100

  // Detail
  sharpness: number;   // 0 to 100
  blur: number;        // 0 to 100
  noise: number;       // 0 to 100
  vignette: number;    // 0 to 100

  // Portrait
  faceGlow: number;    // 0 to 100
  smoothSkin: number;  // 0 to 100
  eyeBright: number;   // 0 to 100
  teethWhite: number;  // 0 to 100

  // Grain/Leaks
  grain: number;       // 0 to 100
  leakColor: string;
  leakIntensity: number; // 0 to 100
  leakPosition: 'left' | 'right' | 'top' | 'bottom';

  // Frames & Borders
  frameStyle: 'none' | 'polaroid' | 'white' | 'black' | 'neon' | 'wood' | 'rounded';

  // Crop/Transform
  rotation: number;     // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  cropPercent: {
    x: number;         // 0 to 100
    y: number;         // 0 to 100
    width: number;     // 0 to 100
    height: number;    // 0 to 100
  } | null;

  // Double Exposure
  blendImage: string | null;
  blendMode: 'overlay' | 'multiply' | 'screen' | 'darken' | 'lighten';
  blendOpacity: number; // 0 to 100
}

export type PresetType =
  | 'original'
  | 'cosmic_slate'
  | 'warm_autumn'
  | 'noir_breeze'
  | 'cyberpunk'
  | 'cinematic_gold'
  | 'emerald_deep'
  | 'vintage_polaroid'
  | 'high_contrast';

export interface EditorState {
  imageSrc: string;
  name: string;
  adjustments: ImageAdjustments;
  preset: PresetType;
  lines: DrawingLine[];
  shapes: VectorShape[];
  texts: TextLayer[];
}

export interface HistoryItem {
  id: string;
  label: string;
  timestamp: Date;
  state: EditorState;
}

export interface SampleImage {
  id: string;
  label: string;
  url: string;
  description: string;
}
