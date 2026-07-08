import React, { useRef, useEffect, useCallback, useReducer, useState, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, PictureInPicture2,
  SkipBack, SkipForward, AlertCircle, RefreshCw,
} from 'lucide-react';
import { resolveUrl, API_BASE } from '@/constants';
import { VideoPlayerProps } from './types';
import { formatDuration } from '@/utils/formatDuration';
import { useVideoPlayerStore } from '@/store/videoPlayerStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_DELAY_MS = 3000;

// ─── State Machine ────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'ready' | 'error';

interface PlayerState {
  loadState: LoadState;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  isPiP: boolean;
  showControls: boolean;
  showSpeedMenu: boolean;
}

type PlayerAction =
  | { type: 'LOAD_START' }
  | { type: 'METADATA_LOADED'; duration: number }   // fires early — enough to start playback
  | { type: 'CAN_PLAY'; duration: number }           // may fire late on large files
  | { type: 'ERROR' }
  | { type: 'PLAYING' }
  | { type: 'PAUSED' }
  | { type: 'TIME_UPDATE'; currentTime: number }
  | { type: 'DURATION_CHANGE'; duration: number }
  | { type: 'FULLSCREEN_CHANGE'; value: boolean }
  | { type: 'PIP_CHANGE'; value: boolean }
  | { type: 'SHOW_CONTROLS' }
  | { type: 'HIDE_CONTROLS' }
  | { type: 'TOGGLE_SPEED_MENU' }
  | { type: 'CLOSE_SPEED_MENU' }
  | { type: 'RETRY' };

