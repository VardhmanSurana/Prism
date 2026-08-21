/**
 * lassoEngine.ts
 * High-performance selection engine supporting:
 * 1. Freehand, Polygonal, and Intelligent Scissors (Magnetic Live-Wire) pathfinding.
 * 2. Boolean mask combination operations (New, Add, Subtract, Intersect).
 * 3. Morphological edge refinement (Feather, Smooth, Shift Edge / Expand-Contract, Contrast).
 * 4. Mask caching, boundary extraction, marching ants rendering, and coordinate transformations.
 */

export type LassoType = 'freehand' | 'polygonal' | 'magnetic';
export type LassoOperation = 'new' | 'add' | 'subtract' | 'intersect';
export type MaskPreviewMode = 'ants' | 'overlay' | 'bw' | 'on_black' | 'on_white';

export interface Point2D {
  x: number;
  y: number;
}

export interface RefineEdgeSettings {
  feather: number;    // 0 -> 100px
  smooth: number;     // 0 -> 50px
  shiftEdge: number;  // -50 -> +50px (dilate/erode)
  contrast: number;   // 0 -> 100%
}

export interface MagneticSettings {
  sensitivity: number;        // 1 -> 100
  snapRadius: number;         // 5 -> 50px
  autoAnchor: boolean;        // automatically drop anchors
  autoAnchorDistance: number; // pixel distance threshold (10 -> 80px)
}

export interface LassoState {
  type: LassoType;
  operation: LassoOperation;
  points: Point2D[];
  liveWirePath: Point2D[];
  closedPaths: Point2D[][];    // Completed closed selection vector contours for persistent marching ants
  isClosed: boolean;
  previewMode: MaskPreviewMode;
  refine: RefineEdgeSettings;
  magnetic: MagneticSettings;
  hasActiveMask: boolean;
  activeMaskDataUrl: string | null;
}

export const DEFAULT_REFINE_SETTINGS: RefineEdgeSettings = {
  feather: 0,
  smooth: 0,
  shiftEdge: 0,
  contrast: 0,
};

export const DEFAULT_MAGNETIC_SETTINGS: MagneticSettings = {
  sensitivity: 65,
  snapRadius: 18,
  autoAnchor: true,
  autoAnchorDistance: 32,
};

export const DEFAULT_LASSO_STATE: LassoState = {
  type: 'freehand',
  operation: 'new',
  points: [],
  liveWirePath: [],
  closedPaths: [],
  isClosed: false,
  previewMode: 'ants',
  refine: { ...DEFAULT_REFINE_SETTINGS },
  magnetic: { ...DEFAULT_MAGNETIC_SETTINGS },
  hasActiveMask: false,
  activeMaskDataUrl: null,
};

// ─── GRADIENT & COST MAP FOR INTELLIGENT SCISSORS ─────────────────────────

export interface LiveWireCostMap {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  cost: Float32Array;      // 0.0 (high edge / low cost) to 1.0 (flat region)
  gradX: Float32Array;
  gradY: Float32Array;
  gradMag: Float32Array;
}

/**
 * Builds a normalized gradient cost map from image data for Dijkstra live-wire searches.
 * Downsamples large images to maintain smooth 60fps path calculation.
 */
