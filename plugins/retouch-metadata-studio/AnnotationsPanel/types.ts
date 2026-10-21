/**
 * types.ts
 * Common TypeScript definitions for annotation elements, drawn markers, shapes, and properties.
 */

export type VectorShapeType =
  | 'rect'
  | 'roundedRect'
  | 'circle'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'fourPointStar'
  | 'heart'
  | 'lightning'
  | 'speechBubble'
  | 'cloud'
  | 'arrow'
  | 'doubleArrow'
  | 'line';

export type AnnotationToolType =
  | VectorShapeType
  | 'freehand'
  | 'eraser'
  | 'highlighter'
  | 'text'
  | 'textPath';

export type BrushType =
  | 'brush'        // Classic round paint brush
  | 'spray'        // Airbrush / spray paint
  | 'calligraphy1' // 45° angled chisel nib
  | 'calligraphy2' // -45° angled chisel nib
  | 'oil'          // Textured oil brush (impasto bristles)
  | 'crayon'       // Waxy crayon
  | 'chalk'        // Porous paper chalk grain (Texture Effect)
  | 'drybrush'     // Directional drybrush bristle drag (Texture Effect)
  | 'watercolor'   // Soft translucent wash
  | 'pen';         // Fine vector pen / pencil

export type PenStrokeStyle = 'solid' | 'dashed' | 'dotted';

/** Settings for the Pen (freehand) tool — applied to new strokes and editable on selection */
export interface PenSettings {
  style: PenStrokeStyle;
  /** Close the stroke into a filled shape */
  closeFill: boolean;
  /** Fill opacity used when closeFill is enabled (0-1) */
  fillOpacity: number;
  /** Draw an arrowhead at the end of the stroke */
  arrowEnd: boolean;
  /** Calligraphic stroke taper mode */
  taper?: LineTaper;
  /** Artistic texture effect (chalk, crayon, drybrush) */
  texture?: LineTexture;
  /** Doodle line wave/sketch pattern */
  doodleStyle?: DoodleLineStyle;
  /** Active brush type */
  brushType?: BrushType;
  /** Spray spread radius in normalized canvas units (10-80) */
  sprayRadius?: number;
  /** Spray droplet density (number of droplets emitted per step) */
  sprayDensity?: number;
  /** Chalk texture pressure / tooth coverage (0-100, default 60) */
  chalkPressure?: number;
  /** Chalk grain fineness (0-100, default 50: coarse grit <-> fine powder) */
  chalkGrain?: number;
  /** Chalk edge crumble / roughness (0-100, default 50) */
  chalkRoughness?: number;
  /** Crayon wax density (0-100, default 50) */
  crayonDensity?: number;
  /** Crayon grain roughness (0-100, default 50) */
  crayonGrain?: number;
  /** Crayon edge chatter (0-100, default 50) */
  crayonRoughness?: number;
  /** Drybrush / Oil pigment density (0-100, default 50) */
  drybrushDensity?: number;
  /** Drybrush / Oil bristle striations (0-100, default 50) */
  drybrushStreaks?: number;
  /** Drybrush / Oil edge drag roughness (0-100, default 50) */
  drybrushRoughness?: number;
  /** Watercolor bleed feathering (0-100, default 50) */
  watercolorBleed?: number;
  /** Watercolor pigment diffusion spread (0-100, default 50) */
  watercolorSpread?: number;
  /** Watercolor wash wetness / opacity (0-100, default 50) */
  watercolorWetness?: number;
  /** Calligraphy nib chisel angle in degrees (-90 to 90) */
  nibAngle?: number;
  /** Calligraphy nib width / weight ratio (10-100, default 50) */
  nibWeight?: number;
  /** Dashed stroke segment length (1-20, default 5) */
  dashLength?: number;
  /** Dashed / dotted stroke gap spacing (1-20, default 4) */
  dashGap?: number;
  /** Stroke taper width swell intensity (0-100, default 50) */
  taperIntensity?: number;
  /** Paint brush edge feather / blur (0-10, default 0) */
  brushFeather?: number;
}

export const DEFAULT_PEN_SETTINGS: PenSettings = {
  style: 'solid',
  closeFill: false,
  fillOpacity: 0.5,
  arrowEnd: false,
  taper: 'none',
  texture: 'none',
  doodleStyle: undefined,
  brushType: 'brush',
  sprayRadius: 25,
  sprayDensity: 12,
  chalkPressure: 60,
  chalkGrain: 50,
  chalkRoughness: 50,
  crayonDensity: 50,
  crayonGrain: 50,
  crayonRoughness: 50,
  drybrushDensity: 50,
  drybrushStreaks: 50,
  drybrushRoughness: 50,
  watercolorBleed: 50,
  watercolorSpread: 50,
  watercolorWetness: 50,
  nibAngle: 45,
  nibWeight: 50,
  dashLength: 5,
  dashGap: 4,
  taperIntensity: 50,
  brushFeather: 0,
};

export interface Annotation {
  id: string;
  type: AnnotationToolType;
  color: string;
  strokeWidth: number;
  opacity?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  bounds?: { x: number; y: number; w: number; h: number };
  visible?: boolean;

  // Pen (freehand) & Brush properties
  penStyle?: PenStrokeStyle;
  closePath?: boolean;
  arrowEnd?: boolean;
  brushType?: BrushType;
  sprayDots?: { x: number; y: number; r: number }[];
  sprayRadius?: number;
  sprayDensity?: number;
  chalkPressure?: number;
  chalkGrain?: number;
  chalkRoughness?: number;
  crayonDensity?: number;
  crayonGrain?: number;
  crayonRoughness?: number;
  drybrushDensity?: number;
  drybrushStreaks?: number;
  drybrushRoughness?: number;
  watercolorBleed?: number;
  watercolorSpread?: number;
  watercolorWetness?: number;
  nibAngle?: number;
  nibWeight?: number;
  dashLength?: number;
  dashGap?: number;
  taperIntensity?: number;
  brushFeather?: number;
  
  // Text layer properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  bgColor?: string;
  bgOpacity?: number;
  bgGlass?: boolean;
  textStroke?: string;
  textShadow?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';

  // Text doodle properties
  doodleText?: string;
  showGuidePath?: boolean;

  // Shape fill and creative styling properties
  fillShape?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  shapeStrokeStyle?: 'solid' | 'dashed' | 'dotted';
  shapeEffect?: 'none' | 'glow' | 'glass';
  gradientFill?: 'none' | 'sunset' | 'cyber' | 'emerald' | 'gold' | 'noir';
  cornerRadius?: number;
  starPoints?: number;
  starSpikiness?: number;
  polygonSides?: number;
  tailPos?: { x: number; y: number };
  badgeText?: string;

  // Doodle line style for line/arrow/doubleArrow ('straight' = unset)
  doodleLineStyle?: DoodleLineStyle;
  lineTexture?: LineTexture;
  lineTaper?: LineTaper;
  lineRoughness?: number;
}

export type DoodleLineStyle =
  | 'wave'
  | 'zigzag'
  | 'ripple'
  | 'loop'
  | 'sketch'
  | 'arc'
  | 'sCurve'
  | 'dashed';

export type LineTexture = 'chalk' | 'crayon' | 'drybrush' | 'none';

export type LineTaper = 'hand' | 'taperStart' | 'taperBoth' | 'dynamic' | 'none';

export type DrawToolId =
  | AnnotationToolType
  | 'select'
  | 'emoji';

