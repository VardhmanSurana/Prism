/**
 * histogramUtils.ts
 * Computes 256-bin RGB and luminosity histograms for curve analysis and visualizers.
 */

import { loadCanvasImage } from './utils/imageUtils';

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
  peak: number;
}

const BINS = 256;
const SAMPLE_SIZE = 300; // offscreen canvas width — cheap to sample

function buildEmptyData(): HistogramData {
  return {
    r: new Array(BINS).fill(0),
    g: new Array(BINS).fill(0),
    b: new Array(BINS).fill(0),
    lum: new Array(BINS).fill(0),
    peak: 1,
  };
}

/**
 * Computes live 256-bin RGB & Luminance histogram from an image with optional CSS filter applied.
 */
export async function computeHistogram(
  imageSrc: string,
  filterString: string = 'none',
): Promise<HistogramData> {
  if (!imageSrc) return buildEmptyData();

  try {
    const img = await loadCanvasImage(imageSrc);
    const aspect = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1;
    const offW = SAMPLE_SIZE;
    const offH = Math.max(1, Math.round(SAMPLE_SIZE / aspect));

    const canvas = document.createElement('canvas');
    canvas.width = offW;
    canvas.height = offH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return buildEmptyData();

    // Apply the same CSS filter the editor uses for preview
    ctx.filter = filterString || 'none';
    ctx.drawImage(img, 0, 0, offW, offH);
    ctx.filter = 'none';

    const { data } = ctx.getImageData(0, 0, offW, offH);
    const r = new Array(BINS).fill(0);
    const g = new Array(BINS).fill(0);
    const b = new Array(BINS).fill(0);
    const lum = new Array(BINS).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const rv = data[i];
      const gv = data[i + 1];
      const bv = data[i + 2];
      r[rv]++;
      g[gv]++;
      b[bv]++;
      // Rec.709 luminance
      const l = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv);
      lum[l]++;
    }

    // Find peak (excluding extreme bins that spike on borders/backgrounds)
    let peak = 1;
    for (let i = 1; i < BINS - 1; i++) {
      if (r[i] > peak) peak = r[i];
      if (g[i] > peak) peak = g[i];
      if (b[i] > peak) peak = b[i];
    }

    return { r, g, b, lum, peak };
  } catch {
    return buildEmptyData();
  }
}
