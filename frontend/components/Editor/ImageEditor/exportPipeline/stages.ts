import { Adjustments } from '../filterEngine';
import { Annotation } from '../AnnotationsPanel';
import { getCompositeCurveLuts, isIdentityCurve } from '../curves';
import { isCtxFilterSupported, applyBlurFallback, applyNonLinearHighlightsAndShadows, applyBaseFiltersToImageData } from '../filterFallback';
import { smoothPath } from '../AnnotationCanvas/utils';
import {
  clamp,
  cloneCanvas,
  createFeatheredMaskCanvas,
  hexToRgbString,
  loadImage,
  hasRegionAdjustments,
} from './helpers';

export const applyRegionToneAdjustments = (
  imageData: ImageData,
  regionAdjustments: Adjustments['regions'][number]['adjustments'],
) => {
  const sat = 1 + (regionAdjustments.saturation || 0) / 100;
  const rw = 0.213 + 0.787 * sat;
  const rg = 0.715 - 0.715 * sat;
  const rb = 0.072 - 0.072 * sat;
  const gw = 0.213 - 0.213 * sat;
  const gg = 0.715 + 0.285 * sat;
  const gb = 0.072 - 0.072 * sat;
  const bw = 0.213 - 0.213 * sat;
  const bg = 0.715 - 0.715 * sat;
  const bb = 0.072 + 0.928 * sat;

  const brightness = (regionAdjustments.brightness || 0) / 100 * 0.5;
  const contrast = 1 + (regionAdjustments.contrast || 0) / 100;
  const warmth = (regionAdjustments.warmth || 0) / 100 * 0.15;
  const offset = 0.5 * (1 - contrast) + brightness;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const r0 = imageData.data[index] / 255;
    const g0 = imageData.data[index + 1] / 255;
    const b0 = imageData.data[index + 2] / 255;

    const sr = r0 * rw + g0 * rg + b0 * rb;
    const sg = r0 * gw + g0 * gg + b0 * gb;
    const sb = r0 * bw + g0 * bg + b0 * bb;

    const outR = Math.max(0, Math.min(1, sr * contrast + offset + warmth));
    const outG = Math.max(0, Math.min(1, sg * contrast + offset));
    const outB = Math.max(0, Math.min(1, sb * contrast + offset - warmth));

    imageData.data[index] = Math.round(outR * 255);
    imageData.data[index + 1] = Math.round(outG * 255);
    imageData.data[index + 2] = Math.round(outB * 255);
  }

  return imageData;
};

