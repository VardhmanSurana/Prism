/**
 * adjustmentCommitHelper.ts
 * Formats and commits individual adjustment changes into history entries.
 */

import { Adjustments } from '../../filterEngine';
import { HistoryActionType } from '../../history';
import { inferToolId } from './toolInference';

export type AddHistoryEntryFn = (
  type: HistoryActionType,
  description: string,
  value?: any,
  overrideImageSrc?: string,
  overrideAnnotations?: any[],
  options?: {
    customVariables?: Record<string, any>;
    hidden?: boolean;
    isSnapshot?: boolean;
    toolId?: string;
    propertyKey?: string;
  }
) => void;

export function commitAdjustmentChange(
  key: keyof Adjustments,
  value: any,
  curr: Adjustments,
  addHistoryEntry: AddHistoryEntryFn
): void {
  const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  const numValue = typeof value === 'number' ? value : undefined;

  console.log(`[useEditingHistory] Commit timeline entry for ${key}:`, value);

  if (key === 'curves') {
    addHistoryEntry(key, `Adjusted ${label}`, value, undefined, undefined, {
      propertyKey: key,
      toolId: 'adjust',
    });
  } else if (key === 'specializedCurves') {
    addHistoryEntry(key, 'Adjusted Color vs Color', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'adjust',
    });
  } else if (key === 'hsl') {
    addHistoryEntry('hsl', 'Adjusted Color Mixer', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'hsl',
    });
  } else if (key === 'splitToning') {
    addHistoryEntry('splitToning', 'Adjusted Split Toning', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'hsl',
    });
  } else if (key === 'colorWheels') {
    addHistoryEntry(key, 'Adjusted Color Wheels', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'hsl',
    });
  } else if (key === 'portrait') {
    addHistoryEntry(key, 'Adjusted Portrait', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'portrait',
    });
  } else if (key === 'lut') {
    addHistoryEntry(key, 'Applied LUT', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'lut',
    });
  } else if (key === 'background') {
    addHistoryEntry(key, 'Adjusted Background', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'background',
    });
  } else if (key === 'raw') {
    addHistoryEntry(key, 'Adjusted RAW Settings', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'raw',
    });
  } else if (key === 'grain') {
    addHistoryEntry('grain', `Film Grain: ${curr.grain.amount}%`, value, undefined, undefined, {
      propertyKey: key,
      toolId: 'texture',
    });
  } else if (key === 'lightLeak') {
    addHistoryEntry('lightLeak', 'Adjusted Light Leak', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'texture',
    });
  } else if (key === 'frame') {
    addHistoryEntry('frame', 'Adjusted Frame', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'frame',
    });
  } else if (key === 'blend') {
    addHistoryEntry('blend', 'Adjusted Blend', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'texture',
    });
  } else if (key === 'tiltShift') {
    addHistoryEntry('tiltShift', 'Adjusted Tilt-Shift', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'detail',
    });
  } else if (key === 'layers') {
    addHistoryEntry('layer', 'Modified layer stack', value, undefined, undefined, {
      propertyKey: key,
      toolId: 'layers',
    });
  } else {
    addHistoryEntry(
      key,
      `${label} ${numValue !== undefined ? (numValue > 0 ? '+' : '') + numValue : 'adjusted'}`,
      numValue,
      undefined,
      undefined,
      { propertyKey: key, toolId: inferToolId(key) }
    );
  }
}

