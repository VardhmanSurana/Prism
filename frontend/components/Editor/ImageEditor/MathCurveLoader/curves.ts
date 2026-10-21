/**
 * curves.ts
 * 12 Mathematical parametric curve definitions.
 */

import { MathCurveType, CurveDefinition } from './types';

export const MATH_CURVES: Record<MathCurveType, CurveDefinition> = {
  'rose-orbit': {
    id: 'rose-orbit',
    name: 'Rose Orbit',
    formula: 'r(t) = 7.0 - 2.7s cos(7t)',
    rotate: true,
    particleCount: 72,
    trailSpan: 0.42,
    durationMs: 5200,
    rotationDurationMs: 28000,
    pulseDurationMs: 4600,
    strokeWidth: 5.2,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const k = 7;
      const r = 7 - 2.7 * detailScale * Math.cos(k * t);
      return {
        x: 50 + Math.cos(t) * r * 3.9,
        y: 50 + Math.sin(t) * r * 3.9,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'original-thinking': {
    id: 'original-thinking',
    name: 'Original Thinking',
    formula: 'x(t) = 50 + (7.0 cos t - 3.0s cos 7t) * 3.9',
    rotate: true,
    particleCount: 64,
    trailSpan: 0.38,
    durationMs: 4600,
    rotationDurationMs: 28000,
    pulseDurationMs: 4200,
    strokeWidth: 5.5,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const x = 7 * Math.cos(t) - 3 * detailScale * Math.cos(7 * t);
      const y = 7 * Math.sin(t) - 3 * detailScale * Math.sin(7 * t);
      return {
        x: 50 + x * 3.9,
        y: 50 + y * 3.9,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'thinking-five': {
    id: 'thinking-five',
    name: 'Thinking Five',
    formula: 'x(t) = 50 + (7.0 cos t - 3.0s cos 5t) * 3.9',
    rotate: true,
    particleCount: 62,
    trailSpan: 0.38,
    durationMs: 4600,
    rotationDurationMs: 28000,
    pulseDurationMs: 4200,
    strokeWidth: 5.5,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const x = 7 * Math.cos(t) - 3 * detailScale * Math.cos(5 * t);
      const y = 7 * Math.sin(t) - 3 * detailScale * Math.sin(5 * t);
      return {
        x: 50 + x * 3.9,
        y: 50 + y * 3.9,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'thinking-nine': {
    id: 'thinking-nine',
    name: 'Thinking Nine',
    formula: 'x(t) = 50 + (7.0 cos t - 3.0s cos 9t) * 3.9',
    rotate: true,
    particleCount: 68,
    trailSpan: 0.39,
    durationMs: 4700,
    rotationDurationMs: 30000,
    pulseDurationMs: 4200,
    strokeWidth: 5.5,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const x = 7 * Math.cos(t) - 3 * detailScale * Math.cos(9 * t);
      const y = 7 * Math.sin(t) - 3 * detailScale * Math.sin(9 * t);
      return {
        x: 50 + x * 3.9,
        y: 50 + y * 3.9,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'rose-three': {
    id: 'rose-three',
    name: 'Rose Three',
    formula: 'r(t) = (9.2 + 0.60s)(0.72 + 0.28s) cos(3t)',
    rotate: true,
    particleCount: 76,
    trailSpan: 0.31,
    durationMs: 5300,
    rotationDurationMs: 28000,
    pulseDurationMs: 4400,
    strokeWidth: 4.6,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const a = 9.2 + detailScale * 0.6;
      const r = a * (0.72 + detailScale * 0.28) * Math.cos(3 * t);
      return {
        x: 50 + Math.cos(t) * r * 3.25,
        y: 50 + Math.sin(t) * r * 3.25,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'rose-curve': {
    id: 'rose-curve',
    name: 'Rose Curve',
    formula: 'r(t) = (9.2 + 0.60s)(0.72 + 0.28s) cos(5t)',
    rotate: true,
    particleCount: 78,
    trailSpan: 0.32,
    durationMs: 5400,
    rotationDurationMs: 28000,
    pulseDurationMs: 4600,
    strokeWidth: 4.5,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const a = 9.2 + detailScale * 0.6;
      const r = a * (0.72 + detailScale * 0.28) * Math.cos(5 * t);
      return {
        x: 50 + Math.cos(t) * r * 3.25,
        y: 50 + Math.sin(t) * r * 3.25,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'rose-two': {
    id: 'rose-two',
    name: 'Rose Two',
    formula: 'r(t) = (9.2 + 0.60s)(0.72 + 0.28s) cos(2t)',
    rotate: true,
    particleCount: 74,
    trailSpan: 0.3,
    durationMs: 5200,
    rotationDurationMs: 28000,
    pulseDurationMs: 4300,
    strokeWidth: 4.6,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const a = 9.2 + detailScale * 0.6;
      const r = a * (0.72 + detailScale * 0.28) * Math.cos(2 * t);
      return {
        x: 50 + Math.cos(t) * r * 3.25,
        y: 50 + Math.sin(t) * r * 3.25,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'rose-four': {
    id: 'rose-four',
    name: 'Rose Four',
    formula: 'r(t) = (9.2 + 0.60s)(0.72 + 0.28s) cos(4t)',
    rotate: true,
    particleCount: 78,
    trailSpan: 0.32,
    durationMs: 5400,
    rotationDurationMs: 28000,
    pulseDurationMs: 4500,
    strokeWidth: 4.6,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const a = 9.2 + detailScale * 0.6;
      const r = a * (0.72 + detailScale * 0.28) * Math.cos(4 * t);
      return {
        x: 50 + Math.cos(t) * r * 3.25,
        y: 50 + Math.sin(t) * r * 3.25,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'lemniscate-bloom': {
    id: 'lemniscate-bloom',
    name: 'Lemniscate Bloom',
    formula: 'x = 50 + a cos t / (1 + sin² t), y = 50 + a sin t cos t / (1 + sin² t)',
    rotate: false,
    particleCount: 70,
    trailSpan: 0.4,
    durationMs: 5600,
    rotationDurationMs: 34000,
    pulseDurationMs: 5000,
    strokeWidth: 4.8,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const scale = 20 + detailScale * 7;
      const denom = 1 + Math.sin(t) ** 2;
      return {
        x: 50 + (scale * Math.cos(t)) / denom,
        y: 50 + (scale * Math.sin(t) * Math.cos(t)) / denom,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'hypotrochoid-loop': {
    id: 'hypotrochoid-loop',
    name: 'Hypotrochoid Loop',
    formula: 'x(t) = 50 + ((R-r) cos t + d cos((R-r)t/r)) · 3.05',
    rotate: false,
    particleCount: 82,
    trailSpan: 0.46,
    durationMs: 7600,
    rotationDurationMs: 42000,
    pulseDurationMs: 6200,
    strokeWidth: 4.6,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const r = 2.7 + detailScale * 0.45;
      const d = 4.8 + detailScale * 1.2;
      const R = 8.2;
      const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      return {
        x: 50 + x * 3.05,
        y: 50 + y * 3.05,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'butterfly-phase': {
    id: 'butterfly-phase',
    name: 'Butterfly Phase',
    formula: 'B(u) = e^{cos u} - 2 cos 4u - sin^5(u/12)',
    rotate: false,
    particleCount: 88,
    trailSpan: 0.32,
    durationMs: 9000,
    rotationDurationMs: 50000,
    pulseDurationMs: 7000,
    strokeWidth: 4.4,
    point(progress, detailScale) {
      const t = progress * Math.PI * 12;
      const s = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.sin(t / 12) ** 5;
      const scale = 4.6 + detailScale * 0.45;
      return {
        x: 50 + Math.sin(t) * s * scale,
        y: 50 + Math.cos(t) * s * scale,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
  'spiral-search': {
    id: 'spiral-search',
    name: 'Spiral Search',
    formula: 'θ(t) = 4t, r(t) = 8 + (1 - cos t)(8.5 + 2.4s)',
    rotate: false,
    particleCount: 86,
    trailSpan: 0.28,
    durationMs: 7800,
    rotationDurationMs: 44000,
    pulseDurationMs: 6800,
    strokeWidth: 4.3,
    point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const angle = t * 4;
      const radius = 8 + (1 - Math.cos(t)) * (8.5 + detailScale * 2.4);
      return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      };
    },
    getPoint(t, scale, time) {
      const pt = this.point(t / (Math.PI * 2), 0.52 + ((Math.sin(time + 0.55) + 1) / 2) * 0.48);
      return { x: ((pt.x - 50) / 50) * scale, y: ((pt.y - 50) / 50) * scale };
    },
  },
};

export const ALL_MATH_CURVE_KEYS: MathCurveType[] = [
  'rose-orbit',
  'original-thinking',
  'thinking-five',
  'thinking-nine',
  'rose-three',
  'rose-curve',
  'rose-two',
  'rose-four',
  'lemniscate-bloom',
  'hypotrochoid-loop',
  'butterfly-phase',
  'spiral-search',
];

