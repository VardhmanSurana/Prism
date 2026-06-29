import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, PictureInPicture2,
  SkipBack, SkipForward,
} from 'lucide-react';
import { resolveUrl } from '@/constants';
import { VideoPlayerProps } from './types';
import { formatDuration } from '@/utils/formatDuration';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  photo,
  onClose,
  onPrev,
  onNext,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPiP, setIsPiP] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasAudio, setHasAudio] = useState(true);

  const videoSrc = resolveUrl(`local://${photo.path}`);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const seek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      c.requestFullscreen();
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onDurationChange = () => setDuration(v.duration);
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => { setHasError(true); setIsLoading(false); };

    const onAudioTracks = () => {
      const tracks = (v as any).audioTracks;
      if (tracks && tracks.length === 0) {
        setHasAudio(false);
      }
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('loadstart', onLoadStart);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    v.addEventListener('loadedmetadata', onAudioTracks);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('loadstart', onLoadStart);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
      v.removeEventListener('loadedmetadata', onAudioTracks);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPiPEnter = () => setIsPiP(true);
    const onPiPLeave = () => setIsPiP(false);
    v.addEventListener('enterpictureinpicture', onPiPEnter);
    v.addEventListener('leavepictureinpicture', onPiPLeave);
    return () => {
      v.removeEventListener('enterpictureinpicture', onPiPEnter);
      v.removeEventListener('leavepictureinpicture', onPiPLeave);
    };
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, [isPlaying, resetControlsTimer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          togglePlay();
          resetControlsTimer();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
          resetControlsTimer();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(5);
          resetControlsTimer();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          resetControlsTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          resetControlsTimer();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          resetControlsTimer();
          break;
        case '<':
          e.preventDefault();
          setPlaybackRate((prev) => {
            const idx = SPEED_OPTIONS.indexOf(prev);
            const next = idx > 0 ? SPEED_OPTIONS[idx - 1] : prev;
            if (videoRef.current) videoRef.current.playbackRate = next;
            return next;
          });
          resetControlsTimer();
          break;
        case '>':
          e.preventDefault();
          setPlaybackRate((prev) => {
            const idx = SPEED_OPTIONS.indexOf(prev);
            const next = idx < SPEED_OPTIONS.length - 1 ? SPEED_OPTIONS[idx + 1] : prev;
            if (videoRef.current) videoRef.current.playbackRate = next;
            return next;
          });
          resetControlsTimer();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            onClose?.();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seek, toggleMute, toggleFullscreen, handleVolumeChange, volume, onClose, resetControlsTimer]);

  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const v = videoRef.current;
    if (v && duration) v.currentTime = pct * duration;
  }, [duration]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center bg-[#0D0F14] overflow-hidden"
      onMouseMove={resetControlsTimer}
      onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="max-w-full max-h-full object-contain"
        playsInline
        preload="auto"
      />

      {/* Loading indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-3">
          <p className="text-sm">Failed to load video</p>
          <button
            onClick={() => { setHasError(false); setIsLoading(true); videoRef.current?.load(); }}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Big center play button when paused */}
      {!isPlaying && !isLoading && !hasError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
            <Play size={28} fill="white" className="text-white ml-1" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-8">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/progress mb-3 hover:h-2.5 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
              </button>

              {/* Skip back/forward */}
              <button onClick={() => seek(-10)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors hidden sm:block">
                <SkipBack size={16} className="text-white/70" />
              </button>
              <button onClick={() => seek(10)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors hidden sm:block">
                <SkipForward size={16} className="text-white/70" />
              </button>

              {/* Time */}
              <span className="text-xs text-white/70 font-mono tabular-nums ml-1">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Volume */}
              {hasAudio && (
                <div className="flex items-center gap-1 group/vol">
                  <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={16} className="text-white/70" /> : <Volume2 size={16} className="text-white/70" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-primary h-1 appearance-none bg-white/20 rounded-full cursor-pointer opacity-0 group-hover/vol:opacity-100"
                  />
                </div>
              )}

              {/* Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-1.5 py-1 rounded text-[11px] text-white/70 hover:bg-white/10 transition-colors font-mono"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1c24] border border-white/10 rounded-lg py-1 shadow-2xl min-w-[60px]">
                    {SPEED_OPTIONS.map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                          setShowSpeedMenu(false);
                          resetControlsTimer();
                        }}
                        className={`w-full px-3 py-1.5 text-xs font-mono text-left hover:bg-white/10 transition-colors ${
                          playbackRate === rate ? 'text-primary' : 'text-white/70'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PiP */}
              <button onClick={togglePiP} className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${isPiP ? 'text-primary' : ''}`}>
                <PictureInPicture2 size={16} className="text-white/70" />
              </button>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                {isFullscreen ? <Minimize size={16} className="text-white/70" /> : <Maximize size={16} className="text-white/70" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
