import React from 'react';
import { Annotation } from '../AnnotationsPanel';
import { smoothPath, getAnnotationBBox } from './utils';
import {
  VectorShapeType,
  getPolygonPoints,
  getShapePathString,
  normalizeBounds,
} from './shapeUtils';

interface RendererProps {
  ann: Annotation;
  showGuide?: boolean;
  aspectRatio?: number;
}

const arePropsEqual = (prev: RendererProps, next: RendererProps) => {
  return (
    prev.ann === next.ann &&
    prev.showGuide === next.showGuide &&
    prev.aspectRatio === next.aspectRatio
  );
};

export const ArrowRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length < 2) return null;
  const start = ann.points[0];
  const end = ann.points[ann.points.length - 1];
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  const headLength = Math.max(20, ann.strokeWidth * 4);

  const xTip = end.x;
  const yTip = end.y;
  const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
  const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
  const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
  const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);

  const xBase = end.x - headLength * Math.cos(angle) * 0.8;
  const yBase = end.y - headLength * Math.sin(angle) * 0.8;

  const rotVal = ann.rotation || 0;
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

  return (
    <g transform={transform} opacity={ann.opacity ?? 1}>
      <line
        x1={start.x}
        y1={start.y}
        x2={xBase}
        y2={yBase}
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
}, arePropsEqual);

export const FreehandRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length === 0) return null;
  const smoothed = smoothPath(ann.points);
  const pathData = smoothed
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const rotVal = ann.rotation || 0;
  const bbox = getAnnotationBBox(ann);
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

  return (
    <g transform={transform}>
      <path
        d={pathData}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={ann.opacity ?? 1}
      />
    </g>
  );
}, arePropsEqual);

export const HighlighterRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length === 0) return null;
  const smoothed = smoothPath(ann.points);
  const pathData = smoothed
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const rotVal = ann.rotation || 0;
  const bbox = getAnnotationBBox(ann);
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

  return (
    <g transform={transform}>
      <path
        d={pathData}
        fill="none"
        stroke={ann.color}
        strokeWidth={ann.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={ann.opacity ?? 0.4}
        style={{ mixBlendMode: 'multiply' } as any}
      />
    </g>
  );
}, arePropsEqual);

