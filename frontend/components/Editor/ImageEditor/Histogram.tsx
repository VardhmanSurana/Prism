/**
 * Histogram.tsx
 * Live RGB luminosity histogram for the Adjust panel.
 *
 * Renders an overlay of R, G, B channel distributions by:
 *   1. Drawing the current image (with CSS filter applied) to an offscreen canvas.
 *   2. Reading pixel data via getImageData.
 *   3. Bucketing each channel into 256 bins.
 *   4. Rendering the result as a stacked SVG path.
 *
 * Recomputes at most once per 300ms (debounced) to stay smooth during dragging.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
  peak: number;
}

interface HistogramProps {
  imageSrc: string;
  filterString: string;
  onBlackPointSet?: (value: number) => void;
  onWhitePointSet?: (value: number) => void;
  onReset?: () => void;
}

const BINS = 256;
const W = 256;
const H = 72;
const SAMPLE_SIZE = 300; // offscreen canvas width — cheap to read

function buildEmptyData(): HistogramData {
  return {
    r: new Array(BINS).fill(0),
    g: new Array(BINS).fill(0),
    b: new Array(BINS).fill(0),
    lum: new Array(BINS).fill(0),
    peak: 1,
  };
}

export function computeHistogram(
  imageSrc: string,
  filterString: string,
): Promise<HistogramData> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      const offW = SAMPLE_SIZE;
      const offH = Math.round(SAMPLE_SIZE / aspect);

      const canvas = document.createElement('canvas');
      canvas.width = offW;
      canvas.height = offH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(buildEmptyData());
        return;
      }

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

      // Find peak (excluding the extreme bins which often spike on solid BG)
      let peak = 1;
      for (let i = 1; i < BINS - 1; i++) {
        if (r[i] > peak) peak = r[i];
        if (g[i] > peak) peak = g[i];
        if (b[i] > peak) peak = b[i];
      }

      resolve({ r, g, b, lum, peak });
    };
    img.onerror = () => resolve(buildEmptyData());

    // Add cache-busting only for blob: URLs (they're already unique)
    img.src = imageSrc;
  });
}

function buildPath(bins: number[], peak: number): string {
  if (peak === 0) return '';
  const scaleY = (v: number) => H - (v / peak) * H;

  const pts: string[] = [`M0,${H}`];
  for (let i = 0; i < BINS; i++) {
    const x = (i / (BINS - 1)) * W;
    const y = scaleY(bins[i]);
    pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push(`L${W},${H}`, 'Z');
  return pts.join(' ');
}

export const Histogram: React.FC<HistogramProps> = ({ imageSrc, filterString, onBlackPointSet, onWhitePointSet, onReset }) => {
  const [data, setData] = useState<HistogramData>(buildEmptyData());
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recompute = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await computeHistogram(imageSrc, filterString);
      setData(result);
      setLoading(false);
    }, 300);
  }, [imageSrc, filterString]);

  useEffect(() => {
    recompute();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [recompute]);

  const handleHistogramClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onReset?.();
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
    }, 250);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const pixelValue = Math.round(x * 255);

    if (x < 0.5) {
      const exposureOffset = Math.round((x - 0.25) * 200);
      onBlackPointSet?.(exposureOffset);
    } else {
      const exposureOffset = Math.round((x - 0.75) * 200);
      onWhitePointSet?.(exposureOffset);
    }
  }, [onBlackPointSet, onWhitePointSet, onReset]);

  const rPath   = buildPath(data.r,   data.peak);
  const gPath   = buildPath(data.g,   data.peak);
  const bPath   = buildPath(data.b,   data.peak);
  const lumPath = buildPath(data.lum, data.peak);

  return (
    <div className="px-4 pt-3 pb-4">
      <div
        className="relative rounded-xl overflow-hidden border border-white/5 cursor-crosshair"
        style={{ background: '#0a0a0a' }}
        onClick={handleHistogramClick}
      >
        {/* Zone labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-1 pointer-events-none z-10">
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/15">Shadows</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/15">Midtones</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/15">Highlights</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          style={{ display: 'block', opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s ease' }}
        >
          <defs>
            {/* Subtle grid lines */}
            <pattern id="hist-grid" x="0" y="0" width={W / 4} height={H} patternUnits="userSpaceOnUse">
              <line x1={W / 4} y1="0" x2={W / 4} y2={H} stroke="white" strokeOpacity="0.04" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width={W} height={H} fill="url(#hist-grid)" />

          {/* Luminosity channel (background, subtle white) */}
          <path d={lumPath} fill="rgba(255,255,255,0.06)" />

          {/* RGB channels blended with screen-like overlap */}
          <path d={rPath} fill="rgba(255,60,60,0.35)"  style={{ mixBlendMode: 'screen' }} />
          <path d={gPath} fill="rgba(60,220,80,0.28)"  style={{ mixBlendMode: 'screen' }} />
          <path d={bPath} fill="rgba(60,120,255,0.38)" style={{ mixBlendMode: 'screen' }} />

          {/* Top edge glow lines */}
          <path d={rPath}   fill="none" stroke="rgba(255,80,80,0.5)"   strokeWidth="0.5" />
          <path d={gPath}   fill="none" stroke="rgba(80,220,80,0.5)"   strokeWidth="0.5" />
          <path d={bPath}   fill="none" stroke="rgba(80,120,255,0.6)"  strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
};
