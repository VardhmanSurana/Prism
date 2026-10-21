/**
 * history.ts
 * Types and utilities for tracking edit history undo/redo stack and non-destructive timeline.
 */

import { Adjustments } from './filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

export type HistoryActionType = string;

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  description: string;
  value?: any;
  imageSrc: string;
  adjustments: Adjustments;
  customVariables?: Record<string, any>;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  straightenAngle: number;
  annotations?: Annotation[];
  hidden?: boolean;
  isSnapshot?: boolean;
  toolId?: string;
  propertyKey?: string;
}

export const MAX_IMAGE_HISTORY_ENTRIES = 30;

export function appendBoundedHistory(
  history: HistoryEntry[],
  currentHistoryIndex: number,
  entry: HistoryEntry,
  maxEntries = MAX_IMAGE_HISTORY_ENTRIES
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

/**
 * createHistoryEntry - Performs create history entry.
 */
export function createHistoryEntry(
  type: HistoryActionType,
  description: string,
  imageSrc: string,
  adjustments: Adjustments,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  straightenAngle: number,
  value?: any,
  annotations?: Annotation[],
  options?: {
    customVariables?: Record<string, any>;
    hidden?: boolean;
    isSnapshot?: boolean;
    toolId?: string;
    propertyKey?: string;
  }
): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    value,
    imageSrc,
    adjustments: { ...adjustments },
    customVariables: options?.customVariables ? { ...options.customVariables } : {},
    rotation,
    flipH,
    flipV,
    straightenAngle,
    annotations: annotations ? [...annotations] : [],
    hidden: options?.hidden ?? false,
    isSnapshot: options?.isSnapshot ?? false,
    toolId: options?.toolId,
    propertyKey: options?.propertyKey,
  };
}
