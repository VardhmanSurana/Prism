import { rgbToHex } from '../utils/colorUtils';
import { loadCanvasImage } from '../utils/imageUtils';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export async function runMedianCut(imgSrc: string, count: number): Promise<string[]> {
  try {
    const img = await loadCanvasImage(imgSrc);
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, 100, 100);
    const imgData = ctx.getImageData(0, 0, 100, 100);
    const data = imgData.data;
    const pixels: [number, number, number][] = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    const buckets = [pixels];
    while (buckets.length < count) {
      let maxBucketIdx = -1;
      let maxBucketSize = -1;
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i].length > maxBucketSize) {
          maxBucketSize = buckets[i].length;
          maxBucketIdx = i;
        }
      }
      if (maxBucketIdx === -1 || maxBucketSize <= 1) break;
      const bucketToSplit = buckets.splice(maxBucketIdx, 1)[0];

      let minR = 255, maxR = 0;
      let minG = 255, maxG = 0;
      let minB = 255, maxB = 0;
      for (const p of bucketToSplit) {
        if (p[0] < minR) minR = p[0];
        if (p[0] > maxR) maxR = p[0];
        if (p[1] < minG) minG = p[1];
        if (p[1] > maxG) maxG = p[1];
        if (p[2] < minB) minB = p[2];
        if (p[2] > maxB) maxB = p[2];
      }
      const rangeR = maxR - minR;
      const rangeG = maxG - minG;
      const rangeB = maxB - minB;

      let sortChannel = 0;
      if (rangeG >= rangeR && rangeG >= rangeB) sortChannel = 1;
      else if (rangeB >= rangeR && rangeB >= rangeG) sortChannel = 2;

      bucketToSplit.sort((a, b) => a[sortChannel] - b[sortChannel]);
      const median = Math.floor(bucketToSplit.length / 2);
      const b1 = bucketToSplit.slice(0, median);
      const b2 = bucketToSplit.slice(median);
      buckets.push(b1);
      buckets.push(b2);
    }

    const colors = buckets.map(bucket => {
      let sumR = 0, sumG = 0, sumB = 0;
      for (const p of bucket) {
        sumR += p[0];
        sumG += p[1];
        sumB += p[2];
      }
      const len = bucket.length || 1;
      const r = Math.round(sumR / len);
      const g = Math.round(sumG / len);
      const b = Math.round(sumB / len);
      return rgbToHex(r, g, b).toUpperCase();
    });

    while (colors.length < count) {
      colors.push('#808080');
    }
    return colors.slice(0, count);
  } catch {
    return [];
  }
}

