/**
 * WebGLLiquifyRenderer.ts
 * WebGL-accelerated mesh deformation renderer.
 */
import { MeshGrid } from './MeshGrid';

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

  public setSourceImage(image: HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl;
    if (!gl || !this.texture) return;
    if (!image) return;

    if (image instanceof HTMLImageElement && (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)) {
      return;
    }
    if (image instanceof HTMLCanvasElement && (image.width === 0 || image.height === 0)) {
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  public render(mesh: MeshGrid): void {
    const gl = this.gl;
    if (!gl || !this.isInitialized || !this.program) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.currentVertices, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.origVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

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
