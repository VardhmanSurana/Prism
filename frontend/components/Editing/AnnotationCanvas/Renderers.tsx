import React from 'react';
import { Annotation } from '../AnnotationsPanel';

interface RendererProps {
  ann: Annotation;
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

