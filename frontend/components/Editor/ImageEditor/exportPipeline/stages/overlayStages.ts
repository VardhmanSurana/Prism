/**
 * overlayStages.ts
 * Overlay effect stages: double exposure blend, tilt-shift blur, and frame borders.
 */

import { Adjustments } from '../../filterEngine';
import { clamp, cloneCanvas, loadImage } from '../helpers';
import { applyBlur } from './filterStages';

export const drawBlendOverlay = (
  canvas: HTMLCanvasElement,
  overlayImg: HTMLImageElement,
  blend: NonNullable<Adjustments['blend']>
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.globalAlpha = blend.opacity / 100;
  ctx.globalCompositeOperation = blend.mode;

  let targetX = 0, targetY = 0, targetW = w, targetH = h;
  const imgW = overlayImg.naturalWidth;
  const imgH = overlayImg.naturalHeight;
  const imgRatio = imgW / imgH;
  const canvasRatio = w / h;

  if (blend.fit === 'contain') {
    if (imgRatio > canvasRatio) {
      targetW = w;
      targetH = w / imgRatio;
      targetY = (h - targetH) / 2;
    } else {
      targetH = h;
      targetW = h * imgRatio;
      targetX = (w - targetW) / 2;
    }
  } else if (blend.fit === 'center') {
    targetW = imgW;
    targetH = imgH;
    targetX = (w - imgW) / 2;
    targetY = (h - imgH) / 2;
  } else {
    if (imgRatio > canvasRatio) {
      targetH = h;
      targetW = h * imgRatio;
      targetX = (w - targetW) / 2;
    } else {
      targetW = w;
      targetH = w / imgRatio;
      targetY = (h - targetH) / 2;
    }
  }

  ctx.drawImage(overlayImg, targetX, targetY, targetW, targetH);
  ctx.restore();
  return canvas;
};

export const applyBlendOverlay = async (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const blend = adjustments.blend;
  if (!blend || !blend.blendImageSrc) return canvas;

  try {
    const overlayImg = await loadImage(blend.blendImageSrc);
    drawBlendOverlay(canvas, overlayImg, blend);
  } catch (err) {
    console.error('Failed to apply blend overlay at export:', err);
  }
  return canvas;
};

export const applyTiltShift = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const ts = adjustments.tiltShift;
  if (!ts || !ts.enabled || ts.blurStrength === 0) return canvas;

  const w = canvas.width;
  const h = canvas.height;

  const maxRadius = Math.max(w, h) * 0.025;
  const blurRad = (ts.blurStrength / 100) * maxRadius;

  const { canvas: blurredCanvas } = cloneCanvas(canvas);
  applyBlur(blurredCanvas, blurRad);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return canvas;

  const pos = ts.focusPosition / 100;
  const widthPct = ts.focusWidth / 100;

  let gradient: CanvasGradient;

  if (ts.mode === 'linear') {
    gradient = maskCtx.createLinearGradient(0, 0, 0, h);

    const sharpStart = clamp(pos - widthPct / 2, 0, 1);
    const sharpEnd = clamp(pos + widthPct / 2, 0, 1);
    const blurStart = clamp(sharpStart - 0.2, 0, 1);
    const blurEnd = clamp(sharpEnd + 0.2, 0, 1);

    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(blurStart, 'rgba(0,0,0,1)');
    gradient.addColorStop(sharpStart, 'rgba(0,0,0,0)');
    gradient.addColorStop(sharpEnd, 'rgba(0,0,0,0)');
    gradient.addColorStop(blurEnd, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
  } else {
    const cx = w / 2;
    const cy = h * pos;
    const maxDist = Math.max(w, h) * 0.5;

    const innerRadius = widthPct * maxDist;
    const outerRadius = (widthPct + 0.25) * maxDist;

    gradient = maskCtx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
  }

  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, w, h);

  const maskedBlurred = document.createElement('canvas');
  maskedBlurred.width = w;
  maskedBlurred.height = h;
  const mbCtx = maskedBlurred.getContext('2d');
  if (!mbCtx) return canvas;

  mbCtx.drawImage(blurredCanvas, 0, 0);
  mbCtx.globalCompositeOperation = 'destination-in';
  mbCtx.drawImage(maskCanvas, 0, 0);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(maskedBlurred, 0, 0);
  ctx.restore();

  return canvas;
};

export const applyFrame = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const frame = adjustments.frame;
  if (!frame || frame.style === 'none') return canvas;

  const w = canvas.width;
  const h = canvas.height;

  let newW = w;
  let newH = h;

  if (frame.style === 'polaroid') {
    const border = Math.max(w, h) * (frame.thickness / 100);
    newW = w + border * 2;
    newH = h + border * 4.5;
  } else if (frame.style === 'matte') {
    const border = Math.max(w, h) * (frame.thickness / 100);
    newW = w + border * 2;
    newH = h + border * 2;
  } else if (frame.style === 'filmstrip') {
    const border = Math.round(h * 0.14);
    newW = w;
    newH = h + border * 2;
  } else if (frame.style === 'shadowbox') {
    const border = Math.max(w, h) * 0.1;
    newW = w + border * 2;
    newH = h + border * 2;
  }

  const framedCanvas = document.createElement('canvas');
  framedCanvas.width = newW;
  framedCanvas.height = newH;
  const ctx = framedCanvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();

  if (frame.style === 'polaroid') {
    const border = Math.max(w, h) * (frame.thickness / 100);
    ctx.fillStyle = '#f8f8f6';
    ctx.fillRect(0, 0, newW, newH);

    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = Math.max(4, border * 0.2);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, border * 0.05);

    ctx.drawImage(canvas, border, border, w, h);
  } else if (frame.style === 'matte') {
    const border = Math.max(w, h) * (frame.thickness / 100);
    ctx.fillStyle = frame.color;
    ctx.fillRect(0, 0, newW, newH);
    ctx.drawImage(canvas, border, border, w, h);
  } else if (frame.style === 'filmstrip') {
    const border = Math.round(h * 0.14);
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, newW, newH);
    ctx.drawImage(canvas, 0, border, w, h);

    const spW = Math.max(10, w * 0.02);
    const spH = border * 0.45;
    const gap = spW * 1.5;
    ctx.fillStyle = '#1c1c1c';

    for (let x = gap / 2; x < w; x += spW + gap) {
      ctx.beginPath();
      ctx.roundRect(x, border * 0.25, spW, spH, 3);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(x, newH - border * 0.7, spW, spH, 3);
      ctx.fill();
    }
  } else if (frame.style === 'rounded') {
    const r = Math.min(w, h) * 0.04;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.clip();
    ctx.drawImage(canvas, 0, 0);
  } else if (frame.style === 'thinline') {
    ctx.drawImage(canvas, 0, 0);
    ctx.strokeStyle = frame.color;
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
    ctx.strokeRect(0, 0, w, h);
  } else if (frame.style === 'shadowbox') {
    const border = Math.max(w, h) * 0.1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, newW, newH);

    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = border * 0.4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = border * 0.15;

    ctx.drawImage(canvas, border, border, w, h);
  }

  ctx.restore();
  return framedCanvas;
};