const initialState: PlayerState = {
  loadState: 'loading',
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  isFullscreen: false,
  isPiP: false,
  showControls: true,
  showSpeedMenu: false,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'LOAD_START':
      // Don't reset from error state on subsequent loadstart — prevents
      // browser retry loops from hiding the error message.
      if (state.loadState === 'error') return state;
      return { ...state, loadState: 'loading', isPlaying: false, currentTime: 0, duration: 0 };
    // loadedmetadata fires as soon as the browser knows duration/dimensions — use it
    // as the primary ready signal so we don't wait for canplay on large files.
    case 'METADATA_LOADED': {
      const d = action.duration;
      // Use the duration only if it's a real finite number.  Infinity means the
      // output is an unbounded stream — keep previous value and let durationchange
      // fill it in once the backend finishes and the moov atom is parsed.
      const duration = (d && isFinite(d) && d > 0) ? d : state.duration;
      return { ...state, loadState: 'ready', duration };
    }
    case 'CAN_PLAY': {
      const d = action.duration;
      const duration = (d && isFinite(d) && d > 0) ? d : state.duration;
      return { ...state, loadState: 'ready', duration };
    }
    case 'ERROR':
      return { ...state, loadState: 'error', isPlaying: false };
    case 'RETRY':
      return { ...state, loadState: 'loading' };
    case 'PLAYING':
      return { ...state, isPlaying: true };
    case 'PAUSED':
      return { ...state, isPlaying: false };
    case 'TIME_UPDATE':
      // Emergency fallback: if time is ticking the video is definitely playing,
      // so exit loading state regardless of whether canplay fired.
      return {
        ...state,
        loadState: state.loadState === 'loading' ? 'ready' : state.loadState,
        currentTime: action.currentTime,
      };
    case 'DURATION_CHANGE': {
      const d = action.duration;
      // Accept any positive finite duration.  Infinity means the backend is still
      // streaming (growing file / fMP4) — keep the previous value and wait for a
      // subsequent durationchange that carries the real number.
      if (d && isFinite(d) && d > 0) {
        // Also transition loading→ready here.  HLS (MSE) streams never fire
        // loadedmetadata or canplay — durationchange is the earliest reliable
        // signal that the player has enough info to start playback.
        return {
          ...state,
          duration: d,
          loadState: state.loadState === 'loading' ? 'ready' : state.loadState,
        };
      }
      return state;
    }
    case 'FULLSCREEN_CHANGE':
      return { ...state, isFullscreen: action.value };
    case 'PIP_CHANGE':
      return { ...state, isPiP: action.value };
    case 'SHOW_CONTROLS':
      return { ...state, showControls: true };
    case 'HIDE_CONTROLS':
      return { ...state, showControls: false };
    case 'TOGGLE_SPEED_MENU':
      return { ...state, showSpeedMenu: !state.showSpeedMenu };
    case 'CLOSE_SPEED_MENU':
      return { ...state, showSpeedMenu: false };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ photo, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekDragRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Detect HEVC codec and use /transcode endpoint for browser compatibility.
  const isHevc = photo.codec && ['hevc', 'h265', 'hev1', 'hvc1'].includes(photo.codec.toLowerCase());

  // Detect codecs that WebKitGTK/Linux GStreamer cannot decode reliably.
  const isUnsupportedCodec = useMemo(() => {
    if (!photo.codec) return false;
    const c = photo.codec.toLowerCase();
    // VP9/AV1 need GStreamer plugins often missing on Linux
    // MPEG-2, MPEG-4 Part 2 (DivX/Xvid), WMV have poor/no browser support
    return ['vp9', 'vp09', 'av1', 'av01', 'mpeg2video', 'mpeg4', 'divx', 'xvid',
            'wmv3', 'wmv', 'vc1', 'theora'].includes(c);
  }, [photo.codec]);

  // Detect non-standard container formats (MKV, AVI, MOV, FLV, etc.) that browsers can't demux natively.
  const isNonStandardContainer = useMemo(() => {
    if (!photo.path) return false;
    const lowerPath = photo.path.toLowerCase();
    return !lowerPath.endsWith('.mp4') && !lowerPath.endsWith('.webm') && !lowerPath.endsWith('.ogg');
  }, [photo.path]);

  // Detect unsupported audio codecs (AC-3, DTS, etc.) that browsers refuse or cannot decode.
  const isUnsupportedAudio = useMemo(() => {
    if (!photo.audio_codec) return false;
    const lowerAudio = photo.audio_codec.toLowerCase();
    const supported = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'wav'];
    return !supported.includes(lowerAudio);
  }, [photo.audio_codec]);

  // Use /transcode immediately if HEVC, unsupported codec, non-standard container,
  // unsupported audio, or high-res (4K+).
  // H.264 in MP4 with supported audio always tries direct playback first —
  // the error-retry path will transparently switch to /transcode if needed.
  // This avoids unnecessary transcoding for standard videos on WebKitGTK.
  const needsTranscodeImmediately = isHevc || isUnsupportedCodec || isNonStandardContainer
    || isUnsupportedAudio
    || (photo.width >= 3840 || photo.height >= 3840);

  const [state, dispatch] = useReducer(playerReducer, initialState);
  // dragging progress bar: local state so we don't go through reducer on every pixel
  const [dragPct, setDragPct] = useState<number | null>(null);
  // Shows 'Converting video...' label while the /transcode backend re-encodes.
  // Initial value mirrors needsTranscodeImmediately; this is safe because
  // useState() only reads its argument once on mount — no race condition.
  const [isConverting, setIsConverting] = useState(needsTranscodeImmediately);
  // Differentiates error messages: 'codec' | 'transcode' | 'stall' | null
  const [errorReason, setErrorReason] = useState<'codec' | 'transcode' | 'stall' | null>(null);
  // Tracks whether we've already retried via the /transcode endpoint after a failure.
  // Non-HEVC videos (e.g. full-range H.264 from Snapchat) can stall GStreamer silently;
  // on first error we transparently re-try via /transcode which normalises the file.
  const retriedWithTranscodeRef = useRef(false);
  // When we retry via /transcode the backend may spend 10-30s transcoding first.
  // This flag tells the loading-timeout effect to use a 90s window instead of 15s.
  const extendedTimeoutRef = useRef(false);
  // Mutable ref so the error handler always sees the latest transcode URL without
  // needing to be inside a closure that captured a stale `videoSrc`.
  const transcodeSrcRef = useRef<string>('');
  // Mutable ref so handlePlaybackFailure always reads the latest isConverting
  // without depending on it in the useCallback dependency array.
  const isConvertingRef = useRef(isConverting);
  isConvertingRef.current = isConverting;

  // Persistent preferences from Zustand (volume, mute, speed)
  const { volume, isMuted, playbackRate, setVolume, setMuted, setPlaybackRate } =
    useVideoPlayerStore();

  const videoSrc = needsTranscodeImmediately
    ? resolveUrl(`hls://${photo.path}`)
    : resolveUrl(`local://${photo.path}`);
  // Keep the old /transcode URL as fallback for manual Retry button
  const transcodeSrc = resolveUrl(`transcode://${photo.path}`);
  transcodeSrcRef.current = transcodeSrc;

  // HLS is used for any file that needs transcoding.
  // Native <video> src is used for direct-play (H.264 MP4, etc.).
  const useHls = needsTranscodeImmediately && Hls.isSupported();
  const hlsRef = useRef<Hls | null>(null);

  // If we're using HLS from the start, mark converting & extend the timeout
  // immediately so the first mount already has the 90s window.
  if (needsTranscodeImmediately && !isHevc) {
    extendedTimeoutRef.current = true;
  }
  const effectivePct =
    dragPct !== null
      ? dragPct
      : state.duration > 0
      ? (state.currentTime / state.duration) * 100
      : 0;

  // ── Controls auto-hide ────────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => dispatch({ type: 'HIDE_CONTROLS' }), CONTROLS_HIDE_DELAY_MS);
  }, []);

  const handlePlaybackFailure = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    if (!retriedWithTranscodeRef.current && !isHevc) {
      retriedWithTranscodeRef.current = true;
      extendedTimeoutRef.current = true;
      console.warn(
        `[VideoPlayer] Playback failed — transparently retrying via /transcode endpoint ` +
        `(codec=${photo.codec ?? 'unknown'}, path=${photo.path})`
      );
      setIsConverting(true);
      setErrorReason('transcode');
      const v = videoRef.current;
      if (v) {
        dispatch({ type: 'RETRY' });
        v.src = transcodeSrcRef.current + (transcodeSrcRef.current.includes('?') ? '&' : '?') + 'force=true';
        console.log(`[VideoPlayer] Retry src: ${v.src}`);
        v.load();
        return;
      }
    }
    const reason = isConvertingRef.current ? 'transcode' : 'codec';
    console.error(
      `[VideoPlayer] Giving up — errorReason=${reason} ` +
      `retriedWithTranscode=${retriedWithTranscodeRef.current} isHevc=${isHevc}`
    );
    setErrorReason(reason);
    setIsConverting(false);
    dispatch({ type: 'ERROR' });
  }, [isHevc, photo.codec, photo.path]);

  const handlePlaybackFailureRef = useRef(handlePlaybackFailure);
  handlePlaybackFailureRef.current = handlePlaybackFailure;

  // Mutable ref so showControlsNow always reads the latest isPlaying
  // without depending on it in the useCallback dependency array.
  const isPlayingRef = useRef(state.isPlaying);
  isPlayingRef.current = state.isPlaying;

  const showControlsNow = useCallback(() => {
    dispatch({ type: 'SHOW_CONTROLS' });
    if (isPlayingRef.current) scheduleHide();
  }, [scheduleHide]);

  // Start/stop hide timer when play state changes
  useEffect(() => {
    if (state.isPlaying) {
      scheduleHide();
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      dispatch({ type: 'SHOW_CONTROLS' });
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [state.isPlaying, scheduleHide]);

  // Loading timeout: if stuck in 'loading', show error after a deadline.
  // • Normal first-load: 15 s — catches unsupported codecs and network failures.
  // • Transcode retry: 90 s — the backend FFmpeg pass can take 10-30 s for a
  //   typical mobile clip before the first byte of the re-encoded file is served.
  useEffect(() => {
    if (state.loadState === 'loading') {
      const ms = extendedTimeoutRef.current ? 90_000 : 15_000;
      loadingTimeoutRef.current = setTimeout(() => {
        handlePlaybackFailureRef.current?.();
      }, ms);
    }
    // Always clear the stall timeout when loadState changes (loading→ready or
    // loading→error).  The TIME_UPDATE emergency fallback can transition
    // loading→ready without onLoadedMetadata/onCanPlay firing, which means the
    // stall timeout set by a prior stalled event would otherwise remain active
    // and fire later as a false error.
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [state.loadState]);

  // ── Attach video event listeners once on mount ────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Pause background jobs on player mount so they don't compete with decode
    fetch(`${API_BASE}/api/v1/utilities/background-jobs/pause`, { method: 'POST' })
      .catch(() => console.warn('[VideoPlayer] Failed to pause background jobs'));

    // Apply persistent prefs on mount
    v.volume = volume;
    v.muted = isMuted;
    v.playbackRate = playbackRate;

    // ── HLS.js setup ──────────────────────────────────────────────────────
    // Used for any file that needs transcoding.  hls.js manages the segment
    // playlist, requests segments on demand, and feeds them to the <video>
    // element via MSE — giving us duration-known-immediately + lazy seek.
    if (useHls) {
      const hls = new Hls({
        // Start loading the playlist + first segment immediately
        autoStartLoad: true,
        // Buffer 30 s ahead (enough for smooth playback without wasting encode)
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Don't stall if a segment takes a while to encode on first request
        manifestLoadingTimeOut: 90_000,
        levelLoadingTimeOut: 90_000,
        fragLoadingTimeOut: 120_000,
        // Retry up to 4 times for a segment before giving up
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
        // xhrSetup allows us to send credentials for local CORS
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = true;
        },
      });

      hlsRef.current = hls;
      const playlistUrl = resolveUrl(`hls://${photo.path}`);
      console.log(`[VideoPlayer/HLS] Loading playlist: ${playlistUrl}`);

      hls.loadSource(playlistUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        // v.duration may still be NaN at MANIFEST_PARSED for MSE/HLS streams.
        // Try to extract duration from hls.js internals, then fall back to v.duration.
        let duration = v.duration;
        if (!isFinite(duration) || duration <= 0) {
          // hls.js stores total duration on the level details after manifest parse
          const level = data.levels?.[0];
          const totalDur = (level as any)?.details?.totalduration;
          if (totalDur && isFinite(totalDur) && totalDur > 0) {
            duration = totalDur;
          }
        }
        console.log(
          `[VideoPlayer/HLS] MANIFEST_PARSED — levels=${data.levels.length} ` +
          `duration=${duration}`
        );
        setIsConverting(false);
        if (isFinite(duration) && duration > 0) {
          dispatch({ type: 'METADATA_LOADED', duration });
        }
        v.play().catch((err) => {
          console.warn(`[VideoPlayer/HLS] autoplay rejected: ${err.message}`);
        });
      });

      hls.on(Hls.Events.FRAG_LOADING, (_evt, data) => {
        console.log(
          `[VideoPlayer/HLS] Loading seg=${data.frag.sn} ` +
          `start=${data.frag.start.toFixed(1)}s ` +
          `duration=${data.frag.duration.toFixed(1)}s`
        );
      });

      hls.on(Hls.Events.FRAG_LOADED, (_evt, data) => {
        console.log(
          `[VideoPlayer/HLS] Segment loaded seg=${data.frag.sn} ` +
          `size=${(data.frag.stats.total / 1024).toFixed(0)} KB`
        );
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          console.error(
            `[VideoPlayer/HLS] Fatal error type=${data.type} ` +
            `details=${data.details} — falling back to /transcode`
          );
          hls.destroy();
          hlsRef.current = null;
          // Fall back to the old single-file transcode for robustness
          handlePlaybackFailureRef.current?.();
        } else {
          console.warn(
            `[VideoPlayer/HLS] Non-fatal error type=${data.type} ` +
            `details=${data.details} (hls.js will retry)`
          );
        }
      });

      return () => {
        fetch(`${API_BASE}/api/v1/utilities/background-jobs/resume`, { method: 'POST' }).catch(() => {});
        hls.destroy();
        hlsRef.current = null;
        v.pause();
        v.removeAttribute('src');
        v.load();
      };
    }

    // ── Native <video> path (direct play — H.264 MP4, etc.) ──────────────

    const onLoadStart = () => {
      console.log(
        `[VideoPlayer] loadstart — src=${v.src.slice(0, 120)} ` +
        `codec=${photo.codec ?? 'unknown'} ` +
        `container=${photo.path?.split('.').pop() ?? '?'} ` +
        `needsTranscode=${needsTranscodeImmediately}`
      );
      dispatch({ type: 'LOAD_START' });
    };

    // loadedmetadata fires as soon as the browser has parsed the container header
    // (duration, dimensions, tracks). This is the earliest safe point to call play().
    // For large MKV files on WebKitGTK, canplay can take minutes — don't wait for it.
    const onLoadedMetadata = () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);

      console.log(
        `[VideoPlayer] loadedmetadata — duration=${v.duration} ` +
        `(${isFinite(v.duration) ? v.duration.toFixed(2) + 's' : 'Infinity/NaN'}) ` +
        `readyState=${v.readyState} videoWidth=${v.videoWidth}x${v.videoHeight}`
      );

      if (v.duration === 0) {
        console.warn('[VideoPlayer] duration=0 after loadedmetadata — container likely undecipherable, falling back to transcode');
        handlePlaybackFailureRef.current?.();
        return;
      }

      if (!isFinite(v.duration)) {
        console.warn(
          `[VideoPlayer] duration=${v.duration} (not finite) after loadedmetadata — ` +
          `backend may still be transcoding or serving an fMP4 stream. ` +
          `Proceeding anyway; will retry duration on durationchange.`
        );
      }

      setIsConverting(false);
      dispatch({ type: 'METADATA_LOADED', duration: v.duration });
      v.play().catch((err) => {
        console.warn(`[VideoPlayer] autoplay rejected: ${err.message}`);
      });
    };

    const onCanPlay = () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      console.log(
        `[VideoPlayer] canplay — duration=${v.duration} readyState=${v.readyState}`
      );
      dispatch({ type: 'CAN_PLAY', duration: v.duration });
    };

    const onDurationChange = () => {
      console.log(
        `[VideoPlayer] durationchange — duration=${v.duration} ` +
        `(${isFinite(v.duration) ? v.duration.toFixed(2) + 's' : 'non-finite'})`
      );
      if (isFinite(v.duration) && v.duration > 0) {
        dispatch({ type: 'DURATION_CHANGE', duration: v.duration });
      }
    };

    const onTimeUpdate = () => {
      if (!seekDragRef.current) dispatch({ type: 'TIME_UPDATE', currentTime: v.currentTime });
    };

    const onPlay  = () => {
      console.log(`[VideoPlayer] playing — currentTime=${v.currentTime.toFixed(2)}s`);
      dispatch({ type: 'PLAYING' });
    };
    const onPause = () => {
      console.log(`[VideoPlayer] paused — currentTime=${v.currentTime.toFixed(2)}s`);
      dispatch({ type: 'PAUSED' });
    };
    const onError = () => {
      const err = v.error;
      console.error(
        `[VideoPlayer] media error — code=${err?.code} message=${err?.message} ` +
        `src=${v.src.slice(0, 120)} networkState=${v.networkState} readyState=${v.readyState}`
      );
      handlePlaybackFailureRef.current?.();
    };

    const onStalled = () => {
      console.warn(
        `[VideoPlayer] stalled — currentTime=${v.currentTime.toFixed(2)}s ` +
        `networkState=${v.networkState} readyState=${v.readyState} ` +
        `buffered=${v.buffered.length > 0 ? v.buffered.end(v.buffered.length - 1).toFixed(2) + 's' : 'none'}`
      );
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = setTimeout(() => {
        console.error('[VideoPlayer] stall timeout (10s) — triggering playback failure');
        setErrorReason('stall');
        handlePlaybackFailureRef.current?.();
      }, 10_000);
    };

    const onAbort = () => {
      console.warn(
        `[VideoPlayer] abort — networkState=${v.networkState} readyState=${v.readyState}`
      );
      // Only treat abort as fatal if we're still loading and haven't decoded
      // any frames yet.  abort fires legitimately during src changes, seeks,
      // v.load() calls, and component unmount — none of which are errors.
      if (v.readyState < 2) {
        handlePlaybackFailureRef.current?.();
      }
    };

    const onEnded = () => {
      console.log(`[VideoPlayer] ended`);
      // HLS handles its own end-of-stream; no reload needed
    };

    const onFsChange = () =>
      dispatch({ type: 'FULLSCREEN_CHANGE', value: !!document.fullscreenElement });

    const onPiPEnter = () => dispatch({ type: 'PIP_CHANGE', value: true });
    const onPiPLeave = () => dispatch({ type: 'PIP_CHANGE', value: false });

    v.addEventListener('loadstart', onLoadStart);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('stalled', onStalled);
    v.addEventListener('abort', onAbort);
    v.addEventListener('ended', onEnded);
    v.addEventListener('enterpictureinpicture', onPiPEnter);
    v.addEventListener('leavepictureinpicture', onPiPLeave);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      // Resume background jobs on player unmount
      fetch(`${API_BASE}/api/v1/utilities/background-jobs/resume`, { method: 'POST' }).catch(() => {});

      v.removeEventListener('loadstart', onLoadStart);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('stalled', onStalled);
      v.removeEventListener('abort', onAbort);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('enterpictureinpicture', onPiPEnter);
      v.removeEventListener('leavepictureinpicture', onPiPLeave);
      document.removeEventListener('fullscreenchange', onFsChange);

      // Clean up timeouts
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);

      // Clean up on unmount so WebKitGTK releases the decode pipeline
      v.pause();
      v.removeAttribute('src');
      v.load();
    };

    // Catch metadata that loaded before listeners were attached (race condition).
    // preload="metadata" causes the browser to fetch immediately on DOM commit,
    // but useEffect runs after paint — so loadedmetadata can fire before we listen.
    if (v.readyState >= 1) {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      dispatch({ type: 'METADATA_LOADED', duration: v.duration });
      v.play().catch(() => {});
    }
  }, []); // intentionally empty – runs once per mount

  // ── Playback actions ──────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || state.loadState !== 'ready') return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, [state.loadState]);

  const seek = useCallback((deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec));
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
  }, [setVolume, setMuted]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
  }, [setMuted]);

  const handleSpeedChange = useCallback((rate: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setPlaybackRate(rate);
    dispatch({ type: 'CLOSE_SPEED_MENU' });
  }, [setPlaybackRate]);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen();
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      document.pictureInPictureElement
        ? await document.exitPictureInPicture()
        : await v.requestPictureInPicture();
    } catch (err) {
      // Ignore "unsupported" / "already exiting" — log anything else so
      // permission or policy failures aren't silently swallowed.
      if (err instanceof Error && !err.message.includes('exit')) {
        console.warn(`[VideoPlayer] PiP failed: ${err.message}`);
      }
    }
  }, []);

  const retry = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    retriedWithTranscodeRef.current = false;
    extendedTimeoutRef.current = false;
    dispatch({ type: 'RETRY' });

    // If we were using HLS and it failed, destroy it before retrying
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // If the file originally needed HLS (transcode), retry via HLS again —
    // the transient error may resolve on a fresh attempt.  Only fall back to
    // the single-file /transcode endpoint if HLS is not available.
    if (needsTranscodeImmediately && Hls.isSupported()) {
      extendedTimeoutRef.current = true;
      setIsConverting(true);
      setErrorReason('transcode');
      // Re-create HLS instance (the old one was destroyed above)
      const hls = new Hls({
        autoStartLoad: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 90_000,
        levelLoadingTimeOut: 90_000,
        fragLoadingTimeOut: 120_000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
        xhrSetup: (xhr) => { xhr.withCredentials = true; },
      });
      hlsRef.current = hls;
      const playlistUrl = resolveUrl(`hls://${photo.path}`);
      hls.loadSource(playlistUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsConverting(false);
        if (isFinite(v.duration) && v.duration > 0) {
          dispatch({ type: 'METADATA_LOADED', duration: v.duration });
        }
        v.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          handlePlaybackFailureRef.current?.();
        }
      });
      console.log(`[VideoPlayer] Manual retry → HLS ${playlistUrl}`);
      return;
    }

    // Direct-play files: retry via the single-file /transcode endpoint
    const fallbackSrc = resolveUrl(`transcode://${photo.path}`);
    v.src = fallbackSrc;
    v.load();
    console.log(`[VideoPlayer] Manual retry → ${fallbackSrc}`);
  }, [photo.path, needsTranscodeImmediately]);

  // ── Progress bar drag ─────────────────────────────────────────────────────

  const calcPct = (e: React.MouseEvent | MouseEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    seekDragRef.current = true;
    const pct = calcPct(e, e.currentTarget);
    setDragPct(pct * 100);

    const onMove = (ev: MouseEvent) => {
      const bar = progressBarRef.current;
      if (!bar) return;
      const p = calcPct(ev, bar);
      setDragPct(p * 100);
    };

    const onUp = (ev: MouseEvent) => {
      seekDragRef.current = false;
      const bar = progressBarRef.current;
      if (bar && videoRef.current && isFinite(videoRef.current.duration)) {
        const p = calcPct(ev, bar);
        videoRef.current.currentTime = p * videoRef.current.duration;
      }
      setDragPct(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          togglePlay();
          showControlsNow();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
          showControlsNow();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(5);
          showControlsNow();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange((videoRef.current?.volume ?? 1) + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange((videoRef.current?.volume ?? 1) - 0.1);
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
  }, [togglePlay, seek, toggleMute, toggleFullscreen, handleVolumeChange, onClose,
      showControlsNow]);

  // ── Render ────────────────────────────────────────────────────────────────

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center bg-black select-none"
      onMouseMove={showControlsNow}
      onMouseLeave={() => state.isPlaying && dispatch({ type: 'HIDE_CONTROLS' })}
    >
      {/* ── Video element ── */}
      {/* crossOrigin="anonymous" is critical on Linux/WebKitGTK:
          Without it, WebKit sends Sec-Fetch-Mode: no-cors for the video request.
          With it, the request becomes a proper CORS fetch and WebKitGTK can read
          the response body / negotiate the GStreamer pipeline correctly.
          For HLS via hls.js (MSE), src is NOT set here — hls.js manages it. */}
      <video
        ref={videoRef}
        src={useHls ? undefined : videoSrc}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* ── Loading state: show thumbnail with "Fetching data" badge ── */}
      {state.loadState === 'loading' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Thumbnail background */}
          {photo.animated_url ? (
            <img
              src={resolveUrl(photo.animated_url)}
              className="w-full h-full object-contain"
              alt=""
            />
          ) : (
            <img
              src={resolveUrl(`/api/v1/photos/${photo.id}/thumbnail?size=800`)}
              className="w-full h-full object-contain"
              alt=""
            />
          )}
          {/* "Fetching data" badge in top-right corner */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] text-white/60 tracking-wide">
              {isConverting ? 'Converting…' : useHls ? 'Preparing…' : 'Fetching data'}
            </span>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {state.loadState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle size={36} className="text-red-400/70" />
            <p className="text-white/60 text-sm">Failed to play video</p>
            <p className="text-white/30 text-xs max-w-xs leading-relaxed">
              {errorReason === 'transcode'
                ? 'Video conversion failed. The file may be corrupted or use an unsupported encoding.'
                : errorReason === 'stall'
                ? 'Video playback stalled. The file may be too large or use an unsupported profile.'
                : 'This video could not be played. The format or codec may not be supported on this platform.'}
            </p>
            <p className="text-white/20 text-[10px] max-w-xs break-all">{photo.path}</p>
          </div>
          <button
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white/70 text-sm hover:bg-white/20 transition-all"
            onClick={retry}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* ── Center play button (shown when paused & ready) ── */}
      {state.loadState === 'ready' && !state.isPlaying && state.showControls && (
        <button
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-auto"
          onClick={togglePlay}
          tabIndex={-1}
        >
          <div className="w-16 h-16 rounded-2xl bg-black/60 border border-white/20 flex items-center justify-center hover:bg-black/70 transition-all">
            <Play size={30} fill="white" className="text-white ml-1" />
          </div>
        </button>
      )}

      {/* ── Controls bar ── */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl z-20 transition-opacity duration-300 ${
          state.showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-4 py-3 bg-[#0d0f14] border border-white/10 rounded-2xl flex flex-col gap-2.5 shadow-2xl">
          {/* ── Seek bar ── */}
          {/* Expand click/touch target vertically without changing visual size.
              paddingBlock adds 8px above+below, negative margin pulls it back. */}
          <div
            ref={progressBarRef}
            className="relative w-full cursor-pointer group/seek"
            style={{ paddingBlock: '8px', marginBlock: '-8px', boxSizing: 'content-box' }}
            onMouseDown={handleProgressMouseDown}
          >
            {/* Track background */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-white/20 overflow-hidden pointer-events-none">
              {/* Filled progress */}
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${effectivePct}%`,
                  background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${effectivePct}% - 7px)` }}
            />
          </div>

          {/* ── Bottom controls row ── */}
          <div className="flex items-center justify-between gap-2">
            {/* Left group */}
            <div className="flex items-center gap-1.5">
              {/* Skip back 10s */}
              <button
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => seek(-10)}
                title="Back 10s"
              >
                <SkipBack size={15} />
              </button>

              {/* Play / Pause */}
              <button
                className="p-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all"
                onClick={togglePlay}
                title={state.isPlaying ? 'Pause' : 'Play'}
              >
                {state.isPlaying
                  ? <Pause size={16} />
                  : <Play size={16} className="ml-0.5" />}
              </button>

              {/* Skip forward 10s */}
              <button
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => seek(10)}
                title="Forward 10s"
              >
                <SkipForward size={15} />
              </button>

              {/* Time */}
              <span className="text-[11px] text-white/50 font-mono tabular-nums px-1">
                {formatDuration(state.currentTime)}
                <span className="text-white/25 mx-0.5">/</span>
                {formatDuration(state.duration)}
              </span>
            </div>

            {/* Right group */}
            <div className="flex items-center gap-1.5">
              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || effectiveVolume === 0
                    ? <VolumeX size={15} />
                    : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={effectiveVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-20 transition-all duration-200 cursor-pointer accent-violet-400 h-1 opacity-0 group-hover/vol:opacity-100"
                  title="Volume"
                />
              </div>

              {/* Speed picker */}
              <div className="relative">
                <button
                  className="px-2 py-1 rounded-lg text-[11px] font-mono text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  onClick={() => dispatch({ type: 'TOGGLE_SPEED_MENU' })}
                  title="Playback speed"
                >
                  {playbackRate}×
                </button>
                {state.showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[64px] bg-[#1a1b26] border border-white/10 rounded-xl py-1.5 shadow-2xl overflow-hidden">
                    {SPEED_OPTIONS.map((rate) => (
                      <button
                        key={rate}
                        className={`w-full text-left px-3 py-1 text-xs font-mono transition-colors ${
                          playbackRate === rate
                            ? 'text-violet-400 bg-violet-500/10'
                            : 'text-white/60 hover:text-white hover:bg-white/8'
                        }`}
                        onClick={() => handleSpeedChange(rate)}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Picture-in-Picture */}
              {'pictureInPictureEnabled' in document && (
                <button
                  className={`p-1.5 rounded-lg transition-all hover:bg-white/10 ${
                    state.isPiP ? 'text-violet-400' : 'text-white/60 hover:text-white'
                  }`}
                  onClick={togglePiP}
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 size={15} />
                </button>
              )}

              {/* Fullscreen */}
              <button
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={toggleFullscreen}
                title={state.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {state.isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
