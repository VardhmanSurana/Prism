import React, { useRef, useEffect, useCallback } from 'react';
import { VideoPreviewProps } from '../types';
import { resolveUrl } from '@/constants';
import { renderTextOverlays } from './TextOverlayRenderer';
import { renderEffects } from './EffectsRenderer';

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoSrc,
  currentTime,
  isPlaying,
  tracks,
  duration,
  onTimeUpdate,
  onSeek,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastSyncedTime = useRef<number>(-1);

  const drawCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    renderEffects(ctx, tracks, currentTime, w, h);
    renderTextOverlays(ctx, tracks, currentTime, w, h);
  }, [tracks, currentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Math.abs(video.currentTime - currentTime) > 0.1 && currentTime !== lastSyncedTime.current) {
      video.currentTime = currentTime;
      lastSyncedTime.current = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const loop = () => {
      drawCanvas();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [drawCanvas]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    onTimeUpdate(video.currentTime);
  }, [onTimeUpdate]);

  const handleSeeked = useCallback(() => {
    drawCanvas();
  }, [drawCanvas]);

  const resolvedSrc = resolveUrl(`local://${videoSrc}`);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#020202] relative">
      <div className="relative max-w-full max-h-full">
        <video
          ref={videoRef}
          src={resolvedSrc}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onSeeked={handleSeeked}
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
};
