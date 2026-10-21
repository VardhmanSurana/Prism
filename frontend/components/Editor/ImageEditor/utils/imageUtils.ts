/**
 * imageUtils.ts
 * Central shared math, zoom, and image loading utilities for the Image Editor.
 */

export const MIN_ZOOM = 10;
export const MAX_ZOOM = 500;

/**
 * Clamps a number between a minimum and maximum boundary.
 */
export const clamp = (val: number, min = 0, max = 255): number => {
  return Math.max(min, Math.min(max, val));
};

/**
 * Loads an image from a URL or Blob with CORS-safety, handling both remote and local sources.
 */
export const loadCanvasImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Invalid image source URL'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve(img);
    };

    img.onerror = async () => {
      // Fallback: Attempt fetch -> blob -> objectURL if direct crossOrigin load fails (e.g. strict CORS / canvas taint)
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(fallbackImg);
        };
        fallbackImg.onerror = (e) => {
          URL.revokeObjectURL(objectUrl);
          reject(e);
        };
        fallbackImg.src = objectUrl;
      } catch (err) {
        reject(err);
      }
    };

    img.src = src;
  });
};