export const createRegionAdjustedCanvas = async (
  baseCanvas: HTMLCanvasElement,
  regionAdjustments: Adjustments['regions'][number]['adjustments'],
) => {
  const { canvas, ctx } = cloneCanvas(baseCanvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const adjusted = applyRegionToneAdjustments(imageData, regionAdjustments);
  ctx.putImageData(adjusted, 0, 0);

  applyBlur(canvas, Math.min(20, (regionAdjustments.blur || 0) / 2.5));
  applyUnsharpMask(canvas, Math.max(0, regionAdjustments.sharpness || 0), 1.2, 2.5);
  if ((regionAdjustments.sharpness || 0) < 0) {
    applyBlur(canvas, Math.abs(regionAdjustments.sharpness || 0) / 100 * 1.5);
  }

  return canvas;
};

export const applyRegionalAdjustments = async (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  if (!hasRegionAdjustments(adjustments)) {
    return canvas;
  }

  for (const region of adjustments.regions) {
    const hasAdjustments = Object.values(region.adjustments).some((value) => (value || 0) !== 0);
    if (!hasAdjustments) {
      continue;
    }

    const adjustedCanvas = await createRegionAdjustedCanvas(canvas, region.adjustments);
    const maskCanvas = await createFeatheredMaskCanvas(region.maskUrl, canvas.width, canvas.height);

    const maskedEffect = document.createElement('canvas');
    maskedEffect.width = canvas.width;
    maskedEffect.height = canvas.height;
    const maskedCtx = maskedEffect.getContext('2d');
    if (!maskedCtx) {
      throw new Error('Failed to get a 2D context for masked region compositing.');
    }

    maskedCtx.drawImage(adjustedCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(maskCanvas, 0, 0);
    maskedCtx.globalCompositeOperation = 'source-over';

    const finalCtx = canvas.getContext('2d');
    if (!finalCtx) {
      throw new Error('Failed to get a 2D context for final regional compositing.');
    }

    finalCtx.drawImage(maskedEffect, 0, 0);
  }

  return canvas;
};

export const applyBlur = (canvas: HTMLCanvasElement, radius: number) => {
  if (radius <= 0) {
    return canvas;
  }

  if (!isCtxFilterSupported()) {
    applyBlurFallback(canvas, radius);
    return canvas;
  }

  const blurred = document.createElement('canvas');
  blurred.width = canvas.width;
  blurred.height = canvas.height;
  const ctx = blurred.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get a 2D context for blur.');
  }

  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  const targetCtx = canvas.getContext('2d');
  if (!targetCtx) {
    throw new Error('Failed to get a 2D context for blur application.');
  }

  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  targetCtx.drawImage(blurred, 0, 0);
  return canvas;
};

export const applyUnsharpMask = (
  canvas: HTMLCanvasElement,
  sharpness: number,
  blurRadius: number,
  boostMultiplier: number,
) => {
  if (sharpness <= 0) {
    return canvas;
  }

  const amount = sharpness / 100 * boostMultiplier;
  if (amount <= 0) {
    return canvas;
  }

  const originalCtx = canvas.getContext('2d', { willReadFrequently: true });
  if (!originalCtx) {
    throw new Error('Failed to get a 2D context for unsharp mask.');
  }

  const blurredCanvas = document.createElement('canvas');
  blurredCanvas.width = canvas.width;
  blurredCanvas.height = canvas.height;
  const blurredCtx = blurredCanvas.getContext('2d', { willReadFrequently: true });
  if (!blurredCtx) {
    throw new Error('Failed to get a 2D context for unsharp blur.');
  }

  if (!isCtxFilterSupported()) {
    applyBlurFallback(blurredCanvas, blurRadius);
  } else {
    blurredCtx.filter = `blur(${blurRadius}px)`;
    blurredCtx.drawImage(canvas, 0, 0);
    blurredCtx.filter = 'none';
  }

  const originalData = originalCtx.getImageData(0, 0, canvas.width, canvas.height);
  const blurredData = blurredCtx.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < originalData.data.length; index += 4) {
    originalData.data[index] = clamp(Math.round((1 + amount) * originalData.data[index] - amount * blurredData.data[index]), 0, 255);
    originalData.data[index + 1] = clamp(Math.round((1 + amount) * originalData.data[index + 1] - amount * blurredData.data[index + 1]), 0, 255);
    originalData.data[index + 2] = clamp(Math.round((1 + amount) * originalData.data[index + 2] - amount * blurredData.data[index + 2]), 0, 255);
  }

  originalCtx.putImageData(originalData, 0, 0);
  return canvas;
};

