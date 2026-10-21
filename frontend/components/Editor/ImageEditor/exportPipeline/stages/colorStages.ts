/**
 * colorStages.ts
 * Color effect stages: split toning, film grain, and light leaks.
 */

import { Adjustments } from '../../filterEngine';
import { clamp } from '../helpers';
import { hexToRgbString } from '../helpers';

/**
 * Helper to convert pure Hue (0-360) to a luminance-neutral chromatic tint direction vector.
 */
function hueToChrominanceVector(hueDegrees: number): [number, number, number] {
  const h = ((hueDegrees % 360) + 360) % 360;
  const c = 1.0;
  const x = c * (1.0 - Math.abs(((h / 60) % 2) - 1.0));
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  // Relative luminance of this pure hue (ITU-R BT.709)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Subtract luminance so the vector represents pure chrominance shift without altering exposure
  return [r - lum, g - lum, b - lum];
}

export const applySplitToningToImageData = (
  imageData: ImageData,
  st: Adjustments['splitToning']
): void => {
  if (!st || (st.shadows.saturation === 0 && st.highlights.saturation === 0)) {
    return;
  }

  const data = imageData.data;
  const count = data.length;

  const shS = clamp(st.shadows.saturation / 100, 0, 1);
  const hlS = clamp(st.highlights.saturation / 100, 0, 1);
  const balance = clamp((st.balance || 0) / 100, -1, 1);

  // Dynamic midpoint threshold influenced by balance slider (-1 to 1)
  const midpoint = 0.5 + balance * 0.35;

  const [shVecR, shVecG, shVecB] = hueToChrominanceVector(st.shadows.hue || 0);
  const [hlVecR, hlVecG, hlVecB] = hueToChrominanceVector(st.highlights.hue || 0);

  // Scaled tint directions
  const shScaleR = shVecR * shS * 0.9;
  const shScaleG = shVecG * shS * 0.9;
  const shScaleB = shVecB * shS * 0.9;

  const hlScaleR = hlVecR * hlS * 0.9;
  const hlScaleG = hlVecG * hlS * 0.9;
  const hlScaleB = hlVecB * hlS * 0.9;

  for (let i = 0; i < count; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Smooth power-falloff weight curves
    // Shadows weight falls off smoothly from 0 to midpoint
    let wShadows = 0;
    if (lum < midpoint && midpoint > 0) {
      const t = (midpoint - lum) / midpoint;
      wShadows = Math.pow(t, 1.25) * (1 - lum * 0.4);
    }

    // Highlights weight falls off smoothly from 1 to midpoint
    let wHighlights = 0;
    if (lum > midpoint && midpoint < 1) {
      const t = (lum - midpoint) / (1 - midpoint);
      wHighlights = Math.pow(t, 1.25) * (0.6 + lum * 0.4);
    }

    const deltaR = (wShadows * shScaleR + wHighlights * hlScaleR) * 255;
    const deltaG = (wShadows * shScaleG + wHighlights * hlScaleG) * 255;
    const deltaB = (wShadows * shScaleB + wHighlights * hlScaleB) * 255;

    data[i] = clamp(Math.round(data[i] + deltaR), 0, 255);
    data[i + 1] = clamp(Math.round(data[i + 1] + deltaG), 0, 255);
    data[i + 2] = clamp(Math.round(data[i + 2] + deltaB), 0, 255);
  }
};

export const applySplitToning = (canvas: HTMLCanvasElement, adjustments: Adjustments) => {
  const st = adjustments.splitToning;
  if (!st || (st.shadows.saturation === 0 && st.highlights.saturation === 0)) {
    return canvas;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applySplitToningToImageData(imageData, st);
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
