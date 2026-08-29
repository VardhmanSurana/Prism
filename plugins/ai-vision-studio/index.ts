export { MagicEraserPanel, InpaintPanel } from './MagicEraserPanel';
export type {
  MagicEraserMode,
  MagicEraserOperation,
  MagicEraserSettings,
  InpaintMode,
  InpaintOperation,
  InpaintSettings,
} from './MagicEraserPanel';
export { MagicEraserCanvas, InpaintCanvas } from './MagicEraserCanvas';
export type { MagicEraserCanvasHandle, InpaintCanvasHandle } from './MagicEraserCanvas';
export { eraseImageLocally, inpaintImageLocally } from './magicEraserEngine';
export { BackgroundPanel } from './BackgroundPanel';
export { applyBackgroundReplacementToCanvas, loadImageAsync } from './backgroundStage';
export { DepthPanel } from './DepthPanel';
export type { DepthMode, DepthSettings, DepthPanelProps } from './DepthPanel';
export { EnhancePanel } from './EnhancePanel';
export type { EnhanceSettings, EnhanceAction, EnhancePanelProps, CaptionTask } from './EnhancePanel';
export { DepthTextPanel } from './DepthTextPanel';



