/**
 * videoTools.ts - Client-side video tool functions for the Studio Toolbox.
 *
 * Built on Mediabunny (zero-dependency WebCodecs media toolkit, successor to
 * mp4-muxer) for trimming/compression, and gifenc (fast pure-JS GIF encoder)
 * for video-to-GIF synthesis. All processing runs inside the local browser
 * sandbox - no server round-trips, no telemetry.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  type ConversionOptions,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from 'mediabunny';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoInfo {
  /** Duration in seconds. */
  duration: number;
  /** Display width in pixels (0 when the file has no video track). */
  width: number;
  /** Display height in pixels (0 when the file has no video track). */
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface VideoToolResult {
  blob: Blob;
  /** Object URL for previewing/downloading the result. */
  url: string;
  size: number;
  mimeType: string;
  /** File extension without the dot (e.g. "mp4", "webm", "gif"). */
  extension: string;
}

/** Progress callback receiving a value between 0 and 1 (inclusive). */
export type ProgressFn = (progress: number) => void;

export type CompressionQuality = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

// ─── Shared utilities ─────────────────────────────────────────────────────────

/**
 * formatBytes - Renders a byte count as a human readable string (e.g. "2.4 MB").
 */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const decimals = exponent === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
};

/**
 * formatTimecode - Formats seconds as HH:MM:SS.mmm for display.
 */
export const formatTimecode = (seconds: number): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
};

/**
 * parseTimecode - Parses "12", "1:02", "1:02:03.500" or "01:02:03,500" into seconds.
 * Returns null when the input cannot be parsed.
 */
export const parseTimecode = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (match) {
    const hours = match[1] ? Number(match[1]) : 0;
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = match[4] ? Number(match[4].padEnd(3, '0')) : 0;
    if (minutes > 59 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return null;
};

/**
 * downloadBlob - Triggers a browser download for the given Blob.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * extensionFor - Maps an output MIME type to a file extension.
 */
const extensionFor = (mimeType: string): string => {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('gif')) return 'gif';
  return 'mp4';
};

/**
 * clamp - Clamps a number into the [min, max] range.
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// ─── Video inspection ─────────────────────────────────────────────────────────

/**
 * getVideoInfo - Reads duration, dimensions and track presence from a video file.
 */
export const getVideoInfo = async (file: File): Promise<VideoInfo> => {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();
  const audioTrack = await input.getPrimaryAudioTrack();
  let width = 0;
  let height = 0;
  if (videoTrack) {
    width = await videoTrack.getDisplayWidth();
    height = await videoTrack.getDisplayHeight();
  }
  if (!videoTrack && !audioTrack) {
    throw new Error('No playable video or audio track found in this file.');
  }
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width,
    height,
    hasVideo: !!videoTrack,
    hasAudio: !!audioTrack,
  };
};

// ─── Conversion engine ────────────────────────────────────────────────────────

/**
 * buildResult - Wraps a finished Output buffer into a VideoToolResult.
 */
const buildResult = async (output: Output): Promise<VideoToolResult> => {
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('The conversion produced no data. The source codec may be unsupported.');
  }
  const mimeType = output.format.mimeType;
  const blob = new Blob([buffer], { type: mimeType });
  return {
    blob,
    url: URL.createObjectURL(blob),
    size: blob.size,
    mimeType,
    extension: extensionFor(mimeType),
  };
};

/**
 * runConversion - Executes a Mediabunny conversion, trying MP4 first and
 * falling back to WebM when the browser cannot encode MP4-compatible codecs
 * (e.g. missing H.264/AAC encoders). Returns the encoded result.
 */
const runConversion = async (
  file: File,
  makeOptions: (input: Input, output: Output) => ConversionOptions,
  onProgress?: ProgressFn,
): Promise<VideoToolResult> => {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const formats = [new Mp4OutputFormat(), new WebMOutputFormat()];

  for (const format of formats) {
    const output = new Output({ format, target: new BufferTarget() });
    const conversion = await Conversion.init(makeOptions(input, output));
    const unusable =
      !conversion.isValid ||
      conversion.discardedTracks.some(t => t.reason === 'no_encodable_target_codec');
    if (unusable) continue;

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();
    return buildResult(output);
  }

  throw new Error(
    'This browser could not encode the video (no supported output codec found).',
  );
};

// ─── Trim ─────────────────────────────────────────────────────────────────────

/**
 * trimVideoFile - Extracts the [start, end] range of a video into a new file.
 * Copies media data when possible, re-encoding only when required.
 */
