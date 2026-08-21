/**
 * shapeUtils.ts
 * Vector Shape generators, math calculations, and shape definitions.
 */

import React from 'react';
import {
  Square,
  Circle as CircleIcon,
  ArrowUpRight,
  Minus,
  MoveHorizontal,
  Triangle,
  Diamond,
  Pentagon,
  Hexagon,
  Star,
  Sparkles,
  Heart,
  Zap,
  MessageSquare,
  Cloud,
  LucideIcon,
} from 'lucide-react';
import { VectorShapeType } from '../AnnotationsPanel/types';
export type { VectorShapeType };

export interface ShapeItem {
  id: VectorShapeType;
  name: string;
  category: 'basic' | 'polygons' | 'symbols' | 'callouts' | 'lines';
  icon: LucideIcon;
  isPointBased?: boolean;
}

export const ALL_SHAPES: ShapeItem[] = [
  // Basic Shapes
  { id: 'rect', name: 'Rectangle', category: 'basic', icon: Square },
  { id: 'roundedRect', name: 'Rounded Rectangle', category: 'basic', icon: Square },
  { id: 'circle', name: 'Circle / Oval', category: 'basic', icon: CircleIcon },
  { id: 'triangle', name: 'Triangle', category: 'basic', icon: Triangle },
  { id: 'rightTriangle', name: 'Right Triangle', category: 'basic', icon: Triangle },
  { id: 'diamond', name: 'Diamond', category: 'basic', icon: Diamond },

  // Polygons & Stars
  { id: 'pentagon', name: 'Pentagon', category: 'polygons', icon: Pentagon },
  { id: 'hexagon', name: 'Hexagon', category: 'polygons', icon: Hexagon },
  { id: 'star', name: '5-Point Star', category: 'polygons', icon: Star },
  { id: 'fourPointStar', name: '4-Point Star', category: 'polygons', icon: Sparkles },

  // Symbols & Callouts
  { id: 'heart', name: 'Heart', category: 'symbols', icon: Heart },
  { id: 'lightning', name: 'Lightning', category: 'symbols', icon: Zap },
  { id: 'speechBubble', name: 'Speech Bubble', category: 'callouts', icon: MessageSquare },
  { id: 'cloud', name: 'Cloud', category: 'callouts', icon: Cloud },

  // Lines & Arrows
  { id: 'line', name: 'Line', category: 'lines', icon: Minus, isPointBased: true },
  { id: 'arrow', name: 'Arrow', category: 'lines', icon: ArrowUpRight, isPointBased: true },
  { id: 'doubleArrow', name: 'Double Arrow', category: 'lines', icon: MoveHorizontal, isPointBased: true },
];

export const isPointBasedShape = (type: string): boolean => {
  return type === 'arrow' || type === 'doubleArrow' || type === 'line';
};

export const isBoundedShape = (type: string): boolean => {
  return [
    'rect',
    'roundedRect',
    'circle',
    'triangle',
    'rightTriangle',
    'diamond',
    'pentagon',
    'hexagon',
    'star',
    'fourPointStar',
    'heart',
    'lightning',
    'speechBubble',
    'cloud',
  ].includes(type);
};

export const normalizeBounds = (b: { x: number; y: number; w: number; h: number }) => {
  const x = b.w < 0 ? b.x + b.w : b.x;
  const y = b.h < 0 ? b.y + b.h : b.y;
  const w = Math.max(1, Math.abs(b.w));
  const h = Math.max(1, Math.abs(b.h));
  return { x, y, w, h };
};

/**
 * Returns polygon points string for geometric regular shapes
 */
export const getPolygonPoints = (type: VectorShapeType, bounds: { x: number; y: number; w: number; h: number }): string => {
  const { x, y, w, h } = normalizeBounds(bounds);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  switch (type) {
    case 'triangle':
      return `${cx},${y} ${x + w},${y + h} ${x},${y + h}`;

    case 'rightTriangle':
      return `${x},${y} ${x + w},${y + h} ${x},${y + h}`;

    case 'diamond':
      return `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;

    case 'pentagon': {
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }

    case 'hexagon': {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 6;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }

    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rScale = i % 2 === 0 ? 1 : 0.42;
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 10;
        pts.push(`${cx + rx * rScale * Math.cos(angle)},${cy + ry * rScale * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }

    case 'fourPointStar': {
      const pts: string[] = [];
      for (let i = 0; i < 8; i++) {
        const rScale = i % 2 === 0 ? 1 : 0.3;
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 8;
        pts.push(`${cx + rx * rScale * Math.cos(angle)},${cy + ry * rScale * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }

    case 'lightning': {
      return `${x + w * 0.58},${y} ${x + w * 0.15},${y + h * 0.55} ${x + w * 0.48},${y + h * 0.55} ${x + w * 0.35},${y + h} ${x + w * 0.85},${y + h * 0.4} ${x + w * 0.52},${y + h * 0.4}`;
    }

    default:
      return '';
  }
};

/**
 * Returns SVG path string for curved shapes (heart, speechBubble, cloud)
 */
export const getShapePathString = (type: VectorShapeType, bounds: { x: number; y: number; w: number; h: number }): string => {
  const { x, y, w, h } = normalizeBounds(bounds);

  switch (type) {
    case 'heart': {
      const topH = h * 0.3;
      return `M ${x + w / 2} ${y + topH} C ${x + w / 2} ${y}, ${x} ${y}, ${x} ${y + topH} C ${x} ${y + (h + topH) / 2}, ${x + w / 2} ${y + h * 0.85}, ${x + w / 2} ${y + h} C ${x + w / 2} ${y + h * 0.85}, ${x + w} ${y + (h + topH) / 2}, ${x + w} ${y + topH} C ${x + w} ${y}, ${x + w / 2} ${y}, ${x + w / 2} ${y + topH} Z`;
    }

    case 'speechBubble': {
      const r = Math.min(w, h) * 0.12;
      const bw = w;
      const bh = h * 0.78;
      return `M ${x + r} ${y} H ${x + bw - r} A ${r} ${r} 0 0 1 ${x + bw} ${y + r} V ${y + bh - r} A ${r} ${r} 0 0 1 ${x + bw - r} ${y + bh} H ${x + w * 0.42} L ${x + w * 0.18} ${y + h} L ${x + w * 0.26} ${y + bh} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + bh - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
    }

    case 'cloud': {
      return `M ${x + w * 0.2} ${y + h * 0.75} C ${x + w * 0.05} ${y + h * 0.75}, ${x} ${y + h * 0.55}, ${x + w * 0.12} ${y + h * 0.4} C ${x + w * 0.08} ${y + h * 0.2}, ${x + w * 0.28} ${y + h * 0.08}, ${x + w * 0.45} ${y + h * 0.18} C ${x + w * 0.55} ${y + h * 0.05}, ${x + w * 0.78} ${y + h * 0.08}, ${x + w * 0.82} ${y + h * 0.28} C ${x + w * 0.95} ${y + h * 0.35}, ${x + w} ${y + h * 0.55}, ${x + w * 0.88} ${y + h * 0.72} C ${x + w * 0.92} ${y + h * 0.88}, ${x + w * 0.75} ${y + h * 0.92}, ${x + w * 0.65} ${y + h * 0.82} C ${x + w * 0.5} ${y + h * 0.95}, ${x + w * 0.3} ${y + h * 0.92}, ${x + w * 0.2} ${y + h * 0.75} Z`;
    }

    default:
      return '';
  }
};
