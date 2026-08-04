/**
 * VideoFrameDecoder - Wraps HTMLVideoElement seek actions to yield WebCodecs VideoFrame objects.
 * This provides high-performance, frame-accurate decoding for scrubbing.
 */
export class VideoFrameDecoder {
  private video: HTMLVideoElement;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  // Seeking concurrency control
  private isSeeking = false;
  private pendingSeek: { time: number; resolve: (frame: VideoFrame | null) => void } | null = null;

  constructor(src: string) {
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.src = src;
    this.video.preload = 'auto';
    this.video.muted = true;
    this.video.playsInline = true;
    
    // Attempt to force hardware decoding if supported
    this.video.setAttribute('decoding', 'async');
  }

  private ensureLoaded(): Promise<void> {
    if (this.isLoaded) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      if (this.video.readyState >= 1) {
        this.isLoaded = true;
        resolve();
      } else {
        this.video.addEventListener('loadedmetadata', () => {
          this.isLoaded = true;
          resolve();
        }, { once: true });
      }
    });

    return this.loadPromise;
  }

  /**
   * Seeks to a timestamp (in seconds) and returns a WebCodecs VideoFrame.
   * Callers are responsible for calling .close() on the returned VideoFrame to release GPU memory.
   */
  public async getFrame(time: number): Promise<VideoFrame | null> {
    await this.ensureLoaded();

    if (this.isSeeking) {
      // Overwrite any previous pending seek request and resolve it with null
      if (this.pendingSeek) {
        this.pendingSeek.resolve(null);
      }
      return new Promise<VideoFrame | null>((resolve) => {
        this.pendingSeek = { time, resolve };
      });
    }

    this.isSeeking = true;
    return this.performSeek(time);
  }

  private performSeek(time: number): Promise<VideoFrame | null> {
    return new Promise((resolve) => {
      let settled = false;

      const onSeeked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.video.removeEventListener('seeked', onSeeked);

        let frame: VideoFrame | null = null;
        try {
          frame = new VideoFrame(this.video);
        } catch (e) {
          console.error('Failed to create VideoFrame:', e);
        }

        resolve(frame);

        // Process next seek if one was requested during this seek operation
        if (this.pendingSeek) {
          const next = this.pendingSeek;
          this.pendingSeek = null;
          this.performSeek(next.time).then(next.resolve);
        } else {
          this.isSeeking = false;
        }
      };

      // Timeout: if seeked event never fires within 2s, unlock and resolve null
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.video.removeEventListener('seeked', onSeeked);
        console.warn(`VideoFrameDecoder: seek to ${time}s timed out`);
        resolve(null);
        this.isSeeking = false;
      }, 2000);

      this.video.addEventListener('seeked', onSeeked);
      const duration = this.video.duration || Infinity;
      this.video.currentTime = Math.max(0, Math.min(time, duration));
    });
  }

  public destroy() {
    this.video.src = '';
    this.video.load();
    if (this.pendingSeek) {
      this.pendingSeek.resolve(null);
      this.pendingSeek = null;
    }
  }
}