export const VectorShapeRenderer = React.memo(({ ann }: RendererProps) => {
  const fill = ann.fillShape ? ann.color : 'none';
  const fillOpacity = ann.fillShape ? (ann.fillOpacity ?? 0.5) : undefined;
  const stroke = ann.color;
  const strokeWidth = ann.strokeWidth * 1.5;
  const opacity = ann.opacity ?? 1;
  const rotVal = ann.rotation || 0;

  if (ann.type === 'line' && ann.points && ann.points.length >= 2) {
    const start = ann.points[0];
    const end = ann.points[ann.points.length - 1];
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

    return (
      <g transform={transform} opacity={opacity}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
    const start = ann.points[0];
    const end = ann.points[ann.points.length - 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = Math.max(20, ann.strokeWidth * 4);

    const xTip = end.x;
    const yTip = end.y;
    const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
    const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
    const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
    const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);
    const xBase = end.x - headLength * Math.cos(angle) * 0.8;
    const yBase = end.y - headLength * Math.sin(angle) * 0.8;

    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

    return (
      <g transform={transform} opacity={opacity}>
        <line
          x1={start.x}
          y1={start.y}
          x2={xBase}
          y2={yBase}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <polygon
          points={`${xTip},${yTip} ${xLeft},${yLeft} ${xRight},${yRight}`}
          fill={stroke}
        />
      </g>
    );
  }

  if (ann.type === 'doubleArrow' && ann.points && ann.points.length >= 2) {
    const start = ann.points[0];
    const end = ann.points[ann.points.length - 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = Math.max(20, ann.strokeWidth * 4);

    // End arrowhead
    const xTip1 = end.x;
    const yTip1 = end.y;
    const xLeft1 = end.x - headLength * Math.cos(angle - Math.PI / 6);
    const yLeft1 = end.y - headLength * Math.sin(angle - Math.PI / 6);
    const xRight1 = end.x - headLength * Math.cos(angle + Math.PI / 6);
    const yRight1 = end.y - headLength * Math.sin(angle + Math.PI / 6);
    const xBase1 = end.x - headLength * Math.cos(angle) * 0.8;
    const yBase1 = end.y - headLength * Math.sin(angle) * 0.8;

    // Start arrowhead
    const xTip0 = start.x;
    const yTip0 = start.y;
    const xLeft0 = start.x + headLength * Math.cos(angle - Math.PI / 6);
    const yLeft0 = start.y + headLength * Math.sin(angle - Math.PI / 6);
    const xRight0 = start.x + headLength * Math.cos(angle + Math.PI / 6);
    const yRight0 = start.y + headLength * Math.sin(angle + Math.PI / 6);
    const xBase0 = start.x + headLength * Math.cos(angle) * 0.8;
    const yBase0 = start.y + headLength * Math.sin(angle) * 0.8;

    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

    return (
      <g transform={transform} opacity={opacity}>
        <line
          x1={xBase0}
          y1={yBase0}
          x2={xBase1}
          y2={yBase1}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <polygon
          points={`${xTip1},${yTip1} ${xLeft1},${yLeft1} ${xRight1},${yRight1}`}
          fill={stroke}
        />
        <polygon
          points={`${xTip0},${yTip0} ${xLeft0},${yLeft0} ${xRight0},${yRight0}`}
          fill={stroke}
        />
      </g>
    );
  }

  if (!ann.bounds) return null;
  const { x, y, w, h } = normalizeBounds(ann.bounds);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

  if (ann.type === 'rect') {
    return (
      <g transform={transform}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      </g>
    );
  }

  if (ann.type === 'roundedRect') {
    const r = Math.min(w, h) * 0.15;
    return (
      <g transform={transform}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      </g>
    );
  }

  if (ann.type === 'circle') {
    return (
      <g transform={transform}>
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      </g>
    );
  }

  // Geometric regular polygon shapes
  const polyPoints = getPolygonPoints(ann.type as VectorShapeType, ann.bounds);
  if (polyPoints) {
    return (
      <g transform={transform}>
        <polygon
          points={polyPoints}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          opacity={opacity}
        />
      </g>
    );
  }

  // Path-based shapes (heart, speechBubble, cloud, lightning, stars, etc.)
  const pathD = getShapePathString(ann.type as VectorShapeType, ann.bounds);
  if (pathD) {
    return (
      <g transform={transform}>
        <path
          d={pathD}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={opacity}
        />
      </g>
    );
  }

  return null;
}, arePropsEqual);

export const RectRenderer = VectorShapeRenderer;
export const CircleRenderer = VectorShapeRenderer;

const calculatePathLength = (points: { x: number; y: number }[]) => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

export const TextPathRenderer = React.memo(({ ann }: RendererProps) => {
  if (!ann.points || ann.points.length < 2) return null;
  const pathId = `path-${ann.id}`;
  const smoothed = smoothPath(ann.points);
  const d = smoothed
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const showGuide = ann.showGuidePath !== false;
  
  // Repeat text to fill path length
  const text = ann.doodleText || 'peace in the air';
  const pathLen = calculatePathLength(smoothed);
  const fontSize = ann.fontSize || 18;
  const charWidth = fontSize * 0.35;
  const wordLen = text.length * charWidth + 10;
  const repeats = Math.max(2, Math.ceil(pathLen / wordLen) + 3);
  const repeatedText = Array(repeats).fill(text).join('   ');

  const rotVal = ann.rotation || 0;
  const bbox = getAnnotationBBox(ann);
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const transform = rotVal !== 0 ? `rotate(${rotVal} ${cx} ${cy})` : undefined;

  return (
    <g transform={transform} opacity={ann.opacity ?? 1}>
      <defs>
        <path id={pathId} d={d} />
      </defs>
      {showGuide && (
        <path
          d={d}
          fill="none"
          stroke={ann.color}
          strokeWidth={1.2}
          opacity={0.25}
        />
      )}
      <text
        fill={ann.color}
        fontSize={fontSize}
        fontFamily={ann.fontFamily || 'Space Grotesk'}
      >
        <textPath href={`#${pathId}`} startOffset="4">
          {repeatedText}
        </textPath>
      </text>
    </g>
  );
}, arePropsEqual);

export const TextRenderer = React.memo(({ ann, aspectRatio }: RendererProps) => {
  if (!ann.bounds) return null;
  const b = ann.bounds;
  const x = b.x;
  const y = b.y;
  const fontSize = ann.fontSize || 36;
  const fontFamily = ann.fontFamily || 'Inter';
  const text = ann.text || '';
  const lines = text.split('\n');

  const alignment = ann.textAlign || 'center';
  const textAnchor = alignment === 'center' ? 'middle' : alignment === 'right' ? 'end' : 'start';

  const textX = alignment === 'center' ? x + b.w / 2 : alignment === 'right' ? x + b.w : x;
  const textY = y + fontSize * 0.8;

  const rotVal = ann.rotation || 0;
  const cx = x + b.w / 2;
  const cy = y + b.h / 2;

  const baseBgColor = ann.bgColor || '';
  const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
  const finalBgColor = baseBgColor ? `rgba(0,0,0,${bgOpacity})` : 'transparent';

  return (
    <g
      transform={rotVal ? `rotate(${rotVal} ${cx} ${cy})` : undefined}
      opacity={ann.opacity !== undefined ? ann.opacity : 1}
    >
      {/* Background card if specified */}
      {baseBgColor && (
        <rect
          x={x}
          y={y}
          width={b.w}
          height={b.h}
          rx={8}
          ry={8}
          fill={finalBgColor}
          stroke={ann.color}
          strokeWidth={1}
        />
      )}

      {/* Multiline Text */}
      {lines.map((line, idx) => (
        <text
          key={idx}
          x={textX}
          y={textY + idx * (fontSize * (ann.lineHeight || 1.2))}
          fill={ann.color || '#ffffff'}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontWeight={ann.fontWeight || 'normal'}
          fontStyle={ann.fontStyle || 'normal'}
          textDecoration={ann.textDecoration || 'none'}
          textAnchor={textAnchor}
          dominantBaseline="hanging"
          style={{
            letterSpacing: ann.letterSpacing ? `${ann.letterSpacing}px` : undefined,
            textTransform: (ann.textTransform as any) || 'none',
          }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}, arePropsEqual);
