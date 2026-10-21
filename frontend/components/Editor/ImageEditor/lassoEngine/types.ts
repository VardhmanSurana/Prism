/**
 * types.ts
 * Shared types and defaults for the lasso engine.
 */

export type LassoType = 'freehand' | 'polygonal' | 'magnetic';
export type LassoOperation = 'new' | 'add' | 'subtract' | 'intersect';
export type MaskPreviewMode = 'ants' | 'overlay' | 'bw' | 'on_black' | 'on_white';

export interface Point2D {
  x: number;
  y: number;
}

export interface RefineEdgeSettings {
  feather: number;    // 0 -> 100px
  smooth: number;     // 0 -> 50px
  shiftEdge: number;  // -50 -> +50px (dilate/erode)
  contrast: number;   // 0 -> 100%
}

export interface MagneticSettings {
  sensitivity: number;        // 1 -> 100
  snapRadius: number;         // 5 -> 50px
  autoAnchor: boolean;        // automatically drop anchors
  autoAnchorDistance: number; // pixel distance threshold (10 -> 80px)
}

export interface LassoState {
  type: LassoType;
  operation: LassoOperation;
  points: Point2D[];
  liveWirePath: Point2D[];
  closedPaths: Point2D[][];
  isClosed: boolean;
  previewMode: MaskPreviewMode;
  refine: RefineEdgeSettings;
  magnetic: MagneticSettings;
  hasActiveMask: boolean;
  activeMaskDataUrl: string | null;
}

export interface LiveWireCostMap {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  cost: Float32Array;
  gradX: Float32Array;
  gradY: Float32Array;
  gradMag: Float32Array;
}

export const DEFAULT_REFINE_SETTINGS: RefineEdgeSettings = {
  feather: 0,
  smooth: 0,
  shiftEdge: 0,
  contrast: 0,
};

export const DEFAULT_MAGNETIC_SETTINGS: MagneticSettings = {
  sensitivity: 65,
  snapRadius: 18,
  autoAnchor: true,
  autoAnchorDistance: 32,
};

export const DEFAULT_LASSO_STATE: LassoState = {
  type: 'freehand',
  operation: 'new',
  points: [],
  liveWirePath: [],
  closedPaths: [],
  isClosed: false,
  previewMode: 'ants',
  refine: { ...DEFAULT_REFINE_SETTINGS },
  magnetic: { ...DEFAULT_MAGNETIC_SETTINGS },
  hasActiveMask: false,
  activeMaskDataUrl: null,
};
