/**
 * maskBuffer.ts
 * Extraction, caching, and 2D bilinear sampling of portrait mask buffers.
 */

import { MaskBuffer } from './types';
import { loadCanvasImage } from '../utils/imageUtils';

// Global cache for loaded mask buffers by URL
const maskBufferCache = new Map<string, MaskBuffer>();

export function clearMaskBufferCache(): void {
  maskBufferCache.clear();
}

export async function loadMaskBuffer(maskUrl: string): Promise<MaskBuffer | null> {
  if (!maskUrl) return null;

  const cached = maskBufferCache.get(maskUrl);
  if (cached) {
    return cached;
  }

  try {
    const img = await loadCanvasImage(maskUrl);
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = new Uint8Array(w * h);

    // Extract grayscale mask intensity (0-255)
    for (let i = 0; i < data.length; i++) {
      const r = imgData.data[i * 4];
      const a = imgData.data[i * 4 + 3];
      data[i] = a === 0 ? 0 : r;
    }

    const buffer: MaskBuffer = { width: w, height: h, data };
    maskBufferCache.set(maskUrl, buffer);
    return buffer;
  } catch (err) {
    console.warn('Failed to extract mask buffer:', err);
    return null;
  }
}

export function sampleMask(mask: MaskBuffer | null | undefined, u: number, v: number): number {
  if (!mask) return 0;
  const mx = Math.max(0, Math.min(mask.width - 1, Math.floor(u * mask.width)));
  const my = Math.max(0, Math.min(mask.height - 1, Math.floor(v * mask.height)));
  return mask.data[my * mask.width + mx] || 0;
}

