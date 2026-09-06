/**
 * HealingCanvas types
 */

import { HealingToolMode } from '../healingEngine';

export type { HealingToolMode };

export interface HealingCanvasRef {
  /** Returns a composite data URL of strokes applied to the source image */
  getCompositeDataUrl: (sourceImage: HTMLImageElement) => string;
  /** Get the work canvas element containing the rendered strokes */
  getWorkCanvas: () => HTMLCanvasElement | null;
  /** Clear all strokes */
  clearStrokes: () => void;
  /** Check if there are any active strokes */
  hasStrokes: () => boolean;
}

export interface HealingCanvasProps {
  width: number;
  height: number;
  sourceImage: HTMLImageElement | null;
  imageSrc?: string;
  mode?: HealingToolMode;
  brushSize?: number;
  hardness?: number; // 0-100
  opacity?: number;  // 10-100
  onStrokeComplete?: () => void;
  readOnly?: boolean;
}

