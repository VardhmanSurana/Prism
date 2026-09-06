/**
 * healingEngine.ts
 * Types and defaults for Clone Stamp, Healing Brush, Frequency Separation, Patch, and Dodge/Burn.
 */

export type HealingToolMode =
  | 'clone-stamp'
  | 'healing-brush'
  | 'frequency-separation'
  | 'content-patch'
  | 'dodge-burn';

export interface HealingSettings {
  mode: HealingToolMode;
  brushSize: number; // 5 - 200
  hardness: number; // 0 - 100
  opacity: number; // 10 - 100
}

export const DEFAULT_HEALING_SETTINGS: HealingSettings = {
  mode: 'clone-stamp',
  brushSize: 40,
  hardness: 70,
  opacity: 100,
};