export const applyVignette = (canvas: HTMLCanvasElement, vignette: number) => {
  if (!vignette) {
    return canvas;
  }

  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;

  const overlayCtx = overlay.getContext('2d');
  if (!overlayCtx) {
    throw new Error('Failed to get a 2D context for vignette.');
  }

  const gradient = overlayCtx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.6,
  );
  const opacity = Math.min(0.9, Math.abs(vignette / 100));
  const color = vignette < 0 ? '0, 0, 0' : '255, 255, 255';

  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(${color}, ${opacity})`);

  overlayCtx.fillStyle = gradient;
  overlayCtx.fillRect(0, 0, overlay.width, overlay.height);

  const blurredOverlay = document.createElement('canvas');
  blurredOverlay.width = canvas.width;
  blurredOverlay.height = canvas.height;
  const blurredCtx = blurredOverlay.getContext('2d');
  if (!blurredCtx) {
    throw new Error('Failed to get a 2D context for vignette blur.');
  }

  if (!isCtxFilterSupported()) {
    applyBlurFallback(blurredOverlay, 2);
  } else {
    blurredCtx.filter = 'blur(2px)';
    blurredCtx.drawImage(overlay, 0, 0);
    blurredCtx.filter = 'none';
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get a 2D context for vignette application.');
  }

  ctx.save();
  ctx.globalCompositeOperation = vignette < 0 ? 'multiply' : 'source-over';
  ctx.drawImage(blurredOverlay, 0, 0);
  ctx.restore();
  return canvas;
};

export const applyCurveLutsToCanvas = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  if (isIdentityCurve(adjustments.curves)) {
    return canvas;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get a 2D context for curve export.');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { r, g, b } = getCompositeCurveLuts(adjustments.curves, 256);

  for (let index = 0; index < imageData.data.length; index += 4) {
    imageData.data[index] = r[imageData.data[index]];
    imageData.data[index + 1] = g[imageData.data[index + 1]];
    imageData.data[index + 2] = b[imageData.data[index + 2]];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const applySplitToning = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const st = adjustments.splitToning;
  if (!st || (st.shadows.saturation === 0 && st.highlights.saturation === 0)) {
    return canvas;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const shH = st.shadows.hue;
  const shS = st.shadows.saturation / 100;
  const hlH = st.highlights.hue;
  const hlS = st.highlights.saturation / 100;
  const balance = st.balance / 100; // -1 to 1

  const pivot = 0.5 + balance * 0.2;

  const hslToRgb = (h: number, s: number, l: number) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h <= 360) { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
  };

  const [shR, shG, shB] = hslToRgb(shH, shS, 0.5);
  const [hlR, hlG, hlB] = hslToRgb(hlH, hlS, 0.5);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let t = 0;

    if (lum < pivot) {
      t = (pivot - lum) / pivot;
      const newR = r + (shR - 0.5) * t * shS;
      const newG = g + (shG - 0.5) * t * shS;
      const newB = b + (shB - 0.5) * t * shS;
      data[i] = clamp(Math.round(newR * 255), 0, 255);
      data[i + 1] = clamp(Math.round(newG * 255), 0, 255);
      data[i + 2] = clamp(Math.round(newB * 255), 0, 255);
    } else {
      t = (lum - pivot) / (1 - pivot);
      const newR = r + (hlR - 0.5) * t * hlS;
      const newG = g + (hlG - 0.5) * t * hlS;
      const newB = b + (hlB - 0.5) * t * hlS;
      data[i] = clamp(Math.round(newR * 255), 0, 255);
      data[i + 1] = clamp(Math.round(newG * 255), 0, 255);
      data[i + 2] = clamp(Math.round(newB * 255), 0, 255);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const applyGrain = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const gState = adjustments.grain;
  if (!gState || gState.amount === 0) {
    return canvas;
  }

  const width = canvas.width;
  const height = canvas.height;

  let scale = 1;
  if (gState.size === 'medium') scale = 2;
  else if (gState.size === 'coarse') scale = 3;

  const noiseW = Math.ceil(width / scale);
  const noiseH = Math.ceil(height / scale);

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseW;
  noiseCanvas.height = noiseH;
  const noiseCtx = noiseCanvas.getContext('2d');
  if (!noiseCtx) return canvas;

  const imgData = noiseCtx.createImageData(noiseW, noiseH);
  const data = imgData.data;

  const amount = gState.amount / 100 * 0.15;

  for (let i = 0; i < data.length; i += 4) {
    const val = Math.random() * 255;
    if (gState.colored) {
      data[i] = val;
      data[i + 1] = Math.random() * 255;
      data[i + 2] = Math.random() * 255;
    } else {
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    data[i + 3] = Math.round(amount * 255);
  }
  noiseCtx.putImageData(imgData, 0, 0);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = gState.colored ? 'soft-light' : 'overlay';
  ctx.drawImage(noiseCanvas, 0, 0, noiseW, noiseH, 0, 0, width, height);
  ctx.restore();

  return canvas;
};

export const applyLightLeak = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const leak = adjustments.lightLeak;
  if (!leak || !leak.preset) return canvas;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const opacity = leak.opacity / 100 * 0.7;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  let rgbColor = '251, 146, 60';
  if (leak.color) {
    rgbColor = hexToRgbString(leak.color);
  } else {
    if (leak.preset === 'cool-top') rgbColor = '56, 189, 248';
    else if (leak.preset === 'rainbow-corner') rgbColor = '236, 72, 153';
    else if (leak.preset === 'soft-glow') rgbColor = '253, 224, 71';
    else if (leak.preset === 'sunset-bleed') rgbColor = '239, 68, 68';
    else if (leak.preset === 'vintage-haze') rgbColor = '217, 119, 6';
  }

  const position = leak.position || (
    leak.preset === 'warm-left' ? 'left' :
    leak.preset === 'cool-top' ? 'top' :
    leak.preset === 'rainbow-corner' ? 'top-right' :
    leak.preset === 'soft-glow' ? 'center' :
    leak.preset === 'sunset-bleed' ? 'bottom-left' :
    'top-left'
  );

  let gradient: CanvasGradient;

  if (position === 'left') {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'right') {
    gradient = ctx.createLinearGradient(width, 0, 0, 0);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'top') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'bottom') {
    gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'top-right') {
    gradient = ctx.createRadialGradient(width, 0, 0, width, 0, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    if (leak.preset === 'rainbow-corner' && !leak.color) {
      gradient.addColorStop(0.3, `rgba(59, 130, 246, ${opacity * 0.8})`);
    }
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'bottom-left') {
    gradient = ctx.createRadialGradient(0, height, 0, 0, height, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    if (leak.preset === 'sunset-bleed' && !leak.color) {
      gradient.addColorStop(0.4, `rgba(249, 115, 22, ${opacity * 0.6})`);
    }
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else if (position === 'center') {
    gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.5);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `rgba(${rgbColor}, ${opacity})`);
    if (leak.preset === 'vintage-haze' && !leak.color) {
      gradient.addColorStop(0.5, `rgba(16, 185, 129, ${opacity * 0.5})`);
    }
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  return canvas;
};

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

export const applyAnnotations = (canvas: HTMLCanvasElement, annotations?: Annotation[]): Promise<HTMLCanvasElement> => {
  if (!annotations || annotations.length === 0) return Promise.resolve(canvas);

  return new Promise((resolve) => {
    const w = canvas.width;
    const h = canvas.height;

    let svgContent = '';

    annotations.forEach(ann => {
      if (ann.visible === false) return;
      const opacityAttr = ann.opacity != null && ann.opacity < 1 ? ` opacity="${ann.opacity}"` : '';
      if (ann.type === 'freehand' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svgContent += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" stroke-linejoin="round"${opacityAttr} />`;
      } else if (ann.type === 'highlighter' && ann.points) {
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const hOpacity = ann.opacity ?? 0.4;
        svgContent += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="${ann.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${hOpacity}" style="mix-blend-mode: multiply" />`;
      } else if (ann.type === 'arrow' && ann.points && ann.points.length >= 2) {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = Math.max(20, ann.strokeWidth * 3.5);
        const xTip = end.x;
        const yTip = end.y;
        const xLeft = end.x - headLength * Math.cos(angle - Math.PI / 6);
        const yLeft = end.y - headLength * Math.sin(angle - Math.PI / 6);
        const xRight = end.x - headLength * Math.cos(angle + Math.PI / 6);
        const yRight = end.y - headLength * Math.sin(angle + Math.PI / 6);

        svgContent += `<g${opacityAttr}><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}" stroke-linecap="round" /><polygon points="${xTip},${yTip} ${xLeft},${yLeft} ${xRight},${yRight}" fill="${ann.color}" /></g>`;
      } else if (ann.type === 'rect' && ann.bounds) {
        const b = ann.bounds;
        const x = b.w < 0 ? b.x + b.w : b.x;
        const y = b.h < 0 ? b.y + b.h : b.y;
        const wVal = Math.abs(b.w);
        const hVal = Math.abs(b.h);
        const fillAttr = ann.fillShape ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"` : ' fill="none"';
        svgContent += `<rect x="${x}" y="${y}" width="${wVal}" height="${hVal}"${fillAttr} stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}"${opacityAttr} />`;
      } else if (ann.type === 'circle' && ann.bounds) {
        const b = ann.bounds;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const rx = Math.abs(b.w) / 2;
        const ry = Math.abs(b.h) / 2;
        const fillAttr = ann.fillShape ? ` fill="${ann.color}" fill-opacity="${ann.fillOpacity ?? 0.5}"` : ' fill="none"';
        svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${fillAttr} stroke="${ann.color}" stroke-width="${ann.strokeWidth * 1.5}"${opacityAttr} />`;
      } else if (ann.type === 'textPath' && ann.points && ann.points.length >= 2) {
        const pathId = `path-${ann.id}`;
        const smoothed = smoothPath(ann.points);
        const d = smoothed.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const showGuide = ann.showGuidePath !== false;

        const text = ann.doodleText || 'peace in the air';
        let pathLen = 0;
        for (let i = 1; i < smoothed.length; i++) {
          const dx = smoothed[i].x - smoothed[i - 1].x;
          const dy = smoothed[i].y - smoothed[i - 1].y;
          pathLen += Math.sqrt(dx * dx + dy * dy);
        }
        const fontSize = ann.fontSize || 18;
        const charWidth = fontSize * 0.35;
        const wordLen = text.length * charWidth + 10;
        const repeats = Math.max(2, Math.ceil(pathLen / wordLen) + 3);
        const repeatedText = Array(repeats).fill(text).join('   ');

        let subSvg = `<defs><path id="${pathId}" d="${d}" /></defs>`;
        if (showGuide) {
          subSvg += `<path d="${d}" fill="none" stroke="${ann.color}" stroke-width="1.2" opacity="0.25" />`;
        }
        subSvg += `<text fill="${ann.color}" font-size="${fontSize}" font-family="${ann.fontFamily || 'Space Grotesk'}"><textPath href="#${pathId}" startOffset="4">${repeatedText}</textPath></text>`;
        svgContent += `<g${opacityAttr}>${subSvg}</g>`;
      } else if (ann.type === 'text' && ann.bounds) {
        const b = ann.bounds;
        const x = b.x;
        const y = b.y;
        const fontSize = ann.fontSize || 36;
        const fontFamily = ann.fontFamily || 'Inter';
        const text = ann.text || '';
        const lines = text.split('\n');

        const alignment = ann.textAlign || 'center';
        const textAnchor = alignment === 'center' ? 'middle' : alignment === 'right' ? 'end' : 'start';

        const textX = alignment === 'center' ? x + b.w / 2 : alignment === 'right' ? x + b.w : x;
        const textY = y + fontSize * 0.8;

        const rotVal = ann.rotation || 0;
        const cx = x + b.w / 2;
        const cy = y + b.h / 2;
        const aspect = w / h;

        const textTransform = `rotate(${rotVal}, ${cx}, ${cy}) translate(${textX}, ${textY}) scale(${1 / aspect}, 1)`;
        const transformAttr = ` transform="${textTransform}"`;

        let textStyle = `font-family: ${fontFamily}; font-weight: ${ann.fontWeight || 'normal'}; font-style: ${ann.fontStyle || 'normal'}; text-decoration: ${ann.textDecoration || 'none'};`;
        if (ann.textStroke && ann.textStroke !== 'none') {
          textStyle += ` -webkit-text-stroke: ${ann.textStroke};`;
        }
        if (ann.textShadow && ann.textShadow !== 'none') {
          textStyle += ` text-shadow: ${ann.textShadow};`;
        }
        if (ann.textTransform && ann.textTransform !== 'none') {
          textStyle += ` text-transform: ${ann.textTransform};`;
        }

        let subSvg = '';
        const baseBgColor = ann.bgColor || '';
        if (baseBgColor || ann.bgGlass) {
          const bgTransform = rotVal ? ` transform="rotate(${rotVal}, ${cx}, ${cy})"` : '';
          const bgOpacity = ann.bgOpacity !== undefined ? ann.bgOpacity : 1;
          const fillOpacity = baseBgColor ? bgOpacity : 0.08 * bgOpacity;
          const fillColor = baseBgColor || '#ffffff';
          subSvg += `<rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" fill="${fillColor}" fill-opacity="${fillOpacity}"${bgTransform} />`;
        }

        subSvg += `<text x="0" y="0" text-anchor="${textAnchor}" font-size="${fontSize}" fill="${ann.color}"${transformAttr} style="${textStyle}">`;
        lines.forEach((line, idx) => {
          const dyAttr = idx === 0 ? '' : ` dy="${ann.lineHeight || 1.2}em"`;
          const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          subSvg += `<tspan x="0"${dyAttr}>${escapedLine}</tspan>`;
        });
        subSvg += `</text>`;
        svgContent += `<g${opacityAttr}>${subSvg}</g>`;
      }
    });

    const renderSvgAndResolve = () => {
      if (svgContent) {
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${w}" height="${h}" preserveAspectRatio="none">${svgContent}</svg>`;
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
            }
            resolve(canvas);
          };
          img.onerror = () => {
            console.error('Failed to render SVG annotations image');
            resolve(canvas);
          };
          img.src = reader.result as string;
        };
        reader.onerror = () => resolve(canvas);
        reader.readAsDataURL(svgBlob);
      } else {
        resolve(canvas);
      }
    };

    renderSvgAndResolve();
  });
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

