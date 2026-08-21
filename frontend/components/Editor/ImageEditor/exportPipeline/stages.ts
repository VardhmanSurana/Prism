/**
 * stages.ts
 * Legacy barrel file — re-exports from modular stage files.
 * Kept for backward compatibility with existing imports.
 */

export {
  applyBlur,
  applyUnsharpMask,
  applyVignette,
  applyCurveLutsToCanvas,
  renderCanvasWithFilter,
} from './stages/filterStages';

export {
  applySplitToning,
  applySplitToningToImageData,
  applyGrain,
  applyLightLeak,
} from './stages/colorStages';

export {
  drawBlendOverlay,
  applyBlendOverlay,
  applyTiltShift,
  applyFrame,
} from './stages/overlayStages';

export {
  applyPerspective,
  applyLensCorrection,
  applyDefringeAndOpticalVignetting,
} from './stages/geometryStages';

export {
  applyAnnotations,
} from './stages/annotationsStages';
