import { initializeImageMagick } from '@imagemagick/magick-wasm';
import magickWasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';

let magickInitPromise: Promise<void> | null = null;

export const ensureImageMagick = () => {
  if (!magickInitPromise) {
    magickInitPromise = initializeImageMagick(new URL(magickWasmUrl, window.location.href));
  }
  return magickInitPromise;
};

export const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export returned an empty blob.'))), mimeType, quality);
  });
