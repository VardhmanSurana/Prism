/**
 * historyUtils.ts
 * Utilities for non-destructive state folding and recalculation across history entries.
 */

import { Adjustments } from './filterEngine';
import type { HistoryEntry } from './history';

export interface EditorActiveState {
  adjustments: Adjustments;
  customVariables: Record<string, any>;
}

/**
 * Recomputes the net active adjustments and custom variables from history entries,
 * skipping any entries that are marked as hidden or are the initial root state.
 */
export function recomputeActiveEditorState(
  history: HistoryEntry[],
  baseAdjustments: Adjustments,
  baseCustomVariables: Record<string, any> = {}
): EditorActiveState {
  let adjustments: Adjustments = { ...baseAdjustments };
  let customVariables: Record<string, any> = { ...baseCustomVariables };

  for (const entry of history) {
    if (entry.hidden || entry.type === 'initial') continue;

    if (entry.propertyKey) {
      if (entry.propertyKey.startsWith('customVariables.')) {
        const varKey = entry.propertyKey.replace('customVariables.', '');
        customVariables[varKey] = entry.value;
      } else if (entry.propertyKey in adjustments) {
        (adjustments as any)[entry.propertyKey] = entry.value;
      }
    } else if (entry.adjustments) {
      adjustments = { ...adjustments, ...entry.adjustments };
    }

    if (entry.customVariables) {
      customVariables = { ...customVariables, ...entry.customVariables };
    }
  }

  return { adjustments, customVariables };
}