export const trimVideoFile = async (options: {
  file: File;
  start: number;
  end: number;
  onProgress?: ProgressFn;
}): Promise<VideoToolResult> => {
  const { file, start, end, onProgress } = options;
  const info = await getVideoInfo(file);
  const trimStart = clamp(start, 0, info.duration);
  const trimEnd = clamp(end, 0, info.duration);
  if (!(trimEnd > trimStart)) {
    throw new Error('End time must be greater than start time.');
  }

  return runConversion(
    file,
    (input, output) => ({
      input,
      output,
      tracks: 'primary',
      trim: { start: trimStart, end: trimEnd },
    }),
    onProgress,
  );
};

// ─── Compress ─────────────────────────────────────────────────────────────────

/**
 * compressVideoFile - Re-encodes a video at a lower quality, optionally
 * capping the output height, to reduce its file size.
 */
export const compressVideoFile = async (options: {
  file: File;
  quality: CompressionQuality;
  /** Maximum output height in pixels; omitted/0 keeps the original size. */
  maxHeight?: number;
  onProgress?: ProgressFn;
}): Promise<VideoToolResult> => {
  const { file, quality, maxHeight, onProgress } = options;
  const info = await getVideoInfo(file);
  const cap = maxHeight && maxHeight > 0 ? maxHeight : 0;
  const shouldResize = cap > 0 && info.height > cap;

  return runConversion(
    file,
    (input, output) => ({
      input,
      output,
      tracks: 'primary',
      video: {
        quality: new Quality(quality),
        ...(shouldResize ? { height: cap } : {}),
      },
    }),
    onProgress,
  );
};

// ─── Video to GIF ─────────────────────────────────────────────────────────────

/** Hard cap on decoded frames to keep memory and encode time reasonable. */
export const GIF_MAX_FRAMES = 900;

/**
 * estimateGifFrameCount - Returns how many frames a GIF conversion would decode.
 */
export const estimateGifFrameCount = (duration: number, fps: number): number => {
  if (!(duration > 0) || !(fps > 0)) return 0;
  return Math.max(1, Math.ceil(duration * fps));
};

/**
 * videoToGif - Decodes video frames through Mediabunny's WebCodecs pipeline and
 * encodes them into an animated GIF with gifenc.
 */
export const videoToGif = async (options: {
  file: File;
  /** Output frames per second (1-50). */
  fps: number;
  /** Maximum output width in pixels. */
  maxWidth: number;
  /** Optional trim start in seconds (defaults to 0). */
  start?: number;
  /** Optional trim end in seconds (defaults to the video duration). */
  end?: number;
  onProgress?: ProgressFn;
}): Promise<VideoToolResult> => {
  const { file, fps, maxWidth, onProgress } = options;
  const info = await getVideoInfo(file);
  if (!info.hasVideo) throw new Error('This file has no video track to convert.');

  const start = clamp(options.start ?? 0, 0, info.duration);
  const end = clamp(options.end ?? info.duration, 0, info.duration);
  if (!(end > start)) throw new Error('End time must be greater than start time.');
  if (!(fps >= 1 && fps <= 50)) throw new Error('FPS must be between 1 and 50.');

  const frameCount = estimateGifFrameCount(end - start, fps);
  if (frameCount > GIF_MAX_FRAMES) {
    throw new Error(
      `Too many frames (${frameCount}). Select a shorter range or lower FPS (max ${GIF_MAX_FRAMES} frames).`,
    );
  }

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error('This file has no video track to convert.');
  if (!(await videoTrack.canDecode())) {
    throw new Error('This browser cannot decode the video (WebCodecs unavailable).');
  }

  // Output canvas size, preserving aspect ratio.
  const outWidth = Math.max(16, Math.min(Math.round(maxWidth), info.width || Math.round(maxWidth)));
  const outHeight = Math.max(
    16,
    Math.round((info.height / Math.max(info.width, 1)) * outWidth) || outWidth,
  );

  const sink = new CanvasSink(videoTrack, { width: outWidth, height: outHeight });
  const timestamps = Array.from(
    { length: frameCount },
    (_, i) => start + i / fps,
  );

  const workCanvas = document.createElement('canvas');
  workCanvas.width = outWidth;
  workCanvas.height = outHeight;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  let framesWritten = 0;

  for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
    if (!wrapped) continue;
    ctx.drawImage(wrapped.canvas, 0, 0, outWidth, outHeight);
    const { data } = ctx.getImageData(0, 0, outWidth, outHeight);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, outWidth, outHeight, { palette, delay });
    framesWritten++;
    onProgress?.(Math.min(1, framesWritten / frameCount));
  }

  if (framesWritten === 0) {
    throw new Error('No frames could be decoded from the selected range.');
  }

  gif.finish();
  const bytes: Uint8Array = gif.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });
  return {
    blob,
    url: URL.createObjectURL(blob),
    size: blob.size,
    mimeType: 'image/gif',
    extension: 'gif',
  };
};
