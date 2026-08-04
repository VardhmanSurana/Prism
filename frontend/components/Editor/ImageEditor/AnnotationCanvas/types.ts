import { Annotation } from '../AnnotationsPanel';
import { DrawToolId } from '../AnnotationsPanel';

export type HandleId = 'ep0' | 'ep1' | 'tl' | 'tr' | 'bl' | 'br' | 'lm' | 'rm';

export type DragMode = 'none' | 'move' | 'resize-edge' | 'resize-endpoint';

export interface AnnotationCanvasProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: DrawToolId;
  setActiveDrawTool?: (tool: DrawToolId) => void;
  activeColor: string;
  setActiveColor?: (color: string) => void;
  activeOpacity?: number;
  setActiveOpacity?: (opacity: number) => void;
  strokeWidth: number;
  setStrokeWidth?: (width: number) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  eraserSize?: number;
  readOnly?: boolean;
  userChangedStyleRef?: React.MutableRefObject<boolean>;
  onStartGesture?: () => void;
  onEndGesture?: () => void;

  // Text layer settings
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  fontSize?: number;
  setFontSize?: (size: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (w: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (s: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (val: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (val: number) => void;
  onUpdateTextProps?: (updatedProps: Partial<Annotation>) => void;

  // Text doodle settings
  doodleText?: string;
  setDoodleText?: (val: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (val: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (val: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (val: boolean) => void;
}
