/**
 * Ambient type declarations for gifenc, which ships without TypeScript types.
 * Signatures mirror gifenc@1.0.3 (src/index.js, src/palettize.js).
 */
declare module 'gifenc' {
  /** Color table: array of [r, g, b] or [r, g, b, a] tuples. */
  export type GifPalette = number[][];

  export type GifPaletteFormat = 'rgb565' | 'rgb444' | 'rgba4444';

  export interface GifEncoderOptions {
    /** Write header/global palette lazily on the first frame. Default true. */
    auto?: boolean;
    /** Initial internal buffer size in bytes. Default 4096. */
    initialCapacity?: number;
  }

  export interface GifWriteFrameOptions {
    palette?: GifPalette;
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    /** Frame delay in milliseconds. */
    delay?: number;
    /** -1 = once, 0 = forever, n = repetition count. */
    repeat?: number;
    dispose?: number;
  }

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifWriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    writeHeader(): void;
    reset(): void;
    buffer: ArrayBuffer;
  }

  export function GIFEncoder(options?: GifEncoderOptions): GifEncoderInstance;

  export interface QuantizeOptions {
    format?: GifPaletteFormat;
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifPaletteFormat,
  ): Uint8Array;

  export default typeof GIFEncoder;
}
