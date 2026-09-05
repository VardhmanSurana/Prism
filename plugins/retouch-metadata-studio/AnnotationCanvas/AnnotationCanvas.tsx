import React, { useEffect, useRef, useState } from 'react';
import { Annotation } from '../AnnotationsPanel';
import { AnnotationCanvasProps } from './types';
import { useAnnotationEvents } from './useAnnotationEvents';
import {
  ArrowRenderer,
  FreehandRenderer,
  HighlighterRenderer,
  RectRenderer,
  CircleRenderer,
  TextPathRenderer,
  VectorShapeRenderer,
  AnnotationDefs,
} from './Renderers';
import { getAnnotationBBox, getAnnRotationTransform } from './utils';

const hexToRgba = (hex: string, opacity: number): string => {
  if (!hex) return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const makeBrushCursor = (size: number): string => {
  // Map SVG eraser radius (10-100) to a sensible pixel diameter (14-56px)
  const px = Math.round(Math.max(14, Math.min(56, size * 0.56)));
  const r = px / 2 - 1;
  const svg = [
    `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 ${px} ${px}'>`,
    `<circle cx='${px / 2}' cy='${px / 2}' r='${r}' fill='none' stroke='black' stroke-width='2'/>`,
    `<circle cx='${px / 2}' cy='${px / 2}' r='${r}' fill='none' stroke='white' stroke-width='1'/>`,
    `</svg>`,
  ].join('');
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${px / 2} ${px / 2}, auto`;
};

const PEN_CURSOR = 'crosshair';

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = (props) => {
  const {
    annotations,
    onChange,
    activeDrawTool,
    activeColor,
    strokeWidth,
    eraserSize = 35,
    selectedAnnId = null,
    setSelectedAnnId = () => {},
    readOnly = false,
    userChangedStyleRef,
    onUpdateTextProps,
  } = props;

  const [scale, setScale] = useState(1);
  const [aspectRatio, setAspectRatio] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setScale(height / 1000);
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const {
    currentAnn,
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleContextMenu,
    handleTextRotateStart,
    handleTextResizeStart,
    handleTextMoveStart,
  } = useAnnotationEvents(props);

  // Update selected annotation only when user explicitly changes color or strokeWidth
  useEffect(() => {
    if (selectedAnnId && activeDrawTool === 'select' && userChangedStyleRef?.current) {
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
    if (ann.visible === false) {
      return null;
    }
    if (ann.type === 'text') {
      return null;
    }
    let inner: React.ReactNode;
    switch (ann.type) {
      case 'freehand': inner = <FreehandRenderer ann={ann} aspectRatio={aspectRatio} />; break;
      case 'highlighter': inner = <HighlighterRenderer ann={ann} aspectRatio={aspectRatio} />; break;
      case 'textPath': inner = <TextPathRenderer ann={ann} aspectRatio={aspectRatio} />; break;
      default: inner = <VectorShapeRenderer ann={ann} aspectRatio={aspectRatio} />;
    }
    // ponytail: stable hook for transient drag — move writes transform to this node directly, zero setState/frame
    return <g key={ann.id} data-ann-id={ann.id}>{inner}</g>;
  };

  const handleDoubleClickWithEdit = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    handleDoubleClick(e);
  }, [handleDoubleClick]);

  const renderTransformHandles = (ann: Annotation) => {
    const rotVal = ann.rotation || 0;

    // All sizes scale with canvas height (1000-unit SVG viewBox → height/1000).
    // Base values are 2× the editor's CanvasViewport values.
    const cornerSize  = Math.round(28 * scale);   // px — L-bracket arm length
    const halfCorner  = Math.round(14 * scale);   // offset so the L straddles the corner
    const bracketW    = Math.max(3, Math.round(4 * scale)); // L stroke thickness
    const pillT       = Math.max(3, Math.round(4 * scale)); // side bars match the L stroke
    const pillLen     = Math.round(28 * scale);   // side bar length
    const halfPill    = Math.round(14 * scale);
    const btnSize     = Math.round(52 * scale);   // action button
    const iconSize    = Math.round(22 * scale);   // icon inside button
    const barOffset   = Math.round(88 * scale);   // distance below selection box
    const barGap      = Math.round(8  * scale);
    const barPx       = Math.round(12 * scale);
    const barPy       = Math.round(6  * scale);
    const barRadius   = Math.round(999 * scale);

    // ponytail: crop-style L-bracket corners (two white borders) instead of dots
    const cornerStyle = (cursor: string, corner: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => {
      const b = `${bracketW}px solid #ffffff`;
      const radius = `${Math.round(6 * scale)}px`;
      const sides: React.CSSProperties =
        corner === 'tl' ? { borderTop: b, borderLeft: b, borderTopLeftRadius: radius } :
        corner === 'tr' ? { borderTop: b, borderRight: b, borderTopRightRadius: radius } :
        corner === 'bl' ? { borderBottom: b, borderLeft: b, borderBottomLeftRadius: radius } :
                          { borderBottom: b, borderRight: b, borderBottomRightRadius: radius };
      return {
        position: 'absolute',
        width: cornerSize,
        height: cornerSize,
        background: 'transparent',
        cursor,
        zIndex: 50,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
        ...sides,
      };
    };

    const pillVStyle = (cursor: string): React.CSSProperties => ({
      position: 'absolute',
      width: pillT,
      height: pillLen,
      background: '#ffffff',
      borderRadius: pillT,
      cursor,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
    });

    const pillHStyle = (cursor: string): React.CSSProperties => ({
      position: 'absolute',
      width: pillLen,
      height: pillT,
      background: '#ffffff',
      borderRadius: pillT,
      cursor,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
    });

    const btnStyle: React.CSSProperties = {
      width:  btnSize,
      height: btnSize,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'alias',
      background: '#18181b',
      border: `${Math.max(1, Math.round(1 * scale))}px solid #3f3f46`,
      color: '#a1a1aa',
      flexShrink: 0,
    };

    return (
      <>
        {/* ── Corner handles ── */}
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'tl', ann.id)}
          style={{ ...cornerStyle('nwse-resize', 'tl'), top: -halfCorner, left: -halfCorner }}
          title="Resize"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'tr', ann.id)}
          style={{ ...cornerStyle('nesw-resize', 'tr'), top: -halfCorner, right: -halfCorner }}
          title="Resize"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'bl', ann.id)}
          style={{ ...cornerStyle('nesw-resize', 'bl'), bottom: -halfCorner, left: -halfCorner }}
          title="Resize"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'br', ann.id)}
          style={{ ...cornerStyle('nwse-resize', 'br'), bottom: -halfCorner, right: -halfCorner }}
          title="Resize"
        />

        {/* ── Side handles ── */}
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'lm', ann.id)}
          style={{ ...pillVStyle('ew-resize'), top: '50%', transform: 'translateY(-50%)', left: -halfPill }}
          title="Resize Width"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'rm', ann.id)}
          style={{ ...pillVStyle('ew-resize'), top: '50%', transform: 'translateY(-50%)', right: -halfPill }}
          title="Resize Width"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'tm', ann.id)}
          style={{ ...pillHStyle('ns-resize'), left: '50%', transform: 'translateX(-50%)', top: -halfPill }}
          title="Resize Height"
        />
        <div
          onPointerDown={(e) => handleTextResizeStart(e, 'bm', ann.id)}
          style={{ ...pillHStyle('ns-resize'), left: '50%', transform: 'translateX(-50%)', bottom: -halfPill }}
          title="Resize Height"
        />

        {/* ── Bottom actions bar ── */}
        <div
          style={{
            position: 'absolute',
            bottom: -barOffset,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: barGap,
            padding: `${barPy}px ${barPx}px`,
            background: 'rgba(9,9,11,0.95)',
            border: `${Math.max(1, Math.round(1 * scale))}px solid #27272a`,
            borderRadius: barRadius,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Rotate */}
          <div
            onPointerDown={(e) => handleTextRotateStart(e, ann.id)}
            style={btnStyle}
            title="Drag to Rotate"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6m-9 10a9 9 0 1 1 12.36-4"/>
            </svg>
          </div>
          {/* Move */}
          <div
            onPointerDown={(e) => handleTextMoveStart(e, ann.id)}
            style={{ ...btnStyle, cursor: 'move' }}
            title="Drag to Move"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 12 19"/>
              <polyline points="15 3 12 5 9 3"/>
              <polyline points="3 15 5 12 3 9"/>
              <polyline points="15 21 12 19 9 21"/>
              <polyline points="21 15 19 12 21 9"/>
            </svg>
          </div>
          {rotVal !== 0 && (
            <span style={{ fontSize: Math.round(10 * scale), fontFamily: 'monospace', color: '#a1a1aa', paddingLeft: Math.round(4 * scale), paddingRight: Math.round(4 * scale), fontWeight: 600 }}>
              {rotVal}°
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        onPointerDown={readOnly ? undefined : handlePointerDown}
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : handlePointerUp}
        onDoubleClick={readOnly ? undefined : handleDoubleClickWithEdit}
        onContextMenu={readOnly ? undefined : handleContextMenu}
        className={`absolute inset-0 w-full h-full select-none ${readOnly ? 'pointer-events-none' : 'touch-none'}`}
        style={{
          cursor: (() => {
            if (readOnly) return 'default';
            switch (activeDrawTool) {
              case 'select':
                return 'default';
              case 'eraser':
                return makeBrushCursor(eraserSize);
              case 'freehand':
              case 'highlighter':
                return PEN_CURSOR;
              case 'text':
              case 'textPath':
                return 'text';
              default:
                return 'crosshair';
            }
          })(),
          pointerEvents: readOnly ? 'none' : 'auto',
          zIndex: readOnly ? 20 : 30,
        }}
      >
        <AnnotationDefs />
        {annotations.map((ann) => renderAnnotation(ann))}
        {currentAnn && renderAnnotation(currentAnn)}

        {/* ── SVG Selection Highlights for Lines/Arrows ── */}
        {!readOnly && activeDrawTool === 'select' && selectedAnnId && (() => {
          const selAnn = annotations.find(a => a.id === selectedAnnId);
          if (!selAnn || selAnn.visible === false || selAnn.type === 'text') return null;

          // Point-based annotations (lines, arrows)
          if ((selAnn.type === 'line' || selAnn.type === 'arrow' || selAnn.type === 'doubleArrow') && selAnn.points && selAnn.points.length >= 2) {
            const transform = getAnnRotationTransform(selAnn, aspectRatio);

            return (
              <g className="selection-handles" data-ann-id={selAnn.id} transform={transform} pointerEvents="none">
                {selAnn.points.map((pt, i) => {
                  const isStart = i === 0;
                  const isEnd = i === selAnn.points!.length - 1;
                  const strokeColor = isStart ? '#38bdf8' : isEnd ? '#22c55e' : '#f59e0b';
                  const fillColor = isStart ? '#ffffff' : isEnd ? '#ffffff' : '#fbbf24';
                  const r = isStart || isEnd ? 8 : 6.5;

                  return (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={2.5}
                    />
                  );
                })}
              </g>
            );
          }

          return null;
        })()}
      </svg>

      {/* ── HTML Overlay for Text Annotations & Selected Shape Transform Controls ── */}
      {annotations.map((ann) => {
        if (ann.visible === false) return null;
        const isSelected = !readOnly && selectedAnnId === ann.id && activeDrawTool === 'select';
        
        // 1. Text Annotation Overlay
        if (ann.type === 'text') {
          const bounds = ann.bounds || { x: 300, y: 300, w: 400, h: 150 };
          const rotVal = ann.rotation || 0;

          const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
          const baseBgColor = ann.bgColor || '';
          const finalBgColor = baseBgColor
            ? hexToRgba(baseBgColor, bgOpacity)
            : ann.bgGlass
              ? `rgba(255, 255, 255, ${0.08 * bgOpacity})`
              : 'transparent';

          const glassStyle: React.CSSProperties = ann.bgGlass ? {
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          } : {};
          
          return (
            <div
              id={`text-layer-${ann.id}`}
              key={ann.id}
              style={{
                position: 'absolute',
                left: `${bounds.x / 10}%`,
                top: `${bounds.y / 10}%`,
                width: `${bounds.w / 10}%`,
                height: `${bounds.h / 10}%`,
                transform: `rotate(${rotVal}deg)`,
                minWidth: '60px',
                minHeight: '28px',
                backgroundColor: finalBgColor,
                zIndex: isSelected ? 50 : 20,
                pointerEvents: isSelected ? 'auto' : 'none',
                ...glassStyle,
              }}
              className={`select-none rounded flex flex-col items-stretch ${
                isSelected 
                  ? 'pointer-events-auto border-2 border-[#22c55e] shadow-lg shadow-black/60' 
                  : ann.bgGlass
                    ? 'pointer-events-none border-2 border-white/10'
                    : 'pointer-events-none border-2 border-transparent'
              }`}
            >
              <textarea
                value={ann.text || ''}
                onChange={isSelected ? (e) => {
                  const nextText = e.target.value;
                  onUpdateTextProps?.({ text: nextText });
                } : undefined}
                onPointerDown={isSelected ? (e) => e.stopPropagation() : undefined}
                onKeyDown={isSelected ? (e) => e.stopPropagation() : undefined}
                readOnly={!isSelected}
                tabIndex={isSelected ? 0 : -1}
                autoFocus={isSelected}
                style={{
                  fontFamily: ann.fontFamily || 'Space Grotesk',
                  fontSize: `${(ann.fontSize || 36) * scale}px`,
                  color: ann.color || '#ef4444',
                  fontWeight: ann.fontWeight || 'normal',
                  fontStyle: ann.fontStyle || 'normal',
                  textDecoration: ann.textDecoration || 'none',
                  textAlign: ann.textAlign || 'center',
                  lineHeight: ann.lineHeight !== undefined ? ann.lineHeight : 1.2,
                  letterSpacing: ann.letterSpacing !== undefined ? `${ann.letterSpacing}px` : '0px',
                  WebkitTextStroke: ann.textStroke || 'none',
                  textShadow: ann.textShadow || 'none',
                  textTransform: ann.textTransform || 'none',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  width: '100%',
                  height: '100%',
                  opacity: ann.opacity !== undefined ? ann.opacity : 1,
                  pointerEvents: isSelected ? 'auto' : 'none',
                }}
                className={`${
                  isSelected ? 'cursor-text' : 'cursor-default'
                } bg-transparent text-white outline-none ring-0 border-0 p-1 m-0 block focus:ring-0 focus:outline-none placeholder-zinc-500 overflow-hidden`}
                placeholder="Type text..."
              />

              {/* Corner Resize Handles & Actions */}
              {isSelected && renderTransformHandles(ann)}
            </div>
          );
        }

        // 2. Selected Vector Shape / Stroke Overlay (with Rotate & Resize handles)
        if (isSelected) {
          const bbox = getAnnotationBBox(ann);
          if (bbox.w === 0 && bbox.h === 0) return null;
          const rotVal = ann.rotation || 0;

          return (
            <div
              id={`ann-layer-${ann.id}`}
              key={`selected-shape-overlay-${ann.id}`}
              style={{
                position: 'absolute',
                left: `${bbox.x / 10}%`,
                top: `${bbox.y / 10}%`,
                width: `${Math.max(1, bbox.w) / 10}%`,
                height: `${Math.max(1, bbox.h) / 10}%`,
                transform: `rotate(${rotVal}deg)`,
                zIndex: 50,
                pointerEvents: 'none',
              }}
              // ponytail: no selection box — the dashed border sat exactly on the shape stroke;
              // corner/side handles + action bar are the entire selection chrome
              className="select-none rounded border-2 border-transparent"
            >
              {renderTransformHandles(ann)}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
