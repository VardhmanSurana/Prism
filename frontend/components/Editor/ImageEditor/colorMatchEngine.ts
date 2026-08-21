/**
 * colorMatchEngine.ts
 * Cinema-Grade Color Transfer & Shot Matcher using the Reinhard lαβ perceptual color space.
 *
 * References:
 * Reinhard, E., Ashikhmin, M., Gooch, B., & Shirley, P. (2001).
 * "Color transfer between images." IEEE Computer Graphics and Applications.
 */

import { resolveUrl } from '@/constants';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const SQRT_3 = Math.sqrt(3);
const SQRT_6 = Math.sqrt(6);
const SQRT_2 = Math.sqrt(2);

const INV_SQRT_3 = 1 / SQRT_3;
const INV_SQRT_6 = 1 / SQRT_6;
const INV_SQRT_2 = 1 / SQRT_2;

/**
 * Loads an image safely from a URL or Data URL, converting remote URLs via fetch+blob
 * to avoid canvas CORS tainting.
 */
export async function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  const resolved = resolveUrl(src);

  // If remote HTTP/HTTPS, fetch as blob first to guarantee local canvas origin
  let effectiveSrc = resolved;
  let blobToRevoke: string | null = null;

  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    try {
      const res = await fetch(resolved);
      if (res.ok) {
        const blob = await res.blob();
        effectiveSrc = URL.createObjectURL(blob);
        blobToRevoke = effectiveSrc;
      }
    } catch {
      // Fallback to direct src with anonymous crossOrigin
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (blobToRevoke) {
        URL.revokeObjectURL(blobToRevoke);
      }
      resolve(img);
    };
    img.onerror = err => {
      if (blobToRevoke) {
        URL.revokeObjectURL(blobToRevoke);
      }
      reject(err);
    };
    img.src = effectiveSrc;
  });
}

export interface LabStats {
  meanL: number;
  meanA: number;
  meanB: number;
  stdL: number;
  stdA: number;
  stdB: number;
}

/**
 * Computes mean and standard deviation of an image in Reinhard lαβ color space.
 */
export function computeLabColorStats(imageData: ImageData): LabStats {
  const data = imageData.data;
  const count = data.length / 4;
  if (count === 0) {
    return { meanL: 0, meanA: 0, meanB: 0, stdL: 1, stdA: 1, stdB: 1 };
  }

  // Pre-allocate temporary lαβ buffer for two-pass mean and standard deviation calculation
  const lArr = new Float32Array(count);
  const aArr = new Float32Array(count);
  const bArr = new Float32Array(count);

  let sumL = 0, sumA = 0, sumB = 0;

  for (let i = 0, p = 0; i < count; i++, p += 4) {
    // 1. Normalize RGB to [0, 1]
    const r = Math.max(1e-4, data[p] / 255);
    const g = Math.max(1e-4, data[p + 1] / 255);
    const b = Math.max(1e-4, data[p + 2] / 255);

    // 2. RGB to LMS
    const L = Math.max(1e-5, 0.3811 * r + 0.5783 * g + 0.0402 * b);
    const M = Math.max(1e-5, 0.1967 * r + 0.7244 * g + 0.0782 * b);
    const S = Math.max(1e-5, 0.0241 * r + 0.1288 * g + 0.8444 * b);

    // 3. Log10 LMS
    const logL = Math.log10(L);
    const logM = Math.log10(M);
    const logS = Math.log10(S);

    // 4. Log(LMS) to lαβ
    const lVal = (logL + logM + logS) * INV_SQRT_3;
    const aVal = (logL + logM - 2 * logS) * INV_SQRT_6;
    const bVal = (logL - logM) * INV_SQRT_2;

    lArr[i] = lVal;
    aArr[i] = aVal;
    bArr[i] = bVal;

    sumL += lVal;
    sumA += aVal;
    sumB += bVal;
  }

  const meanL = sumL / count;
  const meanA = sumA / count;
  const meanB = sumB / count;

  let varL = 0, varA = 0, varB = 0;
  for (let i = 0; i < count; i++) {
    const dL = lArr[i] - meanL;
    const dA = aArr[i] - meanA;
    const dB = bArr[i] - meanB;
    varL += dL * dL;
    varA += dA * dA;
    varB += dB * dB;
  }

  return {
    meanL,
    meanA,
    meanB,
    stdL: Math.sqrt(varL / count) || 1e-4,
    stdA: Math.sqrt(varA / count) || 1e-4,
    stdB: Math.sqrt(varB / count) || 1e-4,
  };
}

/**
 * Applies perceptual Reinhard lαβ color transfer from a reference ImageData to a target ImageData.
 */
