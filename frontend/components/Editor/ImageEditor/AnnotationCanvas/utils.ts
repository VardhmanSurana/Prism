import { Annotation } from '../AnnotationsPanel';
import { HandleId } from './types';

export const pointDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const distToSegment = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return pointDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return pointDistance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

export const getAnnotationBBox = (ann: Annotation): { x: number; y: number; w: number; h: number } => {
  if (ann.bounds) {
    const x = ann.bounds.w < 0 ? ann.bounds.x + ann.bounds.w : ann.bounds.x;
    const y = ann.bounds.h < 0 ? ann.bounds.y + ann.bounds.h : ann.bounds.y;
    return { x, y, w: Math.abs(ann.bounds.w), h: Math.abs(ann.bounds.h) };
  }
  if (ann.points && ann.points.length > 0) {
    const xs = ann.points.map(p => p.x);
    const ys = ann.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
};

export const getAnnotationDistance = (p: { x: number; y: number }, ann: Annotation): number => {
  if ((ann.type === 'freehand' || ann.type === 'highlighter' || ann.type === 'textPath') && ann.points) {
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

  if ((ann.type === 'arrow' || ann.type === 'doubleArrow' || ann.type === 'line') && ann.points && ann.points.length >= 2) {
    return distToSegment(p, ann.points[0], ann.points[ann.points.length - 1]);
  }

  if (ann.bounds) {
    const b = ann.bounds;
    const x0 = b.w < 0 ? b.x + b.w : b.x;
    const y0 = b.h < 0 ? b.y + b.h : b.y;
    const x1 = x0 + Math.abs(b.w);
    const y1 = y0 + Math.abs(b.h);

    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return 0;

    const dLeft = distToSegment(p, { x: x0, y: y0 }, { x: x0, y: y1 });
    const dRight = distToSegment(p, { x: x1, y: y0 }, { x: x1, y: y1 });
    const dTop = distToSegment(p, { x: x0, y: y0 }, { x: x1, y: y0 });
    const dBottom = distToSegment(p, { x: x0, y: y1 }, { x: x1, y: y1 });

    return Math.min(dLeft, dRight, dTop, dBottom);
  }
  return Infinity;
};

const HANDLE_THRESHOLD = 30;

export const detectHandleClick = (x: number, y: number, ann: Annotation): HandleId | null => {
  if (ann.type === 'text') return null;
  if ((ann.type === 'arrow' || ann.type === 'doubleArrow' || ann.type === 'line') && ann.points && ann.points.length >= 2) {
    if (pointDistance({ x, y }, ann.points[0]) < HANDLE_THRESHOLD) return 'ep0';
    if (pointDistance({ x, y }, ann.points[ann.points.length - 1]) < HANDLE_THRESHOLD) return 'ep1';
    return null;
  }

  const bbox = getAnnotationBBox(ann);
  if (bbox.w === 0 && bbox.h === 0) return null;

  const edgeHandles: [HandleId, { x: number; y: number }][] = [
    ['tl', { x: bbox.x, y: bbox.y }],
    ['tr', { x: bbox.x + bbox.w, y: bbox.y }],
    ['bl', { x: bbox.x, y: bbox.y + bbox.h }],
    ['br', { x: bbox.x + bbox.w, y: bbox.y + bbox.h }],
    ['lm', { x: bbox.x, y: bbox.y + bbox.h / 2 }],
    ['rm', { x: bbox.x + bbox.w, y: bbox.y + bbox.h / 2 }],
  ];

  for (const [id, pos] of edgeHandles) {
    if (pointDistance({ x, y }, pos) < HANDLE_THRESHOLD) return id;
  }
  return null;
};

export const simplifyPoints = (points: { x: number; y: number }[], tolerance: number = 2): { x: number; y: number }[] => {
  if (points.length < 3) return points;
  const result = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy > tolerance * tolerance) {
      result.push(p);
      last = p;
    }
  }
  result.push(points[points.length - 1]);
  return result;
};

export const smoothChaikin = (points: { x: number; y: number }[], iterations: number = 2): { x: number; y: number }[] => {
  if (points.length < 3) return points;
  let current = points;
  for (let i = 0; i < iterations; i++) {
    const next: { x: number; y: number }[] = [];
    next.push(current[0]);
    for (let j = 0; j < current.length - 1; j++) {
      const p0 = current[j];
      const p1 = current[j + 1];
      
      const q = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      };
      const r = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      };
      
      next.push(q);
      next.push(r);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
};

export const smoothPath = (points: { x: number; y: number }[]): { x: number; y: number }[] => {
  if (!points || points.length < 3) return points;
  const simplified = simplifyPoints(points, 2.5);
  return smoothChaikin(simplified, 2);
};

/**
 * Computes an aspect-ratio-corrected affine transform matrix for SVG rotations.
 * Because the SVG coordinate space is normalized (0..1000, 0..1000) with preserveAspectRatio="none",
 * a standard rotate(deg) on non-1:1 images introduces shear/skew distortion.
 * This matrix rotates in isotropic screen pixel space without any distortion or loss of edges.
 */
export const getSvgRotationTransform = (
  deg?: number,
  cx: number = 0,
  cy: number = 0,
  aspectRatio: number = 1
): string | undefined => {
  if (!deg || deg % 360 === 0) return undefined;
  const A = aspectRatio > 0 ? aspectRatio : 1;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const a = cos;
  const b = A * sin;
  const c = -sin / A;
  const d = cos;
  const e = cx * (1 - cos) + (cy * sin) / A;
  const f = cy * (1 - cos) - cx * (A * sin);

  return `matrix(${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${e.toFixed(6)} ${f.toFixed(6)})`;
};


