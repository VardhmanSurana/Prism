/**
 * AnnotationsOverlay.tsx
 */
import React from 'react';
import { AnnotationCanvas } from '@plugins/retouch-metadata-studio';
import type { Annotation, DrawToolId, PenSettings } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import { ImageRect, overlayStyle } from '../imageRect';

export interface AnnotationsOverlayProps {
  rect: ImageRect;
  containerRef?: React.Ref<HTMLDivElement>;
  activeTool: string;  annotations: Annotation[];
  onAnnotationsChange: (a: Annotation[]) => void;
  onStartGesture?: () => void;
  onEndGesture?: () => void;
  activeDrawTool: DrawToolId;
  setActiveDrawTool?: (t: DrawToolId) => void;
  activeColor: string;
  strokeWidth: number;
  eraserSize: number;
  selectedAnnId: string | null;
  setSelectedAnnId?: (id: string | null) => void;
  userChangedStyleRef: React.MutableRefObject<boolean>;
  fontFamily?: string;
  setFontFamily?: (f: string) => void;
  fontSize?: number;
  setFontSize?: (n: number) => void;
  fontWeight?: 'normal' | 'bold';
  setWeight?: (w: 'normal' | 'bold') => void;
  fontStyle?: 'normal' | 'italic';
  setStyle?: (s: 'normal' | 'italic') => void;
  textDecoration?: 'none' | 'underline' | 'line-through';
  setDecoration?: (d: 'none' | 'underline' | 'line-through') => void;
  textAlign?: 'left' | 'center' | 'right';
  setTextAlign?: (a: 'left' | 'center' | 'right') => void;
  lineHeight?: number;
  setLineHeight?: (n: number) => void;
  letterSpacing?: number;
  setLetterSpacing?: (n: number) => void;
  onUpdateTextProps?: (p: Partial<Annotation>) => void;
  doodleText?: string;
  setDoodleText?: (v: string) => void;
  doodleFontSize?: number;
  setDoodleFontSize?: (n: number) => void;
  doodleFontFamily?: string;
  setDoodleFontFamily?: (f: string) => void;
  showDoodleGuide?: boolean;
  setShowDoodleGuide?: (b: boolean) => void;
  penSettings?: PenSettings;
}

export const AnnotationsOverlay: React.FC<AnnotationsOverlayProps> = (p) => {
  const isActive = p.activeTool === 'annotations';
  const readOnly = !isActive;
  const get = <T,>(v: T | undefined, fallback: T) => (isActive ? v ?? fallback : fallback);

  return (
    <div
      ref={p.containerRef}
      className={`absolute ${isActive ? '' : 'pointer-events-none'}`}
      style={overlayStyle(p.rect, { pointerEvents: isActive ? 'auto' : 'none', zIndex: isActive ? 30 : 20 })}
    >
      <AnnotationCanvas
        annotations={p.annotations}
        onChange={isActive ? p.onAnnotationsChange : () => {}}
        onStartGesture={isActive ? p.onStartGesture : undefined}
        onEndGesture={isActive ? p.onEndGesture : undefined}
        activeDrawTool={get(p.activeDrawTool, 'freehand')}
        setActiveDrawTool={isActive ? p.setActiveDrawTool : undefined}
        activeColor={get(p.activeColor, '')}
        strokeWidth={get(p.strokeWidth, 1)}
        eraserSize={get(p.eraserSize, 35)}
        readOnly={readOnly}
        selectedAnnId={isActive ? p.selectedAnnId : null}
        setSelectedAnnId={isActive ? p.setSelectedAnnId : undefined}
        userChangedStyleRef={isActive ? p.userChangedStyleRef : undefined}
        fontFamily={isActive ? p.fontFamily : undefined}
        setFontFamily={isActive ? p.setFontFamily : undefined}
        fontSize={isActive ? p.fontSize : undefined}
        setFontSize={isActive ? p.setFontSize : undefined}
        fontWeight={isActive ? p.fontWeight : undefined}
        setWeight={isActive ? p.setWeight : undefined}
        fontStyle={isActive ? p.fontStyle : undefined}
        setStyle={isActive ? p.setStyle : undefined}
        textDecoration={isActive ? p.textDecoration : undefined}
        setDecoration={isActive ? p.setDecoration : undefined}
        textAlign={isActive ? p.textAlign : undefined}
        setTextAlign={isActive ? p.setTextAlign : undefined}
        lineHeight={isActive ? p.lineHeight : undefined}
        setLineHeight={isActive ? p.setLineHeight : undefined}
        letterSpacing={isActive ? p.letterSpacing : undefined}
        setLetterSpacing={isActive ? p.setLetterSpacing : undefined}
        onUpdateTextProps={isActive ? p.onUpdateTextProps : undefined}
        doodleText={isActive ? p.doodleText : undefined}
        setDoodleText={isActive ? p.setDoodleText : undefined}
        doodleFontSize={isActive ? p.doodleFontSize : undefined}
        setDoodleFontSize={isActive ? p.setDoodleFontSize : undefined}
        doodleFontFamily={isActive ? p.doodleFontFamily : undefined}
        setDoodleFontFamily={isActive ? p.setDoodleFontFamily : undefined}
        showDoodleGuide={isActive ? p.showDoodleGuide : undefined}
        setShowDoodleGuide={isActive ? p.setShowDoodleGuide : undefined}
        penSettings={isActive ? p.penSettings : undefined}
      />
    </div>
  );
};
