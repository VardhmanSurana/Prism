import { Annotation } from '../AnnotationsPanel';

export type HandleId = 'ep0' | 'ep1' | 'tm' | 'bm' | 'lm' | 'rm';

export type DragMode = 'none' | 'move' | 'resize-edge' | 'resize-endpoint';

export interface AnnotationCanvasProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter';
  setActiveDrawTool?: (tool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'eraser' | 'select' | 'highlighter') => void;
  activeColor: string;
  setActiveColor?: (color: string) => void;
  activeOpacity?: number;
  setActiveOpacity?: (opacity: number) => void;
  strokeWidth: number;
  setStrokeWidth?: (width: number) => void;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  readOnly?: boolean;
  userChangedStyleRef?: React.MutableRefObject<boolean>;
}
