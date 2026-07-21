/**
 * webcodecsExporter.ts — Hardware-Accelerated Client-Side WebCodecs Video Exporter.
 * Pipes GPU WebGL frames directly into the browser's native H.264 VideoEncoder.
 */

export interface WebCodecsExportOptions {
  width: number;
  height: number;
  fps: number;
  duration: number; // in seconds
  quality: 'low' | 'medium' | 'high';
  renderFrameAtTime: (timeSec: number) => Promise<HTMLCanvasElement | void> | HTMLCanvasElement | void;
  onProgress: (percent: number, currentFrame: number, totalFrames: number) => void;
}

/**
 * Check if WebCodecs API (VideoEncoder, VideoFrame) is supported in current environment.
 */
export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

/**
 * Export video timeline to a local MP4/WebM video Blob using GPU Hardware Acceleration.
 */
export async function exportVideoWithWebCodecs(options: WebCodecsExportOptions): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser environment.');
  }

  const { width, height, fps, duration, quality, renderFrameAtTime, onProgress } = options;

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const bitrate = quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000;

  const chunkBuffers: ArrayBuffer[] = [];
  let encoderError: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk) => {
      const buf = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(buf);
      chunkBuffers.push(buf);
    },
    error: (e) => {
      console.error('VideoEncoder error:', e);
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  // H.264 AVC Baseline profile codec string
  const codec = 'avc1.42E01E';

  await encoder.configure({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
  });

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (encoderError) {
      throw encoderError;
    }

    const tSec = frameIdx / fps;
    const sourceCanvas = await renderFrameAtTime(tSec);

    if (exportCtx && sourceCanvas) {
      exportCtx.drawImage(sourceCanvas, 0, 0, width, height);
    }

    const timestampMicros = Math.round(tSec * 1_000_000);
    const videoFrame = new VideoFrame(exportCanvas, { timestamp: timestampMicros });
    const isKeyframe = frameIdx % Math.round(fps * 2) === 0;

    encoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    const percent = Math.round(((frameIdx + 1) / totalFrames) * 100);
    onProgress(percent, frameIdx + 1, totalFrames);

    // Yield main thread briefly every 10 frames to keep UI responsive
    if (frameIdx % 10 === 0) {
      await new Promise((r) => setTimeout(r, 4));
    }
  }

  await encoder.flush();
  encoder.close();

  return new Blob(chunkBuffers, { type: 'video/mp4' });
}
