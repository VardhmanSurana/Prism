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
}

export const DEFAULT_PEN_SETTINGS: PenSettings = {
  style: 'solid',
  closeFill: false,
  fillOpacity: 0.5,
  arrowEnd: false,
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

  // Pen (freehand) properties
  penStyle?: PenStrokeStyle;
  closePath?: boolean;
  arrowEnd?: boolean;
  
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

  // Shape fill properties
  fillShape?: boolean;
  fillOpacity?: number;
}

export type DrawToolId =
  | AnnotationToolType
  | 'select'
  | 'emoji';

