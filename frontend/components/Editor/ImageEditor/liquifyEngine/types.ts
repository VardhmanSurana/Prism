/**
 * types.ts
 * Types and defaults for the liquify engine.
 */

export type LiquifyToolMode = 'warp' | 'pucker' | 'bloat' | 'smooth' | 'reconstruct';

export interface FaceLiquifySettings {
  eyeSize: number;
  eyeDistance: number;
  noseWidth: number;
  lipHeight: number;
  chinShape: number;
}

export interface LiquifySettings {
  mode: LiquifyToolMode;
  brushSize: number;
  pressure: number;
  face: FaceLiquifySettings;
}

export const DEFAULT_LIQUIFY_SETTINGS: LiquifySettings = {
  mode: 'warp',
  brushSize: 80,
  pressure: 50,
  face: {
    eyeSize: 0,
    eyeDistance: 0,
    noseWidth: 0,
    lipHeight: 0,
    chinShape: 0,
  },
};
