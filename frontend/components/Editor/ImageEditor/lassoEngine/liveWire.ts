/**
 * liveWire.ts
 * Intelligent Scissors: Sobel-gradient cost map + Dijkstra shortest-path search.
 */
import { LiveWireCostMap, Point2D } from './types';

export function buildLiveWireCostMap(imgData: ImageData, maxDim = 480): LiveWireCostMap {
  const origW = imgData.width;
  const origH = imgData.height;

  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  const w = Math.max(16, Math.round(origW * scale));
  const h = Math.max(16, Math.round(origH * scale));

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
      const gx =
        -lum[yPrev + (x - 1)] + lum[yPrev + (x + 1)]
        - 2 * lum[yw + (x - 1)] + 2 * lum[yw + (x + 1)]
        - lum[yNext + (x - 1)] + lum[yNext + (x + 1)];

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

  // 3. Cost: high gradient = lowest cost
  const cost = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const normMag = gradMag[i] / maxMag;
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

export function findIntelligentScissorsPath(
  costMap: LiveWireCostMap,
  startOrig: Point2D,
  endOrig: Point2D,
): Point2D[] {
  const { width: w, height: h, scaleX, scaleY, cost } = costMap;

  const sx = Math.max(0, Math.min(w - 1, Math.round(startOrig.x / scaleX)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(startOrig.y / scaleY)));
  const ex = Math.max(0, Math.min(w - 1, Math.round(endOrig.x / scaleX)));
  const ey = Math.max(0, Math.min(h - 1, Math.round(endOrig.y / scaleY)));

  if (sx === ex && sy === ey) {
    return [startOrig, endOrig];
  }

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

      const linkCost = cost[nIdx] * stepCost;
      const newDist = dist[curr] + linkCost;

      if (newDist < dist[nIdx]) {
        dist[nIdx] = newDist;
        parent[nIdx] = curr;
        pushHeap(nIdx, newDist);
      }
    }
  }

  const path: Point2D[] = [];
  let curr = targetIdx;

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

  if (path.length > 0) {
    path[0] = { ...startOrig };
    path[path.length - 1] = { ...endOrig };
  } else {
    return [startOrig, endOrig];
  }

  return path;
}
