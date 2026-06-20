import React from 'react';
import { Annotation } from '../AnnotationsPanel';

interface RendererProps {
  ann: Annotation;
  showGuide?: boolean;
  aspectRatio?: number;
}

export const ArrowRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.points || ann.points.length < 2) return null;
  const start = ann.points[0];
  const end = ann.points[ann.points.length - 1];
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  const headLength = Math.max(20, ann.strokeWidth * 4);

  const xTip = end.x;
  const yTip = end.y;
  const xLeft =
    end.x - headLength * Math.cos(angle - Math.PI / 6);
  const yLeft =
    end.y - headLength * Math.sin(angle - Math.PI / 6);
  const xRight =
    end.x - headLength * Math.cos(angle + Math.PI / 6);
  const yRight =
    end.y - headLength * Math.sin(angle + Math.PI / 6);

  const xBase = end.x - headLength * Math.cos(angle) * 0.8;
  const yBase = end.y - headLength * Math.sin(angle) * 0.8;

  return (
    <g opacity={ann.opacity ?? 1}>
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
};

export const FreehandRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.points || ann.points.length === 0) return null;
  const pathData = ann.points
    .map(
      (p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    )
    .join(' ');

  return (
    <path
      d={pathData}
      fill="none"
      stroke={ann.color}
      strokeWidth={ann.strokeWidth * 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={ann.opacity ?? 1}
    />
  );
};

export const HighlighterRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.points || ann.points.length === 0) return null;
  const pathData = ann.points
    .map(
      (p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    )
    .join(' ');

  return (
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
  );
};

export const RectRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.bounds) return null;
  const b = ann.bounds;
  const x = b.w < 0 ? b.x + b.w : b.x;
  const y = b.h < 0 ? b.y + b.h : b.y;
  const w = Math.abs(b.w);
  const h = Math.abs(b.h);

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="none"
      stroke={ann.color}
      strokeWidth={ann.strokeWidth * 1.5}
      opacity={ann.opacity ?? 1}
    />
  );
};

export const CircleRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.bounds) return null;
  const b = ann.bounds;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = Math.abs(b.w) / 2;
  const ry = Math.abs(b.h) / 2;

  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={ann.color}
      strokeWidth={ann.strokeWidth * 1.5}
      opacity={ann.opacity ?? 1}
    />
  );
};

const calculatePathLength = (points: { x: number; y: number }[]) => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

export const TextPathRenderer: React.FC<RendererProps> = ({ ann }) => {
  if (!ann.points || ann.points.length < 2) return null;
  const pathId = `path-${ann.id}`;
  const d = ann.points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const showGuide = ann.showGuidePath !== false;
  
  // Repeat text to fill path length
  const text = ann.doodleText || 'peace in the air';
  const pathLen = calculatePathLength(ann.points);
  const fontSize = ann.fontSize || 18;
  const charWidth = fontSize * 0.6;
  const wordLen = text.length * charWidth + 15;
  const repeats = Math.max(1, Math.ceil(pathLen / wordLen) + 1);
  const repeatedText = Array(repeats).fill(text).join('   ');

  return (
    <g opacity={ann.opacity ?? 1}>
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
};

export const TextRenderer: React.FC<RendererProps> = ({ ann, aspectRatio }) => {
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
  const fillOpacity = baseBgColor ? bgOpacity : (ann.bgGlass ? 0.08 * bgOpacity : 0);
  const fillColor = baseBgColor || (ann.bgGlass ? '#ffffff' : 'transparent');

  const bgRect = (baseBgColor || ann.bgGlass) ? (
    <rect
      x={x}
      y={y}
      width={b.w}
      height={b.h}
      fill={fillColor}
      fillOpacity={fillOpacity}
      transform={rotVal ? `rotate(${rotVal}, ${cx}, ${cy})` : undefined}
      opacity={ann.opacity ?? 1}
    />
  ) : null;

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: ann.fontWeight || 'normal',
    fontStyle: ann.fontStyle || 'normal',
    textDecoration: ann.textDecoration || 'none',
    WebkitTextStroke: ann.textStroke || 'none',
    textShadow: ann.textShadow || 'none',
    textTransform: ann.textTransform || 'none',
    pointerEvents: 'none',
  };

  const aspect = aspectRatio || 1;
  const textTransform = `rotate(${rotVal}, ${cx}, ${cy}) translate(${textX}, ${textY}) scale(${1 / aspect}, 1)`;

  return (
    <g opacity={ann.opacity ?? 1}>
      {bgRect}
      <text
        x={0}
        y={0}
        textAnchor={textAnchor}
        fontSize={fontSize}
        fill={ann.color}
        transform={textTransform}
        style={textStyle}
      >
        {lines.map((line, idx) => (
          <tspan
            key={idx}
            x={0}
            dy={idx === 0 ? 0 : `${ann.lineHeight || 1.2}em`}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};