export function buildLiveWireCostMap(imgData: ImageData, maxDim = 480): LiveWireCostMap {
  const origW = imgData.width;
  const origH = imgData.height;

  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  const w = Math.max(16, Math.round(origW * scale));
  const h = Math.max(16, Math.round(origH * scale));

  // Downsample to target resolution
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = origW;
  tempCanvas.height = origH;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!tempCtx) {
    return {
      width: 1,
      height: 1,
      scaleX: 1,
      scaleY: 1,
      cost: new Float32Array(1),
      gradX: new Float32Array(1),
      gradY: new Float32Array(1),
      gradMag: new Float32Array(1),
    };
  }
  tempCtx.putImageData(imgData, 0, 0);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = w;
  scaledCanvas.height = h;
  const sCtx = scaledCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx) throw new Error('Could not create scaled context');
  sCtx.drawImage(tempCanvas, 0, 0, w, h);
  const scaledData = sCtx.getImageData(0, 0, w, h).data;

  // 1. Grayscale luminance
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * scaledData[idx] + 0.587 * scaledData[idx + 1] + 0.114 * scaledData[idx + 2];
  }

  // 2. Sobel Gradients
  const gradX = new Float32Array(w * h);
  const gradY = new Float32Array(w * h);
  const gradMag = new Float32Array(w * h);
  let maxMag = 0.001;

  for (let y = 1; y < h - 1; y++) {
    const yw = y * w;
    const yPrev = (y - 1) * w;
    const yNext = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      // Sobel X
      const gx =
        -lum[yPrev + (x - 1)] + lum[yPrev + (x + 1)]
        - 2 * lum[yw + (x - 1)] + 2 * lum[yw + (x + 1)]
        - lum[yNext + (x - 1)] + lum[yNext + (x + 1)];

      // Sobel Y
      const gy =
        -lum[yPrev + (x - 1)] - 2 * lum[yPrev + x] - lum[yPrev + (x + 1)]
        + lum[yNext + (x - 1)] + 2 * lum[yNext + x] + lum[yNext + (x + 1)];

      const mag = Math.hypot(gx, gy);
      const idx = yw + x;
      gradX[idx] = gx;
      gradY[idx] = gy;
      gradMag[idx] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // 3. Compute cost map: high gradient = lowest cost
  const cost = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const normMag = gradMag[i] / maxMag;
    // Invert so high gradient is low cost (easy traversal)
    cost[i] = Math.pow(1 - normMag, 2);
  }

  return {
    width: w,
    height: h,
    scaleX: origW / w,
    scaleY: origH / h,
    cost,
    gradX,
    gradY,
    gradMag,
  };
}

/**
 * Finds the shortest edge path between start and end coordinates using Dijkstra / Live-Wire search.
 */
export function findIntelligentScissorsPath(
  costMap: LiveWireCostMap,
  startOrig: Point2D,
  endOrig: Point2D
): Point2D[] {
  const { width: w, height: h, scaleX, scaleY, cost } = costMap;

  // Convert to cost map grid coordinates
  const sx = Math.max(0, Math.min(w - 1, Math.round(startOrig.x / scaleX)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(startOrig.y / scaleY)));
  const ex = Math.max(0, Math.min(w - 1, Math.round(endOrig.x / scaleX)));
  const ey = Math.max(0, Math.min(h - 1, Math.round(endOrig.y / scaleY)));

  if (sx === ex && sy === ey) {
    return [startOrig, endOrig];
  }

  // Bounding search window with padding
  const pad = 40;
  const minX = Math.max(0, Math.min(sx, ex) - pad);
  const maxX = Math.min(w - 1, Math.max(sx, ex) + pad);
  const minY = Math.max(0, Math.min(sy, ey) - pad);
  const maxY = Math.min(h - 1, Math.max(sy, ey) + pad);

  const startIdx = sy * w + sx;
  const targetIdx = ey * w + ex;

  const dist = new Float32Array(w * h).fill(Infinity);
  const parent = new Int32Array(w * h).fill(-1);
  const visited = new Uint8Array(w * h);

  dist[startIdx] = 0;

  // Simple min-heap priority queue
  const heap: { idx: number; priority: number }[] = [];
  const pushHeap = (idx: number, priority: number) => {
    heap.push({ idx, priority });
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].priority <= heap[i].priority) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };

  const popHeap = (): number => {
    const top = heap[0].idx;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const len = heap.length;
      while (true) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < len && heap[left].priority < heap[smallest].priority) smallest = left;
        if (right < len && heap[right].priority < heap[smallest].priority) smallest = right;
        if (smallest === i) break;
        const tmp = heap[i];
        heap[i] = heap[smallest];
        heap[smallest] = tmp;
        i = smallest;
      }
    }
    return top;
  };

  pushHeap(startIdx, 0);

  // 8-neighborhood offsets
  const neighbors = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [1, 1, 1.414],
  ];

  let iterations = 0;
  const maxIterations = (maxX - minX + 1) * (maxY - minY + 1) * 2;

  while (heap.length > 0 && iterations < maxIterations) {
    iterations++;
    const curr = popHeap();
    if (curr === targetIdx) break;
    if (visited[curr]) continue;
    visited[curr] = 1;

    const cx = curr % w;
    const cy = Math.floor(curr / w);

    for (let k = 0; k < neighbors.length; k++) {
      const nx = cx + neighbors[k][0];
      const ny = cy + neighbors[k][1];
      const stepCost = neighbors[k][2];

      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;

      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;

      // Link cost combines pixel gradient cost and euclidean step length
      const linkCost = cost[nIdx] * stepCost;
      const newDist = dist[curr] + linkCost;

      if (newDist < dist[nIdx]) {
        dist[nIdx] = newDist;
        parent[nIdx] = curr;
        pushHeap(nIdx, newDist);
      }
    }
  }

  // Reconstruct path
  const path: Point2D[] = [];
  let curr = targetIdx;

  // If search didn't reach target, fallback to straight line
  if (parent[curr] === -1 && curr !== startIdx) {
    return [startOrig, endOrig];
  }

  while (curr !== -1) {
    const px = (curr % w) * scaleX;
    const py = Math.floor(curr / w) * scaleY;
    path.push({ x: px, y: py });
    if (curr === startIdx) break;
    curr = parent[curr];
  }

  path.reverse();

  // Ensure first and last points align exactly with arguments
  if (path.length > 0) {
    path[0] = { ...startOrig };
    path[path.length - 1] = { ...endOrig };
  } else {
    return [startOrig, endOrig];
  }

  return path;
}

