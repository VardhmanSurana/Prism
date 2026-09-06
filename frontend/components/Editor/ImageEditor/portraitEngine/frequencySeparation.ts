/**
 * frequencySeparation.ts
 * Mask-bounded, edge-preserving separable blur for skin frequency separation.
 */

import { MaskBuffer } from './types';
import { sampleMask } from './maskBuffer';

/**
 * Mask-bounded, edge-preserving separable blur for Low Frequency tone layer.
 * Weights samples by skin mask to completely prevent dark beard/hair bleeding into skin.
 */
export function createMaskBoundedLowFrequencyBuffer(
  imageData: ImageData,
  skinBuf: MaskBuffer,
  radius: number
): Uint8ClampedArray {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const r = Math.max(2, Math.min(25, Math.round(radius)));

  const tempR = new Float32Array(width * height);
  const tempG = new Float32Array(width * height);
  const tempB = new Float32Array(width * height);

  // Fast horizontal pass
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const maskVal = sampleMask(skinBuf, u, v);
      const idx = rowOffset + x;
      const pIdx = idx * 4;

      if (maskVal === 0) {
        tempR[idx] = data[pIdx];
        tempG[idx] = data[pIdx + 1];
        tempB[idx] = data[pIdx + 2];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const startX = Math.max(0, x - r);
      const endX = Math.min(width - 1, x + r);

      for (let kx = startX; kx <= endX; kx++) {
        const ku = (kx + 0.5) / width;
        const kMask = sampleMask(skinBuf, ku, v);
        const weight = (kMask / 255) + 0.08;

        const kIdx = (rowOffset + kx) * 4;
        rSum += data[kIdx] * weight;
        gSum += data[kIdx + 1] * weight;
        bSum += data[kIdx + 2] * weight;
        wSum += weight;
      }

      tempR[idx] = wSum > 0 ? rSum / wSum : data[pIdx];
      tempG[idx] = wSum > 0 ? gSum / wSum : data[pIdx + 1];
      tempB[idx] = wSum > 0 ? bSum / wSum : data[pIdx + 2];
    }
  }

  // Fast vertical pass
  for (let x = 0; x < width; x++) {
    const u = (x + 0.5) / width;
    for (let y = 0; y < height; y++) {
      const v = (y + 0.5) / height;
      const maskVal = sampleMask(skinBuf, u, v);
      const idx = y * width + x;
      const pIdx = idx * 4;

      if (maskVal === 0) {
        output[pIdx] = data[pIdx];
        output[pIdx + 1] = data[pIdx + 1];
        output[pIdx + 2] = data[pIdx + 2];
        output[pIdx + 3] = data[pIdx + 3];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const startY = Math.max(0, y - r);
      const endY = Math.min(height - 1, y + r);

      for (let ky = startY; ky <= endY; ky++) {
        const kv = (ky + 0.5) / height;
        const kMask = sampleMask(skinBuf, u, kv);
        const weight = (kMask / 255) + 0.08;

        const kIdx = ky * width + x;
        rSum += tempR[kIdx] * weight;
        gSum += tempG[kIdx] * weight;
        bSum += tempB[kIdx] * weight;
        wSum += weight;
      }

      output[pIdx] = Math.round(wSum > 0 ? rSum / wSum : tempR[idx]);
      output[pIdx + 1] = Math.round(wSum > 0 ? gSum / wSum : tempG[idx]);
      output[pIdx + 2] = Math.round(wSum > 0 ? bSum / wSum : tempB[idx]);
      output[pIdx + 3] = data[pIdx + 3];
    }
  }

  return output;
}

