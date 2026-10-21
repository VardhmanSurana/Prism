import type { Adjustments } from './filterEngine';
import { DEFAULT_ADJUSTMENTS, toFilterString } from './filterEngine';
import { isCtxFilterSupported, applyBaseFiltersToImageData } from './filterFallback';

export type LayerType = 'pixel' | 'adjustment' | 'fill' | 'smart';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number; // 0 -> 100
  blendMode: GlobalCompositeOperation;
  adjustmentData?: Partial<Adjustments>;
  fillColor?: string;
  fillGradient?: { color1: string; color2: string; angle: number };
  clippingMask?: boolean;
  imageSrc?: string;
}

/**
 * createDefaultBaseLayer - Performs create default base layer.
 */
export function createDefaultBaseLayer(name: string = 'Background'): Layer {
  return {
    id: 'layer-base',
    name,
    type: 'pixel',
    visible: true,
    opacity: 100,
    blendMode: 'source-over',
  };
}

/**
 * True when the stack only contains the implicit base layer (or nothing at
 * all) — i.e. compositing is a no-op and can be skipped entirely.
 */
export function isLayerStackEmpty(layers?: Layer[] | null): boolean {
  if (!layers || layers.length === 0) return true;
  return layers.every((l) => l.type === 'pixel' && (!l.imageSrc || l.imageSrc === 'base'));
}

function makeSnapshot(w: number, h: number, source: HTMLCanvasElement): HTMLCanvasElement {
  const snap = document.createElement('canvas');
  snap.width = w;
  snap.height = h;
  const sctx = snap.getContext('2d');
  if (sctx) sctx.drawImage(source, 0, 0);
  return snap;
}

/**
 * Composite `layers` (ordered index 0 = TOP of the stack, matching the panel
 * UI) over `baseCanvas`, writing the result into `outputCanvas` (or a new
 * canvas). The base canvas content is the bottom of the stack; every layer
 * honours its own visibility, opacity and blend mode.
 *
 * Layer types:
 *  - pixel / smart: the adjusted base render itself (pass-through; per-layer
 *    pixel content is not supported yet — imageSrc is reserved).
 *  - fill: solid color or linear gradient covering the canvas.
 *  - adjustment: applies its `adjustmentData` (as a canvas filter, with an
 *    ImageData fallback for engines without ctx.filter) to everything below.
 */
export function compositeLayersToCanvas(
  layers: Layer[] | null | undefined,
  baseCanvas: HTMLCanvasElement,
  outputCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const target = outputCanvas || document.createElement('canvas');
  const w = baseCanvas.width;
  const h = baseCanvas.height;

  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }

  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return baseCanvas;

  // Start from the base render.
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.restore();

  if (isLayerStackEmpty(layers)) return target;

  // Bottom of the stack = end of the array.
  const ordered = [...(layers as Layer[])].reverse();

  for (const layer of ordered) {
    if (!layer.visible || layer.opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity / 100));
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    if (layer.type === 'fill') {
      if (layer.fillGradient) {
        const { color1, color2, angle } = layer.fillGradient;
        const rad = (angle * Math.PI) / 180;
        const x2 = w * Math.cos(rad);
        const y2 = h * Math.sin(rad);
        const grad = ctx.createLinearGradient(0, 0, x2, y2);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = layer.fillColor || '#ffffff';
      }
      ctx.fillRect(0, 0, w, h);
    } else if (layer.type === 'adjustment' && layer.adjustmentData) {
      // Snapshot everything composited so far, re-draw it through the
      // adjustment layer's filter.
      const adj = { ...DEFAULT_ADJUSTMENTS, ...layer.adjustmentData } as Adjustments;
      const snapshot = makeSnapshot(w, h, target);

      ctx.clearRect(0, 0, w, h);
      if (isCtxFilterSupported()) {
        ctx.filter = toFilterString(adj);
        ctx.drawImage(snapshot, 0, 0);
        ctx.filter = 'none';
      } else {
        const sctx = snapshot.getContext('2d', { willReadFrequently: true });
        if (sctx) {
          const imgData = sctx.getImageData(0, 0, w, h);
          applyBaseFiltersToImageData(imgData, adj);
          sctx.putImageData(imgData, 0, 0);
        }
        ctx.drawImage(snapshot, 0, 0);
      }
    }
    // pixel / smart: the base render is already the bottom of the stack —
    // nothing extra to draw until per-layer pixel content lands.

    ctx.restore();
  }

  return target;
}
