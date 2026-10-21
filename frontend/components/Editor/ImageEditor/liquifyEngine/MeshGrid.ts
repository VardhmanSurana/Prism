/**
 * MeshGrid.ts
 * 2D triangulated mesh grid for real-time pixel displacement.
 */
import { FaceLiquifySettings, LiquifyToolMode } from './types';

export class MeshGrid {
  public cols: number;
  public rows: number;
  public origVertices: Float32Array;
  public currentVertices: Float32Array;
  public indices: Uint16Array;

  constructor(cols = 64, rows = 64) {
    this.cols = cols;
    this.rows = rows;

    const numVerts = (cols + 1) * (rows + 1);
    this.origVertices = new Float32Array(numVerts * 2);
    this.currentVertices = new Float32Array(numVerts * 2);

    let vIdx = 0;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        this.origVertices[vIdx * 2] = u;
        this.origVertices[vIdx * 2 + 1] = v;
        this.currentVertices[vIdx * 2] = u;
        this.currentVertices[vIdx * 2 + 1] = v;
        vIdx++;
      }
    }

    const numTriangles = cols * rows * 2;
    this.indices = new Uint16Array(numTriangles * 3);
    let iIdx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const topLeft = r * (cols + 1) + c;
        const topRight = topLeft + 1;
        const bottomLeft = (r + 1) * (cols + 1) + c;
        const bottomRight = bottomLeft + 1;

        this.indices[iIdx++] = topLeft;
        this.indices[iIdx++] = bottomLeft;
        this.indices[iIdx++] = topRight;

        this.indices[iIdx++] = topRight;
        this.indices[iIdx++] = bottomLeft;
        this.indices[iIdx++] = bottomRight;
      }
    }
  }

  public reset(): void {
    this.currentVertices.set(this.origVertices);
  }

  public hasModifications(): boolean {
    const len = this.currentVertices.length;
    for (let i = 0; i < len; i++) {
      if (Math.abs(this.currentVertices[i] - this.origVertices[i]) > 0.0001) {
        return true;
      }
    }
    return false;
  }

  public clone(): MeshGrid {
    const copy = new MeshGrid(this.cols, this.rows);
    copy.currentVertices.set(this.currentVertices);
    return copy;
  }

  public copyFrom(other: MeshGrid): void {
    if (this.currentVertices.length === other.currentVertices.length) {
      this.currentVertices.set(other.currentVertices);
    }
  }

  public applyBrush(
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    radius: number,
    pressure: number,
    mode: LiquifyToolMode,
    aspect = 1.0,
  ): void {
    if (radius <= 0) return;

    const strength = (pressure / 100) * 0.75;
    const rSq = radius * radius;
    const numVerts = (this.cols + 1) * (this.rows + 1);

    const minU = Math.max(0, cx - radius * (aspect > 1 ? 1 : aspect));
    const maxU = Math.min(1, cx + radius * (aspect > 1 ? 1 : aspect));
    const minV = Math.max(0, cy - radius * (aspect < 1 ? 1 : 1 / aspect));
    const maxV = Math.min(1, cy + radius * (aspect < 1 ? 1 : 1 / aspect));

    const minC = Math.floor(minU * this.cols);
    const maxC = Math.ceil(maxU * this.cols);
    const minR = Math.floor(minV * this.rows);
    const maxR = Math.ceil(maxV * this.rows);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const idx = r * (this.cols + 1) + c;
        if (idx >= numVerts) continue;

        const vx = this.currentVertices[idx * 2];
        const vy = this.currentVertices[idx * 2 + 1];

        const diffX = (vx - cx) * aspect;
        const diffY = vy - cy;
        const distSq = diffX * diffX + diffY * diffY;

        if (distSq < rSq) {
          const normDist = Math.sqrt(distSq) / radius;
          const falloff = Math.pow(1 - normDist * normDist, 2) * strength;

          switch (mode) {
            case 'warp': {
              this.currentVertices[idx * 2] = vx + dx * falloff;
              this.currentVertices[idx * 2 + 1] = vy + dy * falloff;
              break;
            }

            case 'pucker': {
              this.currentVertices[idx * 2] = vx + (cx - vx) * falloff * 0.4;
              this.currentVertices[idx * 2 + 1] = vy + (cy - vy) * falloff * 0.4;
              break;
            }

            case 'bloat': {
              this.currentVertices[idx * 2] = vx - (cx - vx) * falloff * 0.4;
              this.currentVertices[idx * 2 + 1] = vy - (cy - vy) * falloff * 0.4;
              break;
            }

            case 'reconstruct': {
              const ox = this.origVertices[idx * 2];
              const oy = this.origVertices[idx * 2 + 1];
              this.currentVertices[idx * 2] = vx + (ox - vx) * falloff * 0.8;
              this.currentVertices[idx * 2 + 1] = vy + (oy - vy) * falloff * 0.8;
              break;
            }

            case 'smooth': {
              let sumDx = 0;
              let sumDy = 0;
              let count = 0;

              const neighbors = [
                r > 0 ? (r - 1) * (this.cols + 1) + c : -1,
                r < this.rows ? (r + 1) * (this.cols + 1) + c : -1,
                c > 0 ? r * (this.cols + 1) + (c - 1) : -1,
                c < this.cols ? r * (this.cols + 1) + (c + 1) : -1,
              ];

              for (const n of neighbors) {
                if (n >= 0) {
                  sumDx += this.currentVertices[n * 2] - this.origVertices[n * 2];
                  sumDy += this.currentVertices[n * 2 + 1] - this.origVertices[n * 2 + 1];
                  count++;
                }
              }

              if (count > 0) {
                const avgDx = sumDx / count;
                const avgDy = sumDy / count;
                const curDx = vx - this.origVertices[idx * 2];
                const curDy = vy - this.origVertices[idx * 2 + 1];

                this.currentVertices[idx * 2] = this.origVertices[idx * 2] + curDx + (avgDx - curDx) * falloff * 0.5;
                this.currentVertices[idx * 2 + 1] = this.origVertices[idx * 2 + 1] + curDy + (avgDy - curDy) * falloff * 0.5;
              }
              break;
            }
          }
        }
      }
    }
  }

  public applyFaceReshape(
    faceBox: { x: number; y: number; width: number; height: number },
    faceSettings: FaceLiquifySettings,
    baseMesh?: MeshGrid,
    aspect = 1.0,
  ): void {
    if (baseMesh) {
      this.currentVertices.set(baseMesh.currentVertices);
    } else {
      this.currentVertices.set(this.origVertices);
    }

    const { eyeSize, eyeDistance, noseWidth, lipHeight, chinShape } = faceSettings;
    if (eyeSize === 0 && eyeDistance === 0 && noseWidth === 0 && lipHeight === 0 && chinShape === 0) {
      return;
    }

    const bx = faceBox.x;
    const by = faceBox.y;
    const bw = faceBox.width;
    const bh = faceBox.height;

    const leftEye = { x: bx + bw * 0.375, y: by + bh * 0.435 };
    const rightEye = { x: bx + bw * 0.695, y: by + bh * 0.435 };
    const nose = { x: bx + bw * 0.50, y: by + bh * 0.61 };
    const mouth = { x: bx + bw * 0.51, y: by + bh * 0.78 };
    const chin = { x: bx + bw * 0.50, y: by + bh * 0.96 };
    const leftJaw = { x: bx + bw * 0.22, y: by + bh * 0.82 };
    const rightJaw = { x: bx + bw * 0.78, y: by + bh * 0.82 };

    const eyeRadius = Math.min(bw, bh) * 0.24;
    const noseRadius = Math.min(bw, bh) * 0.20;
    const mouthRadius = Math.min(bw, bh) * 0.26;
    const jawRadius = Math.min(bw, bh) * 0.32;

    const numVerts = (this.cols + 1) * (this.rows + 1);

    for (let i = 0; i < numVerts; i++) {
      const vx = this.currentVertices[i * 2];
      const vy = this.currentVertices[i * 2 + 1];

      let deltaX = 0;
      let deltaY = 0;

      if (eyeSize !== 0) {
        const factor = (eyeSize / 100) * 0.35;
        const dLx = (vx - leftEye.x) * aspect;
        const dLy = vy - leftEye.y;
        const distL = Math.hypot(dLx, dLy);
        if (distL < eyeRadius) {
          const norm = distL / eyeRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += (vx - leftEye.x) * w;
          deltaY += (vy - leftEye.y) * w;
        }

        const dRx = (vx - rightEye.x) * aspect;
        const dRy = vy - rightEye.y;
        const distR = Math.hypot(dRx, dRy);
        if (distR < eyeRadius) {
          const norm = distR / eyeRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += (vx - rightEye.x) * w;
          deltaY += (vy - rightEye.y) * w;
        }
      }

      if (eyeDistance !== 0) {
        const shift = (eyeDistance / 100) * 0.045 * bw;
        const eyeZoneRadius = eyeRadius * 1.6;

        const dLx = (vx - leftEye.x) * aspect;
        const dLy = vy - leftEye.y;
        const distL = Math.hypot(dLx, dLy);
        if (distL < eyeZoneRadius) {
          const norm = distL / eyeZoneRadius;
          const w = Math.pow(1 - norm * norm, 2);
          deltaX -= shift * w;
        }

        const dRx = (vx - rightEye.x) * aspect;
        const dRy = vy - rightEye.y;
        const distR = Math.hypot(dRx, dRy);
        if (distR < eyeZoneRadius) {
          const norm = distR / eyeZoneRadius;
          const w = Math.pow(1 - norm * norm, 2);
          deltaX += shift * w;
        }
      }

      if (noseWidth !== 0) {
        const factor = (noseWidth / 100) * 0.35;
        const dNx = (vx - nose.x) * aspect;
        const dNy = vy - nose.y;
        const distN = Math.hypot(dNx, dNy);
        if (distN < noseRadius) {
          const norm = distN / noseRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += (vx - nose.x) * w;
        }
      }

      if (lipHeight !== 0) {
        const factor = (lipHeight / 100) * 0.35;
        const dMx = (vx - mouth.x) * aspect;
        const dMy = vy - mouth.y;
        const distM = Math.hypot(dMx, dMy);
        if (distM < mouthRadius) {
          const norm = distM / mouthRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaY += (vy - mouth.y) * w;
        }
      }

      if (chinShape !== 0) {
        const factor = (chinShape / 100) * 0.40;

        const dJLx = (vx - leftJaw.x) * aspect;
        const dJLy = vy - leftJaw.y;
        const distJL = Math.hypot(dJLx, dJLy);
        if (distJL < jawRadius) {
          const norm = distJL / jawRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += bw * 0.05 * w;
        }

        const dJRx = (vx - rightJaw.x) * aspect;
        const dJRy = vy - rightJaw.y;
        const distJR = Math.hypot(dJRx, dJRy);
        if (distJR < jawRadius) {
          const norm = distJR / jawRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX -= bw * 0.05 * w;
        }

        const dCx = (vx - chin.x) * aspect;
        const dCy = vy - chin.y;
        const distC = Math.hypot(dCx, dCy);
        if (distC < jawRadius) {
          const norm = distC / jawRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX -= (vx - chin.x) * w * 0.5;
          deltaY -= bh * 0.03 * w;
        }
      }

      this.currentVertices[i * 2] = vx + deltaX;
      this.currentVertices[i * 2 + 1] = vy + deltaY;
    }
  }
}
