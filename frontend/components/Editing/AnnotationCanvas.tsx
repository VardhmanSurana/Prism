/**
 * AnnotationCanvas.tsx
 * An SVG drawing overlay layer that sits on top of the image canvas preview.
 * Handles mouse/pointer dragging to create and preview arrows, shapes, paths, and labels.
 */

import React, { useState, useRef } from 'react';
import { Annotation } from './AnnotationsPanel';

interface AnnotationCanvasProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  activeDrawTool: 'arrow' | 'circle' | 'rect' | 'freehand' | 'text' | 'eraser';
  activeColor: string;
  strokeWidth: number;
  readOnly?: boolean;
}

const pointDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Distance from point p to line segment v-w
const distToSegment = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return pointDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return pointDistance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

const getAnnotationDistance = (p: { x: number; y: number }, ann: Annotation): number => {
  if (ann.type === 'freehand' && ann.points) {
    let minDist = Infinity;
    for (let i = 0; i < ann.points.length; i++) {
      const dist = pointDistance(p, ann.points[i]);
      if (dist < minDist) minDist = dist;
    }
    for (let i = 0; i < ann.points.length - 1; i++) {
      const dist = distToSegment(p, ann.points[i], ann.points[i + 1]);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }
  if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
    return distToSegment(p, ann.points[0], ann.points[ann.points.length - 1]);
  }
  if (ann.type === 'rect' && ann.bounds) {
    const b = ann.bounds;
    const x0 = b.w < 0 ? b.x + b.w : b.x;
    const y0 = b.h < 0 ? b.y + b.h : b.y;
    const x1 = x0 + Math.abs(b.w);
    const y1 = y0 + Math.abs(b.h);

    const dLeft = distToSegment(p, { x: x0, y: y0 }, { x: x0, y: y1 });
    const dRight = distToSegment(p, { x: x1, y: y0 }, { x: x1, y: y1 });
    const dTop = distToSegment(p, { x: x0, y: y0 }, { x: x1, y: y0 });
    const dBottom = distToSegment(p, { x: x0, y: y1 }, { x: x1, y: y1 });

    return Math.min(dLeft, dRight, dTop, dBottom);
  }
  if (ann.type === 'circle' && ann.bounds) {
    const b = ann.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.abs(b.w) / 2;
    const ry = Math.abs(b.h) / 2;
    
    const angle = Math.atan2(p.y - cy, p.x - cx);
    const borderPoint = {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
    return pointDistance(p, borderPoint);
  }
  if (ann.type === 'text' && ann.points && ann.points.length > 0) {
    return pointDistance(p, ann.points[0]);
  }
  return Infinity;
};

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  annotations,
  onChange,
  activeDrawTool,
  activeColor,
  strokeWidth,
  readOnly = false,
}) => {
  const [currentAnn, setCurrentAnn] = useState<Annotation | null>(null);
  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const getCoordinates = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCoordinates(e);

    if (activeDrawTool === 'eraser') {
      isDrawing.current = true;
      const clickedAnn = annotations.find(ann => getAnnotationDistance({ x, y }, ann) < 35);
      if (clickedAnn) {
        onChange(annotations.filter(ann => ann.id !== clickedAnn.id));
      }
      return;
    }

    if (activeDrawTool === 'text') {
      const textVal = window.prompt("Enter text label:");
      if (textVal && textVal.trim() !== '') {
        const textAnn: Annotation = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'text',
          color: activeColor,
          strokeWidth: strokeWidth,
          points: [{ x, y }],
          text: textVal.trim(),
          fontSize: strokeWidth * 2.5 + 20, // scaled font size
        };
        onChange([...annotations, textAnn]);
      }
      return;
    }

    isDrawing.current = true;
    startPos.current = { x, y };

    const newAnn: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: activeDrawTool,
      color: activeColor,
      strokeWidth: strokeWidth,
      ...(activeDrawTool === 'freehand' || activeDrawTool === 'arrow'
        ? { points: [{ x, y }] }
        : { bounds: { x, y, w: 0, h: 0 } }
      ),
    };
    setCurrentAnn(newAnn);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    const { x, y } = getCoordinates(e);

    if (activeDrawTool === 'eraser') {
      const closeAnns = annotations.filter(ann => getAnnotationDistance({ x, y }, ann) < 35);
      if (closeAnns.length > 0) {
        const closeIds = new Set(closeAnns.map(ann => ann.id));
        onChange(annotations.filter(ann => !closeIds.has(ann.id)));
      }
      return;
    }

    if (!currentAnn) return;

    if (currentAnn.type === 'freehand' && currentAnn.points) {
      setCurrentAnn({
        ...currentAnn,
        points: [...currentAnn.points, { x, y }],
      });
    } else if (currentAnn.type === 'arrow' && currentAnn.points) {
      setCurrentAnn({
        ...currentAnn,
        points: [currentAnn.points[0], { x, y }],
      });
    } else if ((currentAnn.type === 'rect' || currentAnn.type === 'circle') && currentAnn.bounds) {
      setCurrentAnn({
        ...currentAnn,
        bounds: {
          x: startPos.current.x,
          y: startPos.current.y,
          w: x - startPos.current.x,
          h: y - startPos.current.y,
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDrawing.current = false;

    if (activeDrawTool === 'eraser') {
      return;
    }

    if (currentAnn) {
      // Validate annotation has some geometry
      let valid = true;
      if (currentAnn.type === 'freehand' && currentAnn.points && currentAnn.points.length < 2) valid = false;
      if (currentAnn.type === 'arrow' && currentAnn.points && currentAnn.points.length < 2) valid = false;
      if ((currentAnn.type === 'rect' || currentAnn.type === 'circle') && currentAnn.bounds) {
        if (Math.abs(currentAnn.bounds.w) < 3 && Math.abs(currentAnn.bounds.h) < 3) valid = false;
      }

      if (valid) {
        onChange([...annotations, currentAnn]);
      }
    }
    setCurrentAnn(null);
  };

  const renderArrow = (ann: Annotation) => {
    if (!ann.points || ann.points.length < 2) return null;
    const start = ann.points[0];
    const end = ann.points[ann.points.length - 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    // Scale arrow head relative to stroke width
    const headLength = Math.max(20, ann.strokeWidth * 3.5);
    
    const xTip = end.x;
    const yTip = end.y;
    const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
    const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
    const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
    const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);

    return (
      <g key={ann.id}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={ann.color}
          strokeWidth={ann.strokeWidth * 1.5}
          strokeLinecap="round"
        />
        <polygon
          points={`${xTip},${yTip} ${xLeft},${yLeft} ${xRight},${yRight}`}
          fill={ann.color}
        />
      </g>
    );
  };

  const renderFreehand = (ann: Annotation) => {
    if (!ann.points || ann.points.length === 0) return null;
    const pathData = ann.points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return (
      <path
        key={ann.id}
        d={pathData}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  const renderRect = (ann: Annotation) => {
    if (!ann.bounds) return null;
    const b = ann.bounds;
    const x = b.w < 0 ? b.x + b.w : b.x;
    const y = b.h < 0 ? b.y + b.h : b.y;
    const w = Math.abs(b.w);
    const h = Math.abs(b.h);

    return (
      <rect
        key={ann.id}
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth * 1.5}
      />
    );
  };

  const renderCircle = (ann: Annotation) => {
    if (!ann.bounds) return null;
    const b = ann.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.abs(b.w) / 2;
    const ry = Math.abs(b.h) / 2;

    return (
      <ellipse
        key={ann.id}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth * 1.5}
      />
    );
  };

  const renderText = (ann: Annotation) => {
    if (!ann.points || ann.points.length === 0 || !ann.text) return null;
    const p = ann.points[0];
    const fSize = ann.fontSize || 32;

    return (
      <text
        key={ann.id}
        x={p.x}
        y={p.y}
        fill={ann.color}
        fontSize={fSize}
        fontFamily="sans-serif"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: 'none', selectKeep: 'none' } as any}
      >
        {ann.text}
      </text>
    );
  };

  const renderAnnotation = (ann: Annotation) => {
    switch (ann.type) {
      case 'arrow': return renderArrow(ann);
      case 'freehand': return renderFreehand(ann);
      case 'rect': return renderRect(ann);
      case 'circle': return renderCircle(ann);
      case 'text': return renderText(ann);
      default: return null;
    }
  };

  return (
    <svg
      viewBox="0 0 1000 1000"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      onPointerDown={readOnly ? undefined : handlePointerDown}
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
      className={`absolute inset-0 w-full h-full select-none ${readOnly ? 'z-25 pointer-events-none' : 'z-45 touch-none'}`}
      style={{ 
        cursor: readOnly ? 'default' : (activeDrawTool === 'text' ? 'text' : 'crosshair'),
        pointerEvents: readOnly ? 'none' : 'auto'
      }}
    >
      {/* Renders existing annotations */}
      {annotations.map(ann => renderAnnotation(ann))}
      
      {/* Renders annotation currently in progress */}
      {currentAnn && renderAnnotation(currentAnn)}
    </svg>
  );
};
