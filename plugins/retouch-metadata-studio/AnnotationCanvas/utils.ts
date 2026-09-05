import { Annotation, DoodleLineStyle, LineTexture, LineTaper } from '../AnnotationsPanel';
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
    let minDist = Infinity;
    for (let i = 0; i < ann.points.length - 1; i++) {
      const d = distToSegment(p, ann.points[i], ann.points[i + 1]);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  if (ann.bounds) {
    let pt = p;
    if (ann.rotation) {
      const cx = ann.bounds.x + ann.bounds.w / 2;
      const cy = ann.bounds.y + ann.bounds.h / 2;
      const rad = (-ann.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = p.x - cx;
      const dy = p.y - cy;
      pt = {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    }

    const b = ann.bounds;
    const x0 = b.w < 0 ? b.x + b.w : b.x;
    const y0 = b.h < 0 ? b.y + b.h : b.y;
    const x1 = x0 + Math.abs(b.w);
    const y1 = y0 + Math.abs(b.h);

    if (pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1) return 0;

    const dLeft = distToSegment(pt, { x: x0, y: y0 }, { x: x0, y: y1 });
    const dRight = distToSegment(pt, { x: x1, y: y0 }, { x: x1, y: y1 });
    const dTop = distToSegment(pt, { x: x0, y: y0 }, { x: x1, y: y0 });
    const dBottom = distToSegment(pt, { x: x0, y: y1 }, { x: x1, y: y1 });

    return Math.min(dLeft, dRight, dTop, dBottom);
  }
  return Infinity;
};

const HANDLE_THRESHOLD = 30;

export const detectHandleClick = (x: number, y: number, ann: Annotation): HandleId | null => {
  if (ann.type === 'text') return null;
  if ((ann.type === 'arrow' || ann.type === 'doubleArrow' || ann.type === 'line') && ann.points && ann.points.length >= 2) {
    for (let i = 0; i < ann.points.length; i++) {
      if (pointDistance({ x, y }, ann.points[i]) < HANDLE_THRESHOLD) {
        return `ep${i}` as HandleId;
      }
    }
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
    ['tm', { x: bbox.x + bbox.w / 2, y: bbox.y }],
    ['bm', { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h }],
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

export const getAnnRotationTransform = (ann: Annotation, aspectRatio: number = 1): string | undefined => {
  const deg = ann.rotation || 0;
  if (!deg || deg % 360 === 0) return undefined;
  const bb = getAnnotationBBox(ann);
  return getSvgRotationTransform(deg, bb.x + bb.w / 2, bb.y + bb.h / 2, aspectRatio);
};

export const getRotationAttr = (ann: Annotation, aspectRatio: number = 1): string => {
  const t = getAnnRotationTransform(ann, aspectRatio);
  return t ? ` transform="${t}"` : '';
};

export type { DoodleLineStyle, LineTexture, LineTaper };

/**
 * Centripetal Catmull-Rom spline interpolation through arbitrary control points.
 * Guarantees the curve passes EXACTLY through every single waypoint!
 */
export function evaluateCatmullRom(
  pPrev: { x: number; y: number },
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  pNext: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const t2 = t * t;
  const t3 = t2 * t;

  const v0 = (p1.x - pPrev.x) * 0.5;
  const v1 = (pNext.x - p0.x) * 0.5;
  const x =
    (2 * p0.x - 2 * p1.x + v0 + v1) * t3 +
    (-3 * p0.x + 3 * p1.x - 2 * v0 - v1) * t2 +
    v0 * t +
    p0.x;

  const vy0 = (p1.y - pPrev.y) * 0.5;
  const vy1 = (pNext.y - p0.y) * 0.5;
  const y =
    (2 * p0.y - 2 * p1.y + vy0 + vy1) * t3 +
    (-3 * p0.y + 3 * p1.y - 2 * vy0 - vy1) * t2 +
    vy0 * t +
    p0.y;

  return { x, y };
}

export function generateSmoothSpline(
  controlPoints: { x: number; y: number }[],
  samplesPerSegment: number = 24
): { x: number; y: number }[] {
  const n = controlPoints.length;
  if (n < 2) return controlPoints;
  if (n === 2) {
    const p0 = controlPoints[0], p1 = controlPoints[1];
    const res: { x: number; y: number }[] = [];
    const total = 48;
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      res.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
    }
    return res;
  }

  const spine: { x: number; y: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const pPrev =
      i === 0
        ? { x: 2 * controlPoints[0].x - controlPoints[1].x, y: 2 * controlPoints[0].y - controlPoints[1].y }
        : controlPoints[i - 1];
    const p0 = controlPoints[i];
    const p1 = controlPoints[i + 1];
    const pNext =
      i + 2 >= n
        ? { x: 2 * controlPoints[n - 1].x - controlPoints[n - 2].x, y: 2 * controlPoints[n - 1].y - controlPoints[n - 2].y }
        : controlPoints[i + 2];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      spine.push(evaluateCatmullRom(pPrev, p0, p1, pNext, t));
    }
  }

  spine.push({ x: controlPoints[n - 1].x, y: controlPoints[n - 1].y });
  return spine;
}

/**
 * Calculates stroke width along normalized parameter t in [0, 1]
 */
export function getWidthAtParam(t: number, baseWidth: number, taperMode?: LineTaper): number {
  if (taperMode === 'hand') {
    // Hand brush: thin entry (25%) -> pressure swell in upper third (120%) -> organic tail taper (50%)
    const swell = Math.sin(Math.PI * (t ** 0.65));
    const entryTaper = Math.min(1, t * 5);
    const exitTaper = Math.max(0.45, 1 - (t ** 2) * 0.5);
    const naturalWobble = 1 + Math.sin(t * 14) * 0.08;
    return baseWidth * (0.22 + 0.95 * swell * entryTaper) * exitTaper * naturalWobble;
  } else if (taperMode === 'taperStart') {
    const ramp = t ** 0.8;
    return baseWidth * (0.15 + 0.95 * ramp);
  } else if (taperMode === 'taperBoth') {
    const taper = Math.sin(Math.PI * t) ** 0.55;
    return baseWidth * (0.12 + 1.1 * taper);
  } else if (taperMode === 'dynamic') {
    const pulse = 0.75 + 0.35 * Math.sin(t * Math.PI * 6);
    const ends = Math.sin(Math.PI * t) ** 0.35;
    return baseWidth * pulse * ends;
  }

  return baseWidth;
}

/**
 * Constructs a closed variable-width SVG ribbon polygon path with rounded end caps.
 */
export function constructVariableWidthRibbon(
  centerline: { x: number; y: number }[],
  baseWidth: number,
  taperMode?: LineTaper,
  style?: DoodleLineStyle
): string {
  const n = centerline.length;
  if (n < 2) return '';

  const leftSide: { x: number; y: number }[] = [];
  const rightSide: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    let p = centerline[i];
    const t = i / (n - 1);

    let dx: number, dy: number;
    if (i === 0) {
      dx = centerline[1].x - p.x;
      dy = centerline[1].y - p.y;
    } else if (i === n - 1) {
      dx = p.x - centerline[n - 2].x;
      dy = p.y - centerline[n - 2].y;
    } else {
      dx = centerline[i + 1].x - centerline[i - 1].x;
      dy = centerline[i + 1].y - centerline[i - 1].y;
    }

    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Apply optional overlay style
    if (style === 'sketch') {
      const jitter = (Math.sin(t * 18.5) * 2.5 + Math.sin(t * 37.2 + 1.1) * 1.5) * (Math.sin(Math.PI * t) ** 0.4);
      p = { x: p.x + nx * jitter, y: p.y + ny * jitter };
    } else if (style === 'wave') {
      const waveOff = 12 * Math.sin(t * Math.PI * 8) * (Math.sin(Math.PI * t) ** 0.4);
      p = { x: p.x + nx * waveOff, y: p.y + ny * waveOff };
    }

    const halfWidth = getWidthAtParam(t, baseWidth, taperMode) / 2;

    leftSide.push({ x: p.x + nx * halfWidth, y: p.y + ny * halfWidth });
    rightSide.push({ x: p.x - nx * halfWidth, y: p.y - ny * halfWidth });
  }

  const pStart = centerline[0];
  const pEnd = centerline[n - 1];

  let d = `M ${leftSide[0].x.toFixed(1)} ${leftSide[0].y.toFixed(1)} `;

  for (let i = 1; i < leftSide.length; i++) {
    d += `L ${leftSide[i].x.toFixed(1)} ${leftSide[i].y.toFixed(1)} `;
  }

  const lastR = rightSide[rightSide.length - 1];
  const tipControl = {
    x: pEnd.x + (pEnd.x - centerline[n - 2].x) * 0.4,
    y: pEnd.y + (pEnd.y - centerline[n - 2].y) * 0.4,
  };
  d += `Q ${tipControl.x.toFixed(1)} ${tipControl.y.toFixed(1)} ${lastR.x.toFixed(1)} ${lastR.y.toFixed(1)} `;

  for (let i = rightSide.length - 2; i >= 0; i--) {
    d += `L ${rightSide[i].x.toFixed(1)} ${rightSide[i].y.toFixed(1)} `;
  }

  const firstL = leftSide[0];
  const startControl = {
    x: pStart.x - (centerline[1].x - pStart.x) * 0.4,
    y: pStart.y - (centerline[1].y - pStart.y) * 0.4,
  };
  d += `Q ${startControl.x.toFixed(1)} ${startControl.y.toFixed(1)} ${firstL.x.toFixed(1)} ${firstL.y.toFixed(1)} Z`;

  return d;
}

/**
 * Distance squared from point p to segment v-w.
 */
export function distToSegmentSquared(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

/**
 * Finds index of closest segment in a polyline to insert a new point.
 */
export function findClosestSegmentIndex(
  point: { x: number; y: number },
  points: { x: number; y: number }[]
): number {
  let bestIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegmentSquared(point, points[i], points[i + 1]);
    if (d < minDistance) {
      minDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Generates decorative doodle points along a straight segment.
 */
export const doodleLinePoints = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  style: DoodleLineStyle
): { x: number; y: number }[] => {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [p0, p1];
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const amp = Math.min(28, Math.max(8, len * 0.08));

  if (style === 'zigzag') {
    const n = Math.max(4, Math.round(len / 28));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = i === 0 || i === n ? 0 : (i % 2 === 1 ? amp : -amp) * Math.sin(Math.PI * t) ** 0.5;
      pts.push({ x: p0.x + dx * t + nx * off, y: p0.y + dy * t + ny * off });
    }
    return pts;
  }

  if (style === 'ripple') {
    const waves = Math.max(3, Math.round(len / 34));
    const n = Math.max(24, waves * 10);
    const microAmp = amp * 0.45;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.sin(Math.PI * t) ** 0.3;
      const off = microAmp * Math.sin(t * waves * Math.PI * 2) * taper;
      pts.push({ x: p0.x + dx * t + nx * off, y: p0.y + dy * t + ny * off });
    }
    return pts;
  }

  if (style === 'loop') {
    const coils = Math.max(2, Math.round(len / 65));
    const n = coils * 24;
    const radius = amp * 0.75;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const theta = t * coils * Math.PI * 2;
      const taper = Math.sin(Math.PI * t) ** 0.35;
      const loopFwd = radius * Math.sin(theta) * 0.8 * taper;
      const loopNorm = radius * (1 - Math.cos(theta)) * taper;
      pts.push({
        x: p0.x + ux * (t * len + loopFwd) + nx * loopNorm,
        y: p0.y + uy * (t * len + loopFwd) + ny * loopNorm,
      });
    }
    return pts;
  }

  if (style === 'sketch') {
    const n = Math.max(16, Math.round(len / 15));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.sin(Math.PI * t) ** 0.3;
      const wobble = (Math.sin(t * 8.5) * 4 + Math.sin(t * 19.3 + 1.2) * 2.5) * taper;
      pts.push({ x: p0.x + dx * t + nx * wobble, y: p0.y + dy * t + ny * wobble });
    }
    return pts;
  }

  if (style === 'arc') {
    const n = 24;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const arcOff = amp * 1.8 * (4 * t * (1 - t));
      pts.push({ x: p0.x + dx * t + nx * arcOff, y: p0.y + dy * t + ny * arcOff });
    }
    return pts;
  }

  if (style === 'sCurve') {
    const n = 32;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.sin(Math.PI * t) ** 0.3;
      const sOff = amp * 1.4 * Math.sin(t * Math.PI * 2) * taper;
      pts.push({ x: p0.x + dx * t + nx * sOff, y: p0.y + dy * t + ny * sOff });
    }
    return pts;
  }

  // Default 'wave'
  const waves = Math.max(1, Math.round(len / 140));
  const n = Math.max(16, waves * 16);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const taper = Math.sin(Math.PI * t) ** 0.4;
    const off = amp * Math.sin(t * waves * Math.PI * 2) * taper;
    pts.push({ x: p0.x + dx * t + nx * off, y: p0.y + dy * t + ny * off });
  }
  return pts;
};


