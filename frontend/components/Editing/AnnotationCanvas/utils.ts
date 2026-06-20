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

  if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
    return distToSegment(p, ann.points[0], ann.points[ann.points.length - 1]);
  }
  if ((ann.type === 'rect' || ann.type === 'text') && ann.bounds) {
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
  if (ann.type === 'circle' && ann.bounds) {
    const b = ann.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.abs(b.w) / 2;
    const ry = Math.abs(b.h) / 2;

    if (rx > 0 && ry > 0) {
      const normalizedDist = ((p.x - cx) ** 2) / (rx ** 2) + ((p.y - cy) ** 2) / (ry ** 2);
      if (normalizedDist <= 1) return 0;
    }

    const angle = Math.atan2(p.y - cy, p.x - cx);
    const borderPoint = {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
    return pointDistance(p, borderPoint);
  }
  return Infinity;
};

const HANDLE_THRESHOLD = 30;

export const detectHandleClick = (x: number, y: number, ann: Annotation): HandleId | null => {
  if (ann.type === 'text') return null;
  if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
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

