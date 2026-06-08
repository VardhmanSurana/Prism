/**
 * history.ts
 * Types and utilities for tracking edit history
 */

import { Adjustments } from './filterEngine';

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
  value?: number
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
    case 'initial': return 'text-gray-400';
    default: return 'text-white';
  }
}

export function getAdjustmentLabel(type: HistoryActionType): string {
  if (typeof type === 'string' && type.startsWith('regions')) {
    return 'Regional Adjustment';
  }
  // Convert camelCase to Title Case
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
}
