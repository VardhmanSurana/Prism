import React, { useEffect, useCallback, useRef } from 'react';
import { Annotation } from '../AnnotationsPanel';
import { AnnotationCanvasProps } from './types';
import { useAnnotationEvents } from './useAnnotationEvents';
import { SelectionHighlight } from './SelectionHighlight';
import {
  ArrowRenderer,
  FreehandRenderer,
  HighlighterRenderer,
  RectRenderer,
  CircleRenderer,
} from './Renderers';

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = (props) => {
  const {
    annotations,
    onChange,
    activeDrawTool,
    activeColor,
    activeOpacity,
    strokeWidth,
    selectedAnnId = null,
    setSelectedAnnId = () => {},
    readOnly = false,
    userChangedStyleRef,
  } = props;

  const {
    currentAnn,
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleContextMenu,
  } = useAnnotationEvents(props);

  const [rotating, setRotating] = React.useState(false);
  const rotateStartRef = React.useRef<{ startAngle: number; startRotation: number; centerX: number; centerY: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleRotateStart = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const selectedAnn = annotations.find(a => a.id === selectedAnnId);
    const startRotation = selectedAnn?.rotation || 0;
    rotateStartRef.current = { startAngle: angle, startRotation, centerX, centerY };
    setRotating(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [svgRef, annotations, selectedAnnId]);

  useEffect(() => {
    if (!rotating || !rotateStartRef.current) return;
    const handlePointerMove = (e: PointerEvent) => {
      const { startAngle, centerX, centerY } = rotateStartRef.current!;
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const delta = (currentAngle - startAngle) * (180 / Math.PI);
      const newRotation = (rotateStartRef.current!.startRotation + delta) % 360;
      if (selectedAnnId) {
        onChange(annotations.map(ann => ann.id === selectedAnnId ? { ...ann, rotation: newRotation } : ann));
      }
    };
    const handlePointerUp = () => {
      setRotating(false);
      rotateStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [rotating, selectedAnnId, annotations, onChange]);

  // Update selected annotation only when user explicitly changes color or strokeWidth
  useEffect(() => {
    if (selectedAnnId && activeDrawTool === 'select' && userChangedStyleRef.current) {
      userChangedStyleRef.current = false;
      onChange(
        annotations.map((ann) => {
          if (ann.id !== selectedAnnId) return ann;
          const updates: Partial<Annotation> = {};
          if (ann.color !== activeColor) updates.color = activeColor;
          if (ann.strokeWidth !== strokeWidth) updates.strokeWidth = strokeWidth;
          return Object.keys(updates).length > 0 ? { ...ann, ...updates } : ann;
        })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeColor, strokeWidth, selectedAnnId, activeDrawTool]);

  // Keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnId) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        onChange(annotations.filter(a => a.id !== selectedAnnId));
        setSelectedAnnId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnId, annotations, onChange, setSelectedAnnId]);

  const renderAnnotation = (ann: Annotation) => {
    switch (ann.type) {
      case 'arrow': return <ArrowRenderer key={ann.id} ann={ann} />;
      case 'freehand': return <FreehandRenderer key={ann.id} ann={ann} />;
      case 'highlighter': return <HighlighterRenderer key={ann.id} ann={ann} />;
      case 'rect': return <RectRenderer key={ann.id} ann={ann} />;
      case 'circle': return <CircleRenderer key={ann.id} ann={ann} />;
      default: return null;
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
      />
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        onPointerDown={readOnly ? undefined : handlePointerDown}
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : handlePointerUp}
        onDoubleClick={readOnly ? undefined : handleDoubleClick}
        onContextMenu={readOnly ? undefined : handleContextMenu}
        className={`absolute inset-0 w-full h-full select-none ${readOnly ? 'z-25 pointer-events-none' : 'z-45 touch-none'}`}
        style={{
          cursor: readOnly
            ? 'default'
            : activeDrawTool === 'select'
              ? 'move'
              : 'crosshair',
          pointerEvents: readOnly ? 'none' : 'auto',
        }}
      >
        {annotations.map((ann) => renderAnnotation(ann))}
        {currentAnn && renderAnnotation(currentAnn)}

        {/* Selection Highlight */}
        {activeDrawTool === 'select' && selectedAnnId && (
          <SelectionHighlight
            annotation={annotations.find(a => a.id === selectedAnnId)!}
            onRotateStart={handleRotateStart}
          />
        )}
      </svg>
    </div>
  );
};
