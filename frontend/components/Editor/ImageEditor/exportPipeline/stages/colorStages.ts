/**
 * colorStages.ts
 * Color effect stages: split toning, film grain, and light leaks.
 */

import { Adjustments } from '../../filterEngine';
import { clamp } from '../helpers';
import { hexToRgbString } from '../helpers';

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
