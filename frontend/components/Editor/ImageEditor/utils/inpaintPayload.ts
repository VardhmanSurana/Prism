import { loadCanvasImage } from './imageUtils';

export const MAX_INPAINT_SIDE = 2048;

export function fitInpaintDimensions(width: number, height: number): { width: number; height: number } {
  const longestSide = Math.max(width, height);
  if (longestSide <= MAX_INPAINT_SIDE) return { width, height };

  const scale = MAX_INPAINT_SIDE / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Encodes a bounded editor preview for remote inpainting. Sending a JPEG rather
 * than the original base64 file avoids duplicating a potentially huge image in
 * browser, JSON, and backend memory at the same time.
 */
export async function createInpaintPayload(source: string): Promise<string> {
  const image = await loadCanvasImage(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const target = fitInpaintDimensions(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare image for inpainting');

  context.drawImage(image, 0, 0, target.width, target.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}
