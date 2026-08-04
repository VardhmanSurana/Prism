import { useState, useEffect, useRef, useCallback } from 'react';

export type SlideshowTransition = 'fade' | 'slide' | 'ken-burns';

export const SLIDESHOW_INTERVALS = [
  { label: '2s', ms: 2000 },
  { label: '3s', ms: 3000 },
  { label: '4s', ms: 4000 },
  { label: '5s', ms: 5000 },
  { label: '8s', ms: 8000 },
  { label: '10s', ms: 10000 },
] as const;

export const DEFAULT_SLIDESHOW_INTERVAL_MS = 4000;

interface UseSlideshowOptions {
  /** Called when the slide timer elapses (images). */
  onAdvance: () => void;
  /** When true, image timer is paused (e.g. video drives advance via onEnded). */
  pauseTimer?: boolean;
  /** Reset progress when the current media changes. */
  mediaKey: string | number;
}

export function useSlideshow({ onAdvance, pauseTimer = false, mediaKey }: UseSlideshowOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_SLIDESHOW_INTERVAL_MS);
  const [loop, setLoop] = useState(true);
  const [transition, setTransition] = useState<SlideshowTransition>('fade');
  const [progress, setProgress] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicObjectUrlRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const remainingRef = useRef<number>(intervalMs);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const pauseTimerRef = useRef(pauseTimer);
  pauseTimerRef.current = pauseTimer;
  const intervalMsRef = useRef(intervalMs);
  intervalMsRef.current = intervalMs;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tickProgress = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    const total = remainingRef.current;
    const pct = total > 0 ? Math.min(1, elapsed / total) : 1;
    setProgress(pct);
    if (pct < 1) {
      rafRef.current = requestAnimationFrame(tickProgress);
    }
  }, []);

  const scheduleFromRemaining = useCallback(() => {
    clearTimers();
    if (!isActiveRef.current || !isPlayingRef.current || pauseTimerRef.current) {
      return;
    }
    const wait = remainingRef.current > 0 ? remainingRef.current : intervalMsRef.current;
    remainingRef.current = wait;
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tickProgress);
    timeoutRef.current = setTimeout(() => {
      setProgress(1);
      onAdvanceRef.current();
    }, wait);
  }, [clearTimers, tickProgress]);

  const start = useCallback(() => {
    setIsActive(true);
    setIsPlaying(true);
    remainingRef.current = intervalMsRef.current;
    setProgress(0);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setIsPlaying(false);
    clearTimers();
    setProgress(0);
    remainingRef.current = intervalMsRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [clearTimers]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const setMusicFile = useCallback((file: File | null) => {
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current);
      musicObjectUrlRef.current = null;
    }
    if (file) {
      const url = URL.createObjectURL(file);
      musicObjectUrlRef.current = url;
      setMusicUrl(url);
      setMusicName(file.name);
      setMusicEnabled(true);
    } else {
      setMusicUrl(null);
      setMusicName(null);
    }
  }, []);

  // Fresh slide timer whenever media changes while playing images
  useEffect(() => {
    if (!isActive || !isPlaying) return;
    if (pauseTimer) {
      clearTimers();
      setProgress(0);
      return;
    }
    remainingRef.current = intervalMs;
    scheduleFromRemaining();
    return clearTimers;
  }, [mediaKey, isActive, isPlaying, pauseTimer, intervalMs, scheduleFromRemaining, clearTimers]);

  // Pause / resume without resetting remaining time when isPlaying flips
  // (mediaKey effect already handles start; this handles mid-slide pause)
  const prevPlayingRef = useRef(isPlaying);
  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = isPlaying;

    if (!isActive) {
      clearTimers();
      return;
    }

    if (!isPlaying && wasPlaying) {
      // Pause: freeze remaining
      const elapsed = performance.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      clearTimers();
      const total = intervalMsRef.current;
      setProgress(total > 0 ? 1 - remainingRef.current / total : 0);
      return;
    }

    if (isPlaying && !wasPlaying && !pauseTimer) {
      scheduleFromRemaining();
    }
  }, [isPlaying, isActive, pauseTimer, clearTimers, scheduleFromRemaining]);

  // Background music element lifecycle
  useEffect(() => {
    if (!musicUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = musicVolume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      if (audioRef.current === audio) audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume applied in separate effect
  }, [musicUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isActive && isPlaying && musicEnabled && musicUrl) {
      audio.play().catch(() => {
        // Autoplay may be blocked until user gesture; ignore.
      });
    } else {
      audio.pause();
    }
  }, [isActive, isPlaying, musicEnabled, musicUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (musicObjectUrlRef.current) {
        URL.revokeObjectURL(musicObjectUrlRef.current);
        musicObjectUrlRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    isActive,
    isPlaying,
    intervalMs,
    setIntervalMs,
    loop,
    setLoop,
    transition,
    setTransition,
    progress,
    musicEnabled,
    setMusicEnabled,
    musicVolume,
    setMusicVolume,
    musicUrl,
    musicName,
    setMusicFile,
    start,
    stop,
    togglePlay,
    setIsPlaying,
  };
}
