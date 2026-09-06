/**
 * LassoPanel types
 */

import { LassoState } from '../lassoEngine';
import { Adjustments } from '../filterEngine';

export interface LassoPanelProps {
  state: LassoState;
  onChange: (s: LassoState) => void;
  adjustments: Adjustments;
  onAdjustmentsChange: (adj: Adjustments) => void;
  onConvertToInpaintMask?: (maskUrl: string) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  onAddHistoryEntry?: (toolId: string, description: string) => void;
}

