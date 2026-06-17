/**
 * history.ts
 * Types and utilities for tracking edit history
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

  | 'clarity'
  | 'sharpness'
  | 'noiseReduction'
  | 'ambiance'
  | 'curves'
  | 'vignette'
  | 'regions'
  | `regions_${string}`
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
  value?: number; // The new value that was set
  hidden?: boolean; // Toggles whether this history entry is active/applied
  // Snapshot of the state at this point
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

export function getActionColor(type: HistoryActionType): string {
  if (typeof type === 'string' && type.startsWith('regions')) {
    return 'text-cyan-400';
  }
  switch (type) {
    case 'crop': return 'text-blue-400';
    case 'rotate': return 'text-purple-400';
    case 'flip': return 'text-cyan-400';
    case 'straighten': return 'text-yellow-400';
    case 'brightness':
    case 'contrast':
    case 'exposure':
    case 'highlights':
    case 'shadows':
    case 'whites':
    case 'blacks':
      return 'text-orange-400';
    case 'vibrance':
    case 'saturation':
    case 'hue':
    case 'temperature':
      return 'text-pink-400';
    case 'clarity':
    case 'noiseReduction':
      return 'text-green-400';
    case 'ambiance':
    case 'curves':
    case 'vignette':
      return 'text-violet-400';
    case 'splitToning': return 'text-rose-400';
    case 'grain':
    case 'lightLeak': return 'text-amber-400';
    case 'frame': return 'text-emerald-400';
    case 'blend': return 'text-indigo-400';
    case 'tiltShift': return 'text-teal-400';
    case 'annotations': return 'text-sky-400';
    case 'initial': return 'text-gray-400';
    default: return 'text-white';
  }
}

export function getAdjustmentLabel(type: HistoryActionType): string {
  if (typeof type === 'string' && type.startsWith('regions')) {
    return 'Regional Adjustment';
  }
  if (type === 'splitToning') return 'Split Toning';
  if (type === 'lightLeak') return 'Light Leak';
  if (type === 'tiltShift') return 'Tilt Shift';
  if (type === 'noiseReduction') return 'Noise Reduction';
  // Convert camelCase to Title Case
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
}