export function applyColorMatch(
  targetData: ImageData,
  referenceData: ImageData,
  matchStrength: number = 80
): void {
  const targetStats = computeLabColorStats(targetData);
  const refStats = computeLabColorStats(referenceData);

  const s = clamp(matchStrength / 100, 0, 1);
  const data = targetData.data;
  const count = data.length / 4;

  const scaleL = refStats.stdL / targetStats.stdL;
  const scaleA = refStats.stdA / targetStats.stdA;
  const scaleB = refStats.stdB / targetStats.stdB;

  for (let p = 0; p < data.length; p += 4) {
    const r = Math.max(1e-4, data[p] / 255);
    const g = Math.max(1e-4, data[p + 1] / 255);
    const b = Math.max(1e-4, data[p + 2] / 255);

    // 1. RGB to LMS
    const L = Math.max(1e-5, 0.3811 * r + 0.5783 * g + 0.0402 * b);
    const M = Math.max(1e-5, 0.1967 * r + 0.7244 * g + 0.0782 * b);
    const S = Math.max(1e-5, 0.0241 * r + 0.1288 * g + 0.8444 * b);

    // 2. Log10 LMS
    const logL = Math.log10(L);
    const logM = Math.log10(M);
    const logS = Math.log10(S);

    // 3. Log(LMS) to lαβ
    const lVal = (logL + logM + logS) * INV_SQRT_3;
    const aVal = (logL + logM - 2 * logS) * INV_SQRT_6;
    const bVal = (logL - logM) * INV_SQRT_2;

    // 4. Shift and scale in lαβ space
    const matchedL = (lVal - targetStats.meanL) * scaleL + refStats.meanL;
    const matchedA = (aVal - targetStats.meanA) * scaleA + refStats.meanA;
    const matchedB = (bVal - targetStats.meanB) * scaleB + refStats.meanB;

    // 5. Interpolate based on strength
    const finalL = (1 - s) * lVal + s * matchedL;
    const finalA = (1 - s) * aVal + s * matchedA;
    const finalB = (1 - s) * bVal + s * matchedB;

    // 6. lαβ back to log(LMS)
    const newLogL = finalL * INV_SQRT_3 + finalA * INV_SQRT_6 + finalB * INV_SQRT_2;
    const newLogM = finalL * INV_SQRT_3 + finalA * INV_SQRT_6 - finalB * INV_SQRT_2;
    const newLogS = finalL * INV_SQRT_3 - 2 * finalA * INV_SQRT_6;

    // 7. 10^log(LMS) to LMS
    const newL = Math.pow(10, newLogL);
    const newM = Math.pow(10, newLogM);
    const newS = Math.pow(10, newLogS);

    // 8. LMS to RGB
    const newR = 4.4679 * newL - 3.5873 * newM + 0.1193 * newS;
    const newG = -1.2186 * newL + 2.3809 * newM - 0.1624 * newS;
    const newB = 0.0497 * newL - 0.2439 * newM + 1.2045 * newS;

    data[p] = clamp(Math.round(newR * 255), 0, 255);
    data[p + 1] = clamp(Math.round(newG * 255), 0, 255);
    data[p + 2] = clamp(Math.round(newB * 255), 0, 255);
  }
}

/**
 * High-level function to perform color matching between a target and a reference image source.
 * Returns a PNG Blob URL of the matched image.
 */
export async function matchColorBetweenImages(
  targetSrc: string,
  referenceSrc: string,
  strength: number = 80
): Promise<string> {
  const [targetImg, refImg] = await Promise.all([
    loadCanvasImage(targetSrc),
    loadCanvasImage(referenceSrc),
  ]);

  const targetWidth = targetImg.naturalWidth || targetImg.width;
  const targetHeight = targetImg.naturalHeight || targetImg.height;
  const refWidth = refImg.naturalWidth || refImg.width;
  const refHeight = refImg.naturalHeight || refImg.height;

  if (targetWidth <= 0 || targetHeight <= 0 || refWidth <= 0 || refHeight <= 0) {
    throw new Error('Invalid image dimensions for color matching.');
  }

  // Draw reference to canvas and get pixels
  const refCanvas = document.createElement('canvas');
  refCanvas.width = refWidth;
  refCanvas.height = refHeight;
  const refCtx = refCanvas.getContext('2d', { willReadFrequently: true });
  if (!refCtx) throw new Error('Could not create reference canvas context');
  refCtx.drawImage(refImg, 0, 0);
  const refData = refCtx.getImageData(0, 0, refWidth, refHeight);

  // Draw target to canvas and get pixels
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetCtx) throw new Error('Could not create target canvas context');
  targetCtx.drawImage(targetImg, 0, 0);
  const targetData = targetCtx.getImageData(0, 0, targetWidth, targetHeight);

  // Apply Reinhard lαβ color match
  applyColorMatch(targetData, refData, strength);
  targetCtx.putImageData(targetData, 0, 0);

  return new Promise((resolve, reject) => {
    targetCanvas.toBlob(blob => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Failed to generate color matched image blob'));
      }
    }, 'image/png');
  });
}
