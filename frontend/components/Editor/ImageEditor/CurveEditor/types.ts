/**
 * CurveEditor types and constants
 */

import { Point } from '../spline';
import { CurveState, SpecializedCurvesState } from '../curves';

export type { Point, CurveState, SpecializedCurvesState };
export { DEFAULT_CURVE } from '../curves';

export interface CurveEditorProps {
  value: CurveState;
  onChange: (value: CurveState) => void;
  specializedValue?: SpecializedCurvesState;
  onSpecializedChange?: (value: SpecializedCurvesState) => void;
  imageSrc?: string;
  filterString?: string;
}

export type Channel = 'master' | 'red' | 'green' | 'blue';
export type CurveCategory = 'rgb' | 'specialized';

export const CANVAS_SIZE = 255;
export const MARGIN = 10;
export const SVG_SIZE = CANVAS_SIZE + MARGIN * 2;
export const HIT_RADIUS = 15;
export const BINS = 256;

export const channelColors: Record<Channel, string> = {
  master: '#ffffff',
  red:    '#ef4444',
  green:  '#22c55e',
  blue:   '#3b82f6',
};

