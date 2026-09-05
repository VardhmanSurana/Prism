import type React from 'react';
import type Cropper from 'cropperjs';
import type { ToolId } from './Sidebar';
import type { Adjustments } from './filterEngine';
import type { InpaintMode, InpaintCanvasHandle } from '@plugins/ai-vision-studio';
import type { Annotation, DrawToolId, PenSettings } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import type { HealingSettings } from './HealingPanel';
import type { HealingCanvasRef } from './HealingCanvas';
import type { LassoState } from './lassoEngine';

export interface CanvasAreaProps {
  currentImageSrc: string;
  filterString: string;
  cropperRef: React.RefObject<Cropper | null>;
  handleCropEvent: () => void;
  handleReady: () => void;
  activeTool: ToolId | null;
  adjustments: Adjustments;
  isSaving: boolean;
  curvesTable: { r: string; g: string; b: string };
  isComparing?: boolean;
  inpaintMode?: InpaintMode;
  inpaintCanvasRef?: React.Ref<InpaintCanvasHandle>;
  inpaintMask?: string | null;
  brushSize?: number;
  brushHardness?: number;
  onInpaintMaskChange?: (maskDataUrl: string) => void;
  onInpaintStrokeComplete?: (maskDataUrl: string) => void;
  onInteractivePointsChange?: (points: Array<{ x: number; y: number; positive: boolean }>) => void;
  showMaskPreview?: boolean;
  maskOpacity?: number;
  annotations?: Annotation[];
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  activeDrawTool?: DrawToolId;
  setActiveDrawTool?: (tool: DrawToolId) => void;
  activeColor?: string;
  strokeWidth?: number;
  eraserSize?: number;
  selectedAnnId?: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  selectedAnnIds?: string[];
  setSelectedAnnIds?: (ids: string[]) => void;
  userChangedStyleRef?: React.MutableRefObject<boolean>;
  onStartGesture?: () => void;
  onEndGesture?: () => void;
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  fontSize?: number;
  setFontSize?: (size: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (weight: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (style: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (decoration: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (align: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (value: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (value: number) => void;
  onUpdateTextProps?: (updatedProps: Partial<Annotation>) => void;
  doodleText?: string;
  setDoodleText?: (value: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (size: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (font: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (show: boolean) => void;
  // Pen (freehand) settings
  penSettings?: PenSettings;
  // Healing brush / clone stamp
  healingSettings?: HealingSettings;
  healingCanvasRef?: React.Ref<HealingCanvasRef>;
  onHealingStrokeComplete?: () => void;
  // Lasso & Intelligent Scissors Selection
  lassoState?: LassoState;
  onLassoStateChange?: (state: LassoState) => void;
  onLassoSelectionComplete?: (maskCanvas: HTMLCanvasElement) => void;
  // Palette Eyedropper
  palettePickingIndex?: number | null;
  onPaletteColorPicked?: (hex: string, targetIdx: number) => void;
  onCancelPalettePicking?: () => void;
  // Face Bounding Boxes
  faces?: import('@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay').FaceBBox[];
  selectedFaceIndex?: number | null;
  onSelectFace?: (index: number) => void;
  // Liquify & Reshape Mesh
  liquifySettings?: import('./liquifyEngine').LiquifySettings;
  liquifyCanvasRef?: React.Ref<import('./LiquifyCanvas').LiquifyCanvasRef>;
}
