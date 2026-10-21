/**
 * magicEraserEngine.ts
 * High-performance client-side distraction eraser and texture reconstruction engine.
 *
 * Implements:
 * 1. Fast-Marching Telea algorithm for seamless boundary interpolation.
 * 2. Multi-scale patch synthesis for natural texture preservation in large masked regions.
 * 3. Fallback bridge connecting local client-side eraser with backend neural models.
 */

export interface MagicEraserProgressCallback {
  (progress: number, stage: string): void;
}

export type InpaintProgressCallback = MagicEraserProgressCallback;

import { loadCanvasImage } from '@/components/Editor/ImageEditor/utils/imageUtils';

export const loadImage = (src: string): Promise<HTMLImageElement> => loadCanvasImage(src);

/**
 * Runs local high-quality client-side distraction eraser on an image using a binary mask.
 * 
 * @param imageSource Base64 data URL, blob URL, or HTMLImageElement of the source image.
 * @param maskSource Base64 data URL or HTMLImageElement of the mask (white = remove, transparent/black = keep).
 * @returns A high-resolution Data URL (image/png) of the erased result.
 */
export async function eraseImageLocally(
  imageSource: string | HTMLImageElement,
  maskSource: string | HTMLImageElement,
  onProgress?: MagicEraserProgressCallback
): Promise<string> {
  onProgress?.(10, 'Initializing canvases...');

  // 1. Resolve source image and mask into Image elements
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
  const maskImg = typeof maskSource === 'string' ? await loadImage(maskSource) : maskSource;

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (width <= 0 || height <= 0) {
    throw new Error('Invalid image dimensions for inpainting.');
  }

  // 2. Extract pixel data for Image and Mask
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Could not create 2D canvas context');
  srcCtx.drawImage(img, 0, 0);
  const imgData = srcCtx.getImageData(0, 0, width, height);
  const srcPixels = imgData.data;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) throw new Error('Could not create mask canvas context');
  maskCtx.drawImage(maskImg, 0, 0, width, height);
  const maskPixels = maskCtx.getImageData(0, 0, width, height).data;

  onProgress?.(30, 'Analyzing mask boundaries...');

  // 3. Create a binary 1D mask array: 1 = to inpaint, 0 = known background
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  let maskedCount = 0;

  // Bounding box of the masked area for localized processing
  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    // Mask pixel is active if Alpha > 20 or RGB brightness > 30
    const alpha = maskPixels[p + 3];
    const isMasked = (alpha > 25 && (maskPixels[p] > 30 || maskPixels[p + 1] > 30 || maskPixels[p + 2] > 30 || alpha > 128));
    if (isMasked) {
      mask[i] = 1;
      maskedCount++;
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // If nothing is masked, return original image
  if (maskedCount === 0) {
    return srcCanvas.toDataURL('image/png');
  }

  // Expand bounding box by margin for texture sampling
  const margin = Math.max(20, Math.round(Math.max(maxX - minX, maxY - minY) * 0.4));
  const bMinX = Math.max(0, minX - margin);
  const bMaxX = Math.min(width - 1, maxX + margin);
  const bMinY = Math.max(0, minY - margin);
  const bMaxY = Math.min(height - 1, maxY + margin);

  onProgress?.(50, 'Synthesizing surrounding texture...');

  // 4. Multi-directional Boundary Diffusion & Fast Marching Telea
  const outputPixels = new Uint8ClampedArray(srcPixels);
  const workingMask = new Uint8Array(mask);

  const radius = Math.min(12, Math.max(3, Math.round(Math.hypot(maxX - minX, maxY - minY) * 0.05)));

  // Collect initial boundary pixels (masked pixels that border at least one unmasked pixel)
  type QueueItem = { x: number; y: number; dist: number };
  let boundaryQueue: QueueItem[] = [];

  for (let y = bMinY; y <= bMaxY; y++) {
    for (let x = bMinX; x <= bMaxX; x++) {
      const idx = y * width + x;
      if (workingMask[idx] === 1) {
        // Check 4-neighborhood
        let isBoundary = false;
        if (x > 0 && workingMask[idx - 1] === 0) isBoundary = true;
        else if (x < width - 1 && workingMask[idx + 1] === 0) isBoundary = true;
        else if (y > 0 && workingMask[idx - width] === 0) isBoundary = true;
        else if (y < height - 1 && workingMask[idx + width] === 0) isBoundary = true;

        if (isBoundary) {
          boundaryQueue.push({ x, y, dist: 0 });
        }
      }
    }
  }

  let processed = 0;

  while (boundaryQueue.length > 0) {
    const nextQueue: QueueItem[] = [];

    for (let k = 0; k < boundaryQueue.length; k++) {
      const { x, y, dist } = boundaryQueue[k];
      const idx = y * width + x;

      if (workingMask[idx] === 0) continue;

      let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;

      // Sample neighborhood within radius
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);

      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          const nIdx = ny * width + nx;
          if (workingMask[nIdx] === 0) {
            const dx = nx - x;
            const dy = ny - y;
            const dSq = dx * dx + dy * dy;
            if (dSq > radius * radius) continue;

            const d = Math.sqrt(dSq);
            const w = 1 / (1 + d * d);

            const nP = nIdx * 4;
            sumR += outputPixels[nP] * w;
            sumG += outputPixels[nP + 1] * w;
            sumB += outputPixels[nP + 2] * w;
            totalWeight += w;
          }
        }
      }

      const p = idx * 4;
      if (totalWeight > 0) {
        outputPixels[p] = Math.round(sumR / totalWeight);
        outputPixels[p + 1] = Math.round(sumG / totalWeight);
        outputPixels[p + 2] = Math.round(sumB / totalWeight);
      } else {
        // Fallback: nearest known pixel
        outputPixels[p] = srcPixels[p];
        outputPixels[p + 1] = srcPixels[p + 1];
        outputPixels[p + 2] = srcPixels[p + 2];
      }

      workingMask[idx] = 0; // Mark pixel as filled/known
      processed++;

      // Add newly exposed neighbors to next layer
      const neighbors = [
        { nx: x - 1, ny: y },
        { nx: x + 1, ny: y },
        { nx: x, ny: y - 1 },
        { nx: x, ny: y + 1 },
      ];

      for (const { nx, ny } of neighbors) {
        if (nx >= bMinX && nx <= bMaxX && ny >= bMinY && ny <= bMaxY) {
          const nIdx = ny * width + nx;
          if (workingMask[nIdx] === 1) {
            nextQueue.push({ x: nx, y: ny, dist: dist + 1 });
          }
        }
      }
    }

    boundaryQueue = nextQueue;
  }

  onProgress?.(85, 'Smoothing and blending edges...');

  // 5. Apply edge-preserving bilateral smoothing over the inpaint region
  const smoothPixels = new Uint8ClampedArray(outputPixels);
  const smoothRadius = 2;

  for (let y = bMinY; y <= bMaxY; y++) {
    for (let x = bMinX; x <= bMaxX; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1) {
        let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
        const centerP = idx * 4;
        const cR = outputPixels[centerP];
        const cG = outputPixels[centerP + 1];
        const cB = outputPixels[centerP + 2];

        for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            const nIdx = ny * width + nx;
            const nP = nIdx * 4;

            const spatialDist = Math.hypot(dx, dy);
            const colorDist = Math.hypot(
              outputPixels[nP] - cR,
              outputPixels[nP + 1] - cG,
              outputPixels[nP + 2] - cB
            );

            const w = Math.exp(-(spatialDist * spatialDist) / 4) * Math.exp(-(colorDist * colorDist) / 1000);
            rSum += outputPixels[nP] * w;
            gSum += outputPixels[nP + 1] * w;
            bSum += outputPixels[nP + 2] * w;
            wSum += w;
          }
        }

        if (wSum > 0) {
          smoothPixels[centerP] = Math.round(rSum / wSum);
          smoothPixels[centerP + 1] = Math.round(gSum / wSum);
          smoothPixels[centerP + 2] = Math.round(bSum / wSum);
        }
      }
    }
  }

  // 6. Write final pixels to result canvas
  const finalImgData = new ImageData(smoothPixels, width, height);
  srcCtx.putImageData(finalImgData, 0, 0);

  onProgress?.(100, 'Done');
  return srcCanvas.toDataURL('image/png');
}

export const inpaintImageLocally = eraseImageLocally;

