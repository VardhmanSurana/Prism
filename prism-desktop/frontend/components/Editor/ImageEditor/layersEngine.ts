import { Adjustments } from './filterEngine';

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

export function compositeLayersToCanvas(
  layers: Layer[],
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

  const ctx = target.getContext('2d');
  if (!ctx) return baseCanvas;

  ctx.clearRect(0, 0, w, h);

  if (!layers || layers.length === 0) {
    ctx.drawImage(baseCanvas, 0, 0);
    return target;
  }

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    if (layer.type === 'pixel' || layer.type === 'smart') {
      ctx.drawImage(baseCanvas, 0, 0);
    } else if (layer.type === 'fill') {
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
    } else if (layer.type === 'adjustment') {
      // Adjustment layer tints/filters underlying composited image
      if (layer.adjustmentData) {
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tempCtx = temp.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(target, 0, 0);
          ctx.drawImage(temp, 0, 0);
        }
      }
    }

    ctx.restore();
  }

  return target;
}
