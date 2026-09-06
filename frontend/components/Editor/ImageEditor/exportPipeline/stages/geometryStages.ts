/**
 * geometryStages.ts
 * Geometry correction stages: perspective transform, lens distortion correction,
 * chromatic aberration defringe, and cosine-fourth optical vignetting.
 */

import { Adjustments } from '../../filterEngine';
import { clamp } from '../helpers';

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

export const applyDefringeAndOpticalVignetting = (
  canvas: HTMLCanvasElement,
  defringe: Adjustments['defringe'],
) => {
  if (!defringe || (defringe.amount === 0 && defringe.vignetteCos4 === 0)) {
    return canvas;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const cx = w / 2;
  const cy = h / 2;
  const f = Math.max(w, h); // focal distance estimate

  const amount = (defringe.amount || 0) / 100;
  const hueStart = defringe.hueStart ?? 270;
  const hueEnd = defringe.hueEnd ?? 330;
  const cos4Amount = (defringe.vignetteCos4 || 0) / 100;

  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    const dySq = dy * dy;

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      // 1. Cosine-Fourth Optical Vignetting Correction
      if (cos4Amount > 0) {
        const dx = x - cx;
        const rSq = dx * dx + dySq;
        const tanSq = rSq / (f * f);
        const cos4Inv = Math.pow(1 + tanSq, 2); // 1 / cos^4(theta)
        const boost = 1 + (cos4Inv - 1) * cos4Amount * 0.4;

        r = clamp(Math.round(r * boost), 0, 255);
        g = clamp(Math.round(g * boost), 0, 255);
        b = clamp(Math.round(b * boost), 0, 255);
      }

      // 2. Chromatic Aberration Defringe Desaturation
      if (amount > 0) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        if (d > 15) {
          let hue = 0;
          if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          else if (max === g) hue = ((b - r) / d + 2) * 60;
          else hue = ((r - g) / d + 4) * 60;

          if (hue >= hueStart && hue <= hueEnd) {
            const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = Math.round(r + (gray - r) * amount);
            g = Math.round(g + (gray - g) * amount);
            b = Math.round(b + (gray - b) * amount);
          }
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
};