export const applyPerspective = (canvas: HTMLCanvasElement, horizontal: number, vertical: number) => {
  if (horizontal === 0 && vertical === 0) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const ry = horizontal * 0.3 * Math.PI / 180;
  const rx = vertical * 0.3 * Math.PI / 180;

  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);

  const srcCorners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];

  const projected = srcCorners.map(([x, y]) => {
    let px = x, py = y, pz = 0;
    const ty = px * sinY + pz * cosY;
    px = px * cosY - pz * sinY;
    pz = ty;
    const tx = py * sinX + pz * cosX;
    py = py * cosX - pz * sinX;
    pz = tx;
    const scale = 1000 / (1000 + pz);
    return [px * scale + w / 2, py * scale + h / 2];
  });

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(projected[0][0], projected[0][1]);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.clip();

  ctx.setTransform(
    projected[1][0] - projected[0][0],
    projected[1][1] - projected[0][1],
    projected[3][0] - projected[0][0],
    projected[3][1] - projected[0][1],
    projected[0][0],
    projected[0][1],
  );
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();

  return out;
};

export const renderCanvasWithFilter = (sourceCanvas: HTMLCanvasElement, filter: string, adjustments: Adjustments) => {
  const { canvas, ctx } = cloneCanvas(sourceCanvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isCtxFilterSupported()) {
    ctx.filter = filter || 'none';
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyBaseFiltersToImageData(imgData, adjustments);
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
};

export const applyLensCorrection = (
  canvas: HTMLCanvasElement,
  distortionStrength: number,
  useBilinear = true,
) => {
  if (distortionStrength === 0) return canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const srcData = ctx.getImageData(0, 0, w, h);
  const dstData = ctx.createImageData(w, h);
  const src = srcData.data;
  const dst = dstData.data;

  const cx = w / 2;
  const cy = h / 2;
  const rMax = Math.sqrt(cx * cx + cy * cy);
  const k = (distortionStrength / 100) * 0.15;

  if (useBilinear) {
    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      const yOffset = y * w * 4;

      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const rSq = dx * dx + dySq;
        const r = Math.sqrt(rSq);
        const rn = r / rMax;

        const factor = 1 + k * rn * rn;
        const sx = cx + dx * factor;
        const sy = cy + dy * factor;

        const dstIdx = yOffset + x * 4;

        if (sx >= 0 && sx < w - 1 && sy >= 0 && sy < h - 1) {
          const x0 = Math.floor(sx);
          const x1 = x0 + 1;
          const y0 = Math.floor(sy);
          const y1 = y0 + 1;

          const tx = sx - x0;
          const ty = sy - y0;

          const w00 = (1 - tx) * (1 - ty);
          const w10 = tx * (1 - ty);
          const w01 = (1 - tx) * ty;
          const w11 = tx * ty;

          const idx00 = (y0 * w + x0) * 4;
          const idx10 = (y0 * w + x1) * 4;
          const idx01 = (y1 * w + x0) * 4;
          const idx11 = (y1 * w + x1) * 4;

          dst[dstIdx] = src[idx00] * w00 + src[idx10] * w10 + src[idx01] * w01 + src[idx11] * w11;
          dst[dstIdx + 1] = src[idx00 + 1] * w00 + src[idx10 + 1] * w10 + src[idx01 + 1] * w01 + src[idx11 + 1] * w11;
          dst[dstIdx + 2] = src[idx00 + 2] * w00 + src[idx10 + 2] * w10 + src[idx01 + 2] * w01 + src[idx11 + 2] * w11;
          dst[dstIdx + 3] = src[idx00 + 3] * w00 + src[idx10 + 3] * w10 + src[idx01 + 3] * w01 + src[idx11 + 3] * w11;
        } else {
          dst[dstIdx] = 0;
          dst[dstIdx + 1] = 0;
          dst[dstIdx + 2] = 0;
          dst[dstIdx + 3] = 0;
        }
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      const yOffset = y * w * 4;

      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const rSq = dx * dx + dySq;
        const r = Math.sqrt(rSq);
        const rn = r / rMax;

        const factor = 1 + k * rn * rn;
        const sx = Math.round(cx + dx * factor);
        const sy = Math.round(cy + dy * factor);

        const dstIdx = yOffset + x * 4;

        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const srcIdx = (sy * w + sx) * 4;
          dst[dstIdx] = src[srcIdx];
          dst[dstIdx + 1] = src[srcIdx + 1];
          dst[dstIdx + 2] = src[srcIdx + 2];
          dst[dstIdx + 3] = src[srcIdx + 3];
        } else {
          dst[dstIdx] = 0;
          dst[dstIdx + 1] = 0;
          dst[dstIdx + 2] = 0;
          dst[dstIdx + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(dstData, 0, 0);
  return canvas;
};
