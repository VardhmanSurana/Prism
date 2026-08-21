/**
 * liquifyEngine.ts
 * High-performance 2D Mesh Displacement, Forward Warp, Pucker, Bloat,
 * Smooth, Restore, and Face-Aware Reshaping Engine with WebGL acceleration.
 */

export type LiquifyToolMode = 'warp' | 'pucker' | 'bloat' | 'smooth' | 'reconstruct';

export interface FaceLiquifySettings {
  eyeSize: number; // -100 -> 100
  eyeDistance: number; // -100 -> 100
  noseWidth: number; // -100 -> 100
  lipHeight: number; // -100 -> 100
  chinShape: number; // -100 -> 100
}

export interface LiquifySettings {
  mode: LiquifyToolMode;
  brushSize: number;
  pressure: number;
  face: FaceLiquifySettings;
}

export const DEFAULT_LIQUIFY_SETTINGS: LiquifySettings = {
  mode: 'warp',
  brushSize: 80,
  pressure: 50,
  face: {
    eyeSize: 0,
    eyeDistance: 0,
    noseWidth: 0,
    lipHeight: 0,
    chinShape: 0,
  },
};

/**
 * 2D Triangulated Mesh Grid for real-time pixel displacement.
 */
export class MeshGrid {
  public cols: number;
  public rows: number;
  public origVertices: Float32Array; // Original normalized UV coordinates [0..1]
  public currentVertices: Float32Array; // Current deformed coordinates [0..1]
  public indices: Uint16Array; // Triangle indices

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

    // Build triangular element index buffer
    const numTriangles = cols * rows * 2;
    this.indices = new Uint16Array(numTriangles * 3);
    let iIdx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const topLeft = r * (cols + 1) + c;
        const topRight = topLeft + 1;
        const bottomLeft = (r + 1) * (cols + 1) + c;
        const bottomRight = bottomLeft + 1;

        // First triangle: topLeft -> bottomLeft -> topRight
        this.indices[iIdx++] = topLeft;
        this.indices[iIdx++] = bottomLeft;
        this.indices[iIdx++] = topRight;

