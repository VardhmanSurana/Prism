/**
 * MathCurveLoader types
 */

export type MathCurveType =
  | 'rose-orbit'
  | 'original-thinking'
  | 'thinking-five'
  | 'thinking-nine'
  | 'rose-three'
  | 'rose-curve'
  | 'rose-two'
  | 'rose-four'
  | 'lemniscate-bloom'
  | 'hypotrochoid-loop'
  | 'butterfly-phase'
  | 'spiral-search';

export interface CurveDefinition {
  id: MathCurveType;
  name: string;
  formula: string;
  rotate: boolean;
  particleCount: number;
  trailSpan: number;
  durationMs: number;
  rotationDurationMs: number;
  pulseDurationMs: number;
  strokeWidth: number;
  point: (progress: number, detailScale: number) => { x: number; y: number };
  getPoint: (t: number, scale: number, time: number) => { x: number; y: number };
}

export interface MathCurveLoaderProps {
  curveType?: MathCurveType;
  size?: number;
  color?: string;
  showBadge?: boolean;
}

