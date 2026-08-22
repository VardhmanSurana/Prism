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
} from './Renderers';
import { getAnnotationBBox, getSvgRotationTransform } from './utils';

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
    switch (ann.type) {
      case 'freehand': return <FreehandRenderer key={ann.id} ann={ann} aspectRatio={aspectRatio} />;
      case 'highlighter': return <HighlighterRenderer key={ann.id} ann={ann} aspectRatio={aspectRatio} />;
      case 'textPath': return <TextPathRenderer key={ann.id} ann={ann} aspectRatio={aspectRatio} />;
      default: return <VectorShapeRenderer key={ann.id} ann={ann} aspectRatio={aspectRatio} />;
    }
  };

  const handleDoubleClickWithEdit = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    handleDoubleClick(e);
  }, [handleDoubleClick]);

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
                return 'move';
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
        {annotations.map((ann) => renderAnnotation(ann))}
        {currentAnn && renderAnnotation(currentAnn)}

        {/* ── SVG Selection Highlights for Lines/Arrows ── */}
        {!readOnly && activeDrawTool === 'select' && selectedAnnId && (() => {
          const selAnn = annotations.find(a => a.id === selectedAnnId);
          if (!selAnn || selAnn.visible === false || selAnn.type === 'text') return null;

          // Point-based annotations (lines, arrows)
          if ((selAnn.type === 'line' || selAnn.type === 'arrow' || selAnn.type === 'doubleArrow') && selAnn.points && selAnn.points.length >= 2) {
            const p0 = selAnn.points[0];
            const p1 = selAnn.points[selAnn.points.length - 1];
            const rotVal = selAnn.rotation || 0;
            const cx = (p0.x + p1.x) / 2;
            const cy = (p0.y + p1.y) / 2;
            const transform = getSvgRotationTransform(rotVal, cx, cy, aspectRatio);

            return (
              <g className="selection-handles" transform={transform} pointerEvents="none">
                <circle
                  cx={p0.x}
                  cy={p0.y}
                  r={8}
                  fill="#ffffff"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                />
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r={8}
                  fill="#ffffff"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                />
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
              {isSelected && (
                <>
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'tl', ann.id)}
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'tr', ann.id)}
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'bl', ann.id)}
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                    title="Resize"
                  />
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'br', ann.id)}
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                    title="Resize"
                  />

                  {/* Side Pills */}
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'lm', ann.id)}
                    className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-1.5 h-3 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                    title="Resize Width"
                  />
                  <div
                    onPointerDown={(e) => handleTextResizeStart(e, 'rm', ann.id)}
                    className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-1.5 h-3 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                    title="Resize Width"
                  />

                  {/* Bottom Actions Bar (Rotate & Move) */}
                  <div
                    className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-3 py-1.5 bg-zinc-950/95 border border-zinc-800 rounded-full shadow-2xl z-50"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {/* Rotate Handle */}
                    <div
                      onPointerDown={(e) => handleTextRotateStart(e, ann.id)}
                      className="w-9 h-9 rounded-full flex items-center justify-center cursor-alias transition active:scale-95 shadow bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]"
                      title="Drag to Rotate"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6m-9 10a9 9 0 1 1 12.36-4"/>
                      </svg>
                    </div>

                    {/* Move Handle */}
                    <div
                      onPointerDown={(e) => handleTextMoveStart(e, ann.id)}
                      className="w-9 h-9 rounded-full flex items-center justify-center cursor-move transition active:scale-90 shadow bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]"
                      title="Drag to Move"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 12 19"></polyline>
                        <polyline points="15 3 12 5 9 3"></polyline>
                        <polyline points="3 15 5 12 3 9"></polyline>
                        <polyline points="15 21 12 19 9 21"></polyline>
                        <polyline points="21 15 19 12 21 9"></polyline>
                      </svg>
                    </div>

                    {rotVal !== 0 && (
                      <span className="text-[10px] font-mono text-zinc-400 pl-1 pr-1 font-semibold">
                        {rotVal}°
                      </span>
                    )}
                  </div>
                </>
              )}
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
              className="select-none rounded border-2 border-dashed border-[#22c55e] shadow-lg shadow-black/40"
            >
              {/* Corner Resize Handles */}
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'tl', ann.id)}
                className="pointer-events-auto absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                title="Resize"
              />
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'tr', ann.id)}
                className="pointer-events-auto absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                title="Resize"
              />
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'bl', ann.id)}
                className="pointer-events-auto absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#22c55e] rounded-full cursor-nesw-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                title="Resize"
              />
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'br', ann.id)}
                className="pointer-events-auto absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#22c55e] rounded-full cursor-nwse-resize z-50 shadow shadow-black/80 hover:scale-125 transition-transform"
                title="Resize"
              />

              {/* Side Resize Handles */}
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'lm', ann.id)}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-3.5 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                title="Resize Width"
              />
              <div
                onPointerDown={(e) => handleTextResizeStart(e, 'rm', ann.id)}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-3.5 bg-white border border-[#22c55e] rounded-full cursor-ew-resize z-50 shadow shadow-black/80 hover:scale-y-125 transition-transform"
                title="Resize Width"
              />

              {/* Top Center Stem Rotate Handle */}
              <div
                className="pointer-events-auto absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-50"
                onPointerDown={(e) => handleTextRotateStart(e, ann.id)}
                title="Drag to Rotate"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition active:scale-110 shadow-lg bg-zinc-900 hover:bg-zinc-800 border-2 border-[#22c55e] text-[#22c55e]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6m-9 10a9 9 0 1 1 12.36-4"/>
                  </svg>
                </div>
                <div className="w-0.5 h-3 bg-[#22c55e]" />
              </div>

              {/* Bottom Actions Bar (Rotate & Move) */}
              <div
                className="pointer-events-auto absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-3 py-1.5 bg-zinc-950/95 border border-zinc-800 rounded-full shadow-2xl z-50"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Rotate Handle */}
                <div
                  onPointerDown={(e) => handleTextRotateStart(e, ann.id)}
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-alias transition active:scale-95 shadow bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]"
                  title="Drag to Rotate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6m-9 10a9 9 0 1 1 12.36-4"/>
                  </svg>
                </div>

                {/* Move Handle */}
                <div
                  onPointerDown={(e) => handleTextMoveStart(e, ann.id)}
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-move transition active:scale-90 shadow bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#22c55e] text-zinc-300 hover:text-[#22c55e]"
                  title="Drag to Move"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 12 19"></polyline>
                    <polyline points="15 3 12 5 9 3"></polyline>
                    <polyline points="3 15 5 12 3 9"></polyline>
                    <polyline points="15 21 12 19 9 21"></polyline>
                    <polyline points="21 15 19 12 21 9"></polyline>
                  </svg>
                </div>

                {rotVal !== 0 && (
                  <span className="text-[10px] font-mono text-zinc-400 pl-1 pr-1 font-semibold">
                    {rotVal}°
                  </span>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
