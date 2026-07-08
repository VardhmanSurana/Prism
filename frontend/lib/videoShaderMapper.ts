import type { ClipEffects, ClipTransform } from '@/types/nle';

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform mat3 u_matrix;
  void main() {
    vec3 pos = u_matrix * vec3(a_position, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_temperature;
  uniform float u_highlights;
  uniform float u_shadows;
  uniform float u_vignette;
  uniform float u_opacity;

  vec3 adjustTemperature(vec3 color, float temp) {
    // temp range -100 to 100.
    // Positive temp -> warm (more yellow/red). Negative temp -> cool (more blue).
    color.r += temp * 0.003;
    color.b -= temp * 0.003;
    return clamp(color, 0.0, 1.0);
  }

  void main() {
    vec4 texColor = texture2D(u_image, v_texCoord);
    vec3 color = texColor.rgb;

    // Brightness & Highlights
    float b = 1.0 + u_brightness / 100.0 + (u_highlights / 200.0);
    color *= b;

    // Contrast & Shadows
    float c = 1.0 + u_contrast / 100.0 + (u_shadows / 200.0);
    color = (color - 0.5) * c + 0.5;

    // Saturation
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    float s = 1.0 + u_saturation / 100.0;
    color = mix(vec3(luma), color, s);

    // Temperature
    if (u_temperature != 0.0) {
      color = adjustTemperature(color, u_temperature);
    }

    // Vignette
    if (u_vignette > 0.0) {
      vec2 uv = v_texCoord - 0.5;
      float dist = length(uv);
      float vignetteVal = smoothstep(0.8, 0.8 - (u_vignette / 100.0) * 0.5, dist);
      color *= vignetteVal;
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a * u_opacity);
  }
`;

export class WebGLVideoRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;
    this.program = this.initShaderProgram(VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);
    this.initBuffers();
    this.initTexture();
  }

  private initShaderProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  private loadShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('An error occurred compiling the shaders: ' + info);
    }
    return shader;
  }

  private initBuffers() {
    const gl = this.gl;

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    const texCoords = [
      0.0, 1.0,
      1.0, 1.0,
      0.0, 0.0,
      0.0, 0.0,
      1.0, 1.0,
      1.0, 0.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  }

  private initTexture() {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  public render(
    source: HTMLVideoElement | VideoFrame,
    effects: ClipEffects,
    transform: ClipTransform,
    canvasWidth: number,
    canvasHeight: number
  ) {
    const gl = this.gl;

    gl.viewport(0, 0, canvasWidth, canvasHeight);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    const posLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    const texLocation = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(texLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(texLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return;
    }

    gl.uniform1f(gl.getUniformLocation(this.program, 'u_brightness'), effects.brightness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_contrast'), effects.contrast);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_saturation'), effects.saturation);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_temperature'), effects.temperature);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_highlights'), effects.highlights);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_shadows'), effects.shadows);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_vignette'), effects.vignette);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_opacity'), transform.opacity);

    const matrix = this.buildTransformMatrix(transform, canvasWidth, canvasHeight);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public clear() {
    const gl = this.gl;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private buildTransformMatrix(transform: ClipTransform, width: number, height: number): Float32Array {
    const tx = (2.0 * transform.x) / width;
    const ty = (-2.0 * transform.y) / height;

    const angleRad = (transform.rotation * Math.PI) / 180.0;
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);

    const sx = transform.scaleX;
    const sy = transform.scaleY;

    return new Float32Array([
      sx * c,  sx * s,  0,
     -sy * s,  sy * c,  0,
      tx,      ty,      1
    ]);
  }

  public destroy() {
    const gl = this.gl;
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.program) gl.deleteProgram(this.program);
  }
}
