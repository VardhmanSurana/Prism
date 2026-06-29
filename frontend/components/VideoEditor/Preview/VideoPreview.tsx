import React, { useRef, useEffect, useCallback } from 'react';
import { VideoPreviewProps } from '../types';
import { resolveUrl } from '@/constants';
import { renderTextOverlays } from './TextOverlayRenderer';
import { renderEffects } from './EffectsRenderer';
import { TransportControls } from '../Timeline/TransportControls';

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoSrc,
  currentTime,
  isPlaying,
  tracks,
  duration,
  onTimeUpdate,
  onSeek,
  onPlayPause,
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
    <div className="w-full h-full flex items-center justify-center bg-[#020202] relative overflow-hidden p-4">
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={resolvedSrc}
          className="max-w-full max-h-full object-contain"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onTimeUpdate={handleTimeUpdate}
          onSeeked={handleSeeked}
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>

      {/* Floating Transport Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#070709]/90 backdrop-blur-md px-5 py-1.5 rounded-full border border-white/5 shadow-2xl flex items-center w-[480px] max-w-[90%]">
        <TransportControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={onPlayPause}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
};
