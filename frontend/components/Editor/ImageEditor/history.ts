/**
 * history.ts
 * Types and utilities for tracking edit history undo/redo stack.
 * ponytail: removed history panel toggle properties.
 */

import { Adjustments } from './filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

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
  | 'layer'
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

export const MAX_IMAGE_HISTORY_ENTRIES = 12;

export function appendBoundedHistory(
  history: HistoryEntry[],
  currentHistoryIndex: number,
  entry: HistoryEntry,
  maxEntries = MAX_IMAGE_HISTORY_ENTRIES,
): { history: HistoryEntry[]; currentHistoryIndex: number; evicted: HistoryEntry[] } {
  const retained = history.slice(0, currentHistoryIndex + 1);
  const discardedRedo = history.slice(currentHistoryIndex + 1);
  const next = [...retained, entry];
  const overflow = Math.max(0, next.length - maxEntries);
  return {
    history: next.slice(overflow),
    currentHistoryIndex: next.length - 1 - overflow,
    evicted: [...discardedRedo, ...next.slice(0, overflow)],
  };
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
