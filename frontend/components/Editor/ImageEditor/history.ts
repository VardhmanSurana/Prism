/**
 * history.ts
 * Types and utilities for tracking edit history undo/redo stack.
 * ponytail: removed history panel toggle properties.
 */

import { Adjustments } from './filterEngine';
import { Annotation } from './AnnotationsPanel';

export type HistoryActionType =
  | 'crop'
  | 'rotate'
  | 'flip'
  | 'straighten'
  | 'brightness'
  | 'contrast'
  | 'exposure'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'vibrance'
  | 'saturation'
  | 'hue'
  | 'temperature'
  | 'tint'
  | 'clarity'
  | 'sharpness'
  | 'noiseReduction'
  | 'ambiance'
  | 'curves'
  | 'vignette'
  | 'splitToning'
  | 'grain'
  | 'lightLeak'
  | 'frame'
  | 'blend'
  | 'tiltShift'
  | 'annotations'
  | 'inpaint'
  | 'initial';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  type: HistoryActionType;
  description: string;
  value?: number;
  imageSrc: string;
  adjustments: Adjustments;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straightenAngle: number;
  annotations?: Annotation[];
}

export function createHistoryEntry(
  type: HistoryActionType,
  description: string,
  imageSrc: string,
  adjustments: Adjustments,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  straightenAngle: number,
  value?: number,
  annotations?: Annotation[]
): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    description,
    value,
    imageSrc,
    adjustments: { ...adjustments },
    rotation,
    flipH,
    flipV,
    straightenAngle,
    annotations: annotations ? [...annotations] : [],
  };
}