        // Second triangle: topRight -> bottomLeft -> bottomRight
        this.indices[iIdx++] = topRight;
        this.indices[iIdx++] = bottomLeft;
        this.indices[iIdx++] = bottomRight;
      }
    }
  }

  /**
   * Reset all mesh vertices to initial undeformed positions.
   */
  public reset(): void {
    this.currentVertices.set(this.origVertices);
  }

  /**
   * Check if the mesh has any active deformation.
   */
  public hasModifications(): boolean {
    const len = this.currentVertices.length;
    for (let i = 0; i < len; i++) {
      if (Math.abs(this.currentVertices[i] - this.origVertices[i]) > 0.0001) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clone the current mesh grid state.
   */
  public clone(): MeshGrid {
    const copy = new MeshGrid(this.cols, this.rows);
    copy.currentVertices.set(this.currentVertices);
    return copy;
  }

  /**
   * Copy vertex data from another MeshGrid.
   */
  public copyFrom(other: MeshGrid): void {
    if (this.currentVertices.length === other.currentVertices.length) {
      this.currentVertices.set(other.currentVertices);
    }
  }

  /**
   * Apply interactive brush deformation (Warp, Pucker, Bloat, Smooth, Reconstruct).
   *
   * @param cx Normalized X center [0..1]
   * @param cy Normalized Y center [0..1]
   * @param dx Normalized drag delta X
   * @param dy Normalized drag delta Y
   * @param radius Normalized brush radius [0..1]
   * @param pressure Warp pressure [1..100]
   * @param mode Tool mode
   * @param aspect Aspect ratio (width / height) to maintain circular brush
   */
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

    // Compute bounding box of brush in grid index space for fast iteration
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

        // Aspect-corrected Euclidean distance from brush center
        const diffX = (vx - cx) * aspect;
        const diffY = vy - cy;
        const distSq = diffX * diffX + diffY * diffY;

        if (distSq < rSq) {
          const normDist = Math.sqrt(distSq) / radius;
          // Smooth Hermite cubic cosine falloff
          const falloff = Math.pow(1 - normDist * normDist, 2) * strength;

          switch (mode) {
            case 'warp': {
              this.currentVertices[idx * 2] = vx + dx * falloff;
              this.currentVertices[idx * 2 + 1] = vy + dy * falloff;
              break;
            }

            case 'pucker': {
              // Pinch/contract towards center
              this.currentVertices[idx * 2] = vx + (cx - vx) * falloff * 0.4;
              this.currentVertices[idx * 2 + 1] = vy + (cy - vy) * falloff * 0.4;
              break;
            }

            case 'bloat': {
              // Expand outward from center
              this.currentVertices[idx * 2] = vx - (cx - vx) * falloff * 0.4;
              this.currentVertices[idx * 2 + 1] = vy - (cy - vy) * falloff * 0.4;
              break;
            }

            case 'reconstruct': {
              // Blend back toward original base coordinates
              const ox = this.origVertices[idx * 2];
              const oy = this.origVertices[idx * 2 + 1];
              this.currentVertices[idx * 2] = vx + (ox - vx) * falloff * 0.8;
              this.currentVertices[idx * 2 + 1] = vy + (oy - vy) * falloff * 0.8;
              break;
            }

            case 'smooth': {
              // Average surrounding neighbor offsets
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

  /**
   * Apply Production-Grade Face-Aware Parametric Reshaping.
   *
   * @param faceBox Normalized face bounding box [x, y, w, h] in [0..1]
   * @param faceSettings Slider values (-100 to 100)
   * @param baseMesh Base undeformed mesh state
   * @param aspect Canvas aspect ratio (width / height)
   */
  public applyFaceReshape(
    faceBox: { x: number; y: number; width: number; height: number },
    faceSettings: FaceLiquifySettings,
    baseMesh?: MeshGrid,
    aspect = 1.0,
  ): void {
    // Reset to base mesh state before applying face parametric changes
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

    // High-precision anatomical face anchor points
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

      // 1. Eye Size (Bloat / Pucker)
      if (eyeSize !== 0) {
        const factor = (eyeSize / 100) * 0.35;
        // Left Eye
        const dLx = (vx - leftEye.x) * aspect;
        const dLy = vy - leftEye.y;
        const distL = Math.hypot(dLx, dLy);
        if (distL < eyeRadius) {
          const norm = distL / eyeRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += (vx - leftEye.x) * w;
          deltaY += (vy - leftEye.y) * w;
        }

        // Right Eye
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

      // 2. Eye Distance (Interpupillary Shift)
      if (eyeDistance !== 0) {
        const shift = (eyeDistance / 100) * 0.045 * bw;
        const eyeZoneRadius = eyeRadius * 1.6;

        // Left eye moves outward/inward
        const dLx = (vx - leftEye.x) * aspect;
        const dLy = vy - leftEye.y;
        const distL = Math.hypot(dLx, dLy);
        if (distL < eyeZoneRadius) {
          const norm = distL / eyeZoneRadius;
          const w = Math.pow(1 - norm * norm, 2);
          deltaX -= shift * w;
        }

        // Right eye moves outward/inward
        const dRx = (vx - rightEye.x) * aspect;
        const dRy = vy - rightEye.y;
        const distR = Math.hypot(dRx, dRy);
        if (distR < eyeZoneRadius) {
          const norm = distR / eyeZoneRadius;
          const w = Math.pow(1 - norm * norm, 2);
          deltaX += shift * w;
        }
      }

      // 3. Nose Width (Alar bridge narrowing / widening)
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

      // 4. Lip Height (Vertical mouth scaling & smile volume)
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

      // 5. Chin Shape & Jawline Slimming (V-Line taper)
      if (chinShape !== 0) {
        const factor = (chinShape / 100) * 0.40;

        // Left Jaw inwards
        const dJLx = (vx - leftJaw.x) * aspect;
        const dJLy = vy - leftJaw.y;
        const distJL = Math.hypot(dJLx, dJLy);
        if (distJL < jawRadius) {
          const norm = distJL / jawRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX += bw * 0.05 * w;
        }

        // Right Jaw inwards
        const dJRx = (vx - rightJaw.x) * aspect;
        const dJRy = vy - rightJaw.y;
        const distJR = Math.hypot(dJRx, dJRy);
        if (distJR < jawRadius) {
          const norm = distJR / jawRadius;
          const w = Math.pow(1 - norm * norm, 2) * factor;
          deltaX -= bw * 0.05 * w;
        }

        // Chin Tip lift/narrowing
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

/**
 * WebGL-accelerated mesh deformation renderer.
 */
export class WebGLLiquifyRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private isInitialized = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initGL();
  }

  private initGL(): void {
    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      console.warn('[LiquifyRenderer] WebGL not supported, will use 2D fallback');
      return;
    }

    this.gl = gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        vec2 clipSpace = vec2(a_position.x * 2.0 - 1.0, (1.0 - a_position.y) * 2.0 - 1.0);
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[LiquifyRenderer] Program linking failed:', gl.getProgramInfoLog(program));
      return;
    }

    this.program = program;
    this.positionBuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.texture = gl.createTexture();
    this.isInitialized = true;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;

    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[LiquifyRenderer] Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Upload source image into GPU texture memory.
   */
  public setSourceImage(image: HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl;
    if (!gl || !this.texture) return;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  /**
   * Render deformed mesh grid onto the canvas.
   */
  public render(mesh: MeshGrid): void {
    const gl = this.gl;
    if (!gl || !this.isInitialized || !this.program) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Positions (Current deformed mesh vertices)
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.currentVertices, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture UVs (Original mesh vertices)
    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.origVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    // Draw Triangles
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  public destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.program) gl.deleteProgram(this.program);
    this.isInitialized = false;
  }
}
