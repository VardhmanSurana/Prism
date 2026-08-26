import { BackgroundAdjustments } from '@/components/Editor/ImageEditor/filterEngine';
import { applyRefineEdgeToMask } from '@/components/Editor/ImageEditor/lassoEngine';
import { resolveUrl } from '@/constants';

/**
 * Loads an image from a URL or data URI asynchronously.
 */
export async function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http') ? url : resolveUrl(url);
  });
}

/**
 * Composites background replacement and subject cutout onto target canvas.
 */
export function applyBackgroundReplacementToCanvas(
  canvas: HTMLCanvasElement,
  bg: BackgroundAdjustments,
  maskImage: HTMLImageElement | HTMLCanvasElement,
  customBackdropImage?: HTMLImageElement | null,
) {
  if (!bg.enabled || !maskImage) return;

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w <= 0 || h <= 0) return;

  // 1. Create base mask canvas matching target resolution
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) return;

  maskCtx.drawImage(maskImage, 0, 0, w, h);

  // 2. Apply Edge Refinement (Feather, Smooth, Shift Edge, Contrast)
  const refinedMask = applyRefineEdgeToMask(maskCanvas, bg.refine);
  const refinedCtx = refinedMask.getContext('2d', { willReadFrequently: true });

  // Invert mask if keep_bg mode or invertMask is checked
  const shouldInvert = bg.mode === 'keep_bg' || bg.invertMask;
  if (shouldInvert && refinedCtx) {
    const imgData = refinedCtx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const inv = 255 - d[i];
      d[i] = inv;
      d[i + 1] = inv;
      d[i + 2] = inv;
    }
    refinedCtx.putImageData(imgData, 0, 0);
  }

  // 3. Extract Subject onto isolated canvas using destination-in
  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = w;
  subjectCanvas.height = h;
  const subjectCtx = subjectCanvas.getContext('2d', { willReadFrequently: true });
  if (!subjectCtx) return;

  subjectCtx.drawImage(canvas, 0, 0);
  subjectCtx.globalCompositeOperation = 'destination-in';
  subjectCtx.drawImage(refinedMask, 0, 0);
  subjectCtx.globalCompositeOperation = 'source-over';

  // 4. Render Backdrop onto main canvas
  ctx.save();
  if (bg.backdrop === 'transparent') {
    ctx.clearRect(0, 0, w, h);
  } else if (bg.backdrop === 'color') {
    ctx.fillStyle = bg.backdropColor || '#ffffff';
    ctx.fillRect(0, 0, w, h);
  } else if (bg.backdrop === 'blur') {
    const blurRadius = bg.blurRadius ?? 20;
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const bCtx = blurCanvas.getContext('2d')!;
    bCtx.filter = `blur(${blurRadius}px)`;
    bCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(blurCanvas, 0, 0);
  } else if (bg.backdrop === 'custom' && customBackdropImage) {
    ctx.clearRect(0, 0, w, h);
    // Draw cover
    const cw = customBackdropImage.naturalWidth || customBackdropImage.width;
    const ch = customBackdropImage.naturalHeight || customBackdropImage.height;
    const scale = Math.max(w / cw, h / ch);
    const sw = cw * scale;
    const sh = ch * scale;
    const dx = (w - sw) / 2;
    const dy = (h - sh) / 2;
    ctx.drawImage(customBackdropImage, dx, dy, sw, sh);
  }

  // 5. Draw isolated subject over backdrop
  ctx.drawImage(subjectCanvas, 0, 0);
  ctx.restore();
}