/**
 * Snaps a candidate point to the highest gradient magnitude edge in a given radius.
 */
export function findMagneticEdgePoint(
  imgData: ImageData,
  cx: number,
  cy: number,
  searchRadius = 15
): Point2D {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  let maxScore = -1;
  let bestX = Math.round(cx);
  let bestY = Math.round(cy);

  const startX = Math.max(1, Math.min(w - 2, Math.round(cx - searchRadius)));
  const endX = Math.max(1, Math.min(w - 2, Math.round(cx + searchRadius)));
  const startY = Math.max(1, Math.min(h - 2, Math.round(cy - searchRadius)));
  const endY = Math.max(1, Math.min(h - 2, Math.round(cy + searchRadius)));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const idxR = (y * w + (x + 1)) * 4;
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];

      const idxD = ((y + 1) * w + x) * 4;
      const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];

      const gx = lumR - lum;
      const gy = lumD - lum;
      const gradMag = Math.hypot(gx, gy);

      // Distance weighting: favor edges closer to cursor
      const dist = Math.hypot(x - cx, y - cy);
      const score = gradMag / (1 + dist * 0.25);

      if (score > maxScore) {
        maxScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY };
}

// ─── MASK RENDERING, BOUNDARY EXTRACTION & MARCHING ANTS ──────────────────

/**
 * Creates an empty mask canvas (filled with pure black).
 */
export function createEmptyMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

/**
 * Renders a closed polygon path onto a binary mask canvas (white foreground on black background).
 */
export function renderPolygonToMask(
  points: Point2D[],
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = createEmptyMaskCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx || points.length < 3) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  return canvas;
}

/**
 * Performs Boolean combination (New, Add, Subtract, Intersect) between an existing mask canvas and a new polygon path.
 */
