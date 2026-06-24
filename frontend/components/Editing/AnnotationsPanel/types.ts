/**
 * types.ts
 * Common TypeScript definitions for annotation elements, drawn markers, shapes, and properties.
 */

export type AnnotationToolType = 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'highlighter' | 'text' | 'textPath';

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

export type DrawToolId = 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter' | 'text' | 'textPath';