export function combineMaskWithPolygon(
  existingMask: HTMLCanvasElement | null,
  points: Point2D[],
  operation: LassoOperation,
  width: number,
  height: number
): HTMLCanvasElement {
  const newPathMask = renderPolygonToMask(points, width, height);

  if (operation === 'new' || !existingMask) {
    return newPathMask;
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d');
  if (!ctx) return newPathMask;

  // Initialize with black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (operation === 'add') {
    // Union: draw existing white pixels + draw new white pixels
    ctx.drawImage(existingMask, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(newPathMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else if (operation === 'subtract') {
    // Difference: draw existing mask, then subtract newPathMask
    const eCtx = existingMask.getContext('2d');
    const nCtx = newPathMask.getContext('2d');
    if (eCtx && nCtx) {
      const eData = eCtx.getImageData(0, 0, width, height);
      const nData = nCtx.getImageData(0, 0, width, height);
      const outData = ctx.createImageData(width, height);

      const d = outData.data;
      const ed = eData.data;
      const nd = nData.data;

      for (let i = 0; i < d.length; i += 4) {
        const val = Math.max(0, ed[i] - nd[i]);
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
        d[i + 3] = 255;
      }
      ctx.putImageData(outData, 0, 0);
      return resultCanvas;
    }
  } else if (operation === 'intersect') {
    // Intersection: only where both are white
    const eCtx = existingMask.getContext('2d');
    const nCtx = newPathMask.getContext('2d');
    if (eCtx && nCtx) {
      const eData = eCtx.getImageData(0, 0, width, height);
      const nData = nCtx.getImageData(0, 0, width, height);
      const outData = ctx.createImageData(width, height);

      const d = outData.data;
      const ed = eData.data;
      const nd = nData.data;

      for (let i = 0; i < d.length; i += 4) {
        const val = Math.min(ed[i], nd[i]);
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
        d[i + 3] = 255;
      }
      ctx.putImageData(outData, 0, 0);
      return resultCanvas;
    }
  }

  return resultCanvas;
}

/**
 * Extracts 1-pixel boundary from mask canvas for marching ants rendering on composite masks.
 */
export function extractMaskBoundary(
  maskCanvas: HTMLCanvasElement
): { width: number; height: number; boundary: Uint8Array } {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { width: w, height: h, boundary: new Uint8Array(0) };

  const data = ctx.getImageData(0, 0, w, h).data;
  const boundary = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const yw = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (yw + x) * 4;
      if (data[idx] > 128) {
        // Boundary if on edge or adjacent to dark pixel
        if (
          x === 0 ||
          x === w - 1 ||
          y === 0 ||
          y === h - 1 ||
          data[(yw + x - 1) * 4] <= 128 ||
          data[(yw + x + 1) * 4] <= 128 ||
          data[((y - 1) * w + x) * 4] <= 128 ||
          data[((y + 1) * w + x) * 4] <= 128
        ) {
          boundary[yw + x] = 1;
        }
      }
    }
  }

  return { width: w, height: h, boundary };
}

/**
 * Draws animated marching ants onto target context using boundary pixel data.
 */
export function renderBoundaryMarchingAnts(
  targetCtx: CanvasRenderingContext2D,
  boundaryData: { width: number; height: number; boundary: Uint8Array },
  dashOffset: number
) {
  const { width: w, height: h, boundary } = boundaryData;
  if (boundary.length === 0) return;

  const imgData = targetCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Dual tone dash: 4px black, 4px white
  const period = 8;
  for (let y = 0; y < h; y++) {
    const yw = y * w;
    for (let x = 0; x < w; x++) {
      const bIdx = yw + x;
      if (boundary[bIdx]) {
        const patternPos = (x + y + dashOffset) % period;
        const isWhite = patternPos < 4;
        const pIdx = bIdx * 4;

        d[pIdx] = isWhite ? 255 : 0;
        d[pIdx + 1] = isWhite ? 255 : 0;
        d[pIdx + 2] = isWhite ? 255 : 0;
        d[pIdx + 3] = 255;
      }
    }
  }
  targetCtx.putImageData(imgData, 0, 0);
}

// ─── EDGE REFINEMENT (FEATHER, SMOOTH, SHIFT, CONTRAST) ───────────────────

/**
 * Applies morphological dilation/erosion and edge refinement on a mask canvas.
 */
export function applyRefineEdgeToMask(
  sourceMaskCanvas: HTMLCanvasElement,
  refine: RefineEdgeSettings
): HTMLCanvasElement {
  const { feather, smooth, shiftEdge, contrast } = refine;
  const width = sourceMaskCanvas.width;
  const height = sourceMaskCanvas.height;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d');
  if (!ctx) return sourceMaskCanvas;

  // 1. Draw base mask
  ctx.drawImage(sourceMaskCanvas, 0, 0);

  // 2. Smooth / Box Pre-filter
  if (smooth > 0) {
    ctx.filter = `blur(${smooth * 0.6}px)`;
    ctx.drawImage(resultCanvas, 0, 0);
    ctx.filter = 'none';
  }

  // 3. Shift Edge (Dilation / Erosion) & Contrast adjustments in pixel buffer
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  // Apply shift edge if specified (radius in pixels)
  if (shiftEdge !== 0) {
    const shiftRadius = Math.abs(shiftEdge);
    const isDilate = shiftEdge > 0;
    const tempBuffer = new Uint8Array(width * height);

    // Grayscale values
    for (let i = 0; i < width * height; i++) {
      tempBuffer[i] = data[i * 4];
    }

    const r = Math.min(15, Math.round(shiftRadius));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let extreme = isDilate ? 0 : 255;
        const yStart = Math.max(0, y - r);
        const yEnd = Math.min(height - 1, y + r);
        const xStart = Math.max(0, x - r);
        const xEnd = Math.min(width - 1, x + r);

        for (let ny = yStart; ny <= yEnd; ny++) {
          for (let nx = xStart; nx <= xEnd; nx++) {
            const v = tempBuffer[ny * width + nx];
            if (isDilate) {
              if (v > extreme) extreme = v;
            } else {
              if (v < extreme) extreme = v;
            }
          }
        }
        const idx = (y * width + x) * 4;
        data[idx] = extreme;
        data[idx + 1] = extreme;
        data[idx + 2] = extreme;
      }
    }
  }

  // 4. Contrast & Threshold adjustment
  if (contrast > 0) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < len; i += 4) {
      const v = data[i];
      const adjusted = Math.max(0, Math.min(255, Math.round(factor * (v - 128) + 128)));
      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 5. Feathering via Gaussian Blur
  if (feather > 0) {
    const featheredCanvas = document.createElement('canvas');
    featheredCanvas.width = width;
    featheredCanvas.height = height;
    const fCtx = featheredCanvas.getContext('2d');
    if (fCtx) {
      fCtx.filter = `blur(${feather}px)`;
      fCtx.drawImage(resultCanvas, 0, 0);
      fCtx.filter = 'none';
      return featheredCanvas;
    }
  }

  return resultCanvas;
}

/**
 * Inverts selection mask (white -> black, black -> white).
 */
export function invertMask(maskCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const inverted = document.createElement('canvas');
  inverted.width = maskCanvas.width;
  inverted.height = maskCanvas.height;

  const ctx = inverted.getContext('2d');
  if (!ctx) return maskCanvas;

  ctx.drawImage(maskCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return inverted;
}

/**
 * Creates a "Select All" mask covering entire canvas.
 */
export function createSelectAllMask(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

/**
 * Checks if distance between two 2D points is within a given threshold radius.
 */
export function isPointNearPoint(p1: Point2D, p2: Point2D, threshold: number): boolean {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= threshold;
}

/**
 * Legacy compatibility wrapper for rendering a single path with optional feather.
 */
export function renderLassoPathToMask(
  points: Point2D[],
  width: number,
  height: number,
  feather = 0
): HTMLCanvasElement {
  const base = renderPolygonToMask(points, width, height);
  if (feather > 0) {
    return applyRefineEdgeToMask(base, { ...DEFAULT_REFINE_SETTINGS, feather });
  }
  return base;
}
