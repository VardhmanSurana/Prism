import React, { useRef, useCallback, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import type { Clip, Keyframe, Track, ClipEffects, ClipTransform } from '@/types/nle';
import { DEFAULT_EFFECTS, DEFAULT_TRANSFORM, isDefaultEffects } from '@/types/nle';
import { evaluateKeyframes } from '@/lib/keyframes';
import { WebGLVideoRenderer } from '@/lib/videoShaderMapper';
import { useAudioMixer } from '@/hooks/useAudioMixer';
import { VideoFrameDecoder } from '@/utils/videoFrameDecoder';
import { API_BASE } from '@/constants';
import { formatTimecode } from './editorUtils';
import { Dropdown } from '@/components/ui/Dropdown';

export interface PreviewAreaProps {
  sourcePath: string;
  proxyPath?: string;
  additionalClips?: Clip[];
  activeClip?: Clip;
  photoId: string | number;
  isPlaying: boolean;
  playheadPosition: number;
  clipTimeOffset: number;
  clipKeyframes: Record<string, Keyframe[]>;
  clipEffects?: ClipEffects;
  clipTransform?: ClipTransform;
  clipSpeed?: number;
  clipInPoint?: number;
  compareMode: boolean;
  compareRatio: number;
  setCompareRatio: (v: number) => void;
  compareDragging: React.MutableRefObject<boolean>;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  duration: number;
  projectFps: number;
  tracks: Track[];
  projectWidth?: number;
  projectHeight?: number;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
  sourcePath, proxyPath, additionalClips, activeClip, photoId, isPlaying, playheadPosition, clipTimeOffset, clipKeyframes,
  clipEffects, clipTransform, clipSpeed, clipInPoint,
  compareMode, compareRatio, setCompareRatio, compareDragging,
  onSeek, onPlay, onPause, duration, projectFps, tracks,
  projectWidth = 1920, projectHeight = 1080,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLVideoRenderer | null>(null);
  const additionalVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const clipAudioEls = useRef<Map<string, HTMLVideoElement>>(new Map());

  const decodersRef = useRef<Map<string, VideoFrameDecoder>>(new Map());
  const [decodedFrame, setDecodedFrame] = useState<VideoFrame | null>(null);

  const targetSeekTimeRef = useRef<number | null>(null);
  const additionalSeekTargets = useRef<Map<string, number>>(new Map());
  const transitionSeekTarget = useRef<number | null>(null);

  const activeClipIdRef = useRef<string | null>(null);
  const transitionClipIdRef = useRef<string | null>(null);

  useEffect(() => {
    const map = clipAudioEls.current;
    const id = activeClip?.id ?? null;
    if (activeClipIdRef.current && activeClipIdRef.current !== id) {
      map.delete(activeClipIdRef.current);
    }
    if (id && videoRef.current) {
      map.set(id, videoRef.current);
      activeClipIdRef.current = id;
    }
  }, [activeClip?.id]);

  const getDecoder = useCallback((clipId: string, path: string) => {
    let decoder = decodersRef.current.get(clipId);
    if (!decoder) {
      decoder = new VideoFrameDecoder(path);
      decodersRef.current.set(clipId, decoder);
    }
    return decoder;
  }, []);

  useEffect(() => {
    return () => {
      decodersRef.current.forEach((d) => d.destroy());
      decodersRef.current.clear();
      setDecodedFrame((prev) => {
        prev?.close();
        return null;
      });
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      const transition = transitionVideoRef.current;
      if (transition) {
        transition.pause();
        transition.removeAttribute('src');
        transition.load();
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      setDecodedFrame((prev) => {
        prev?.close();
        return null;
      });
      return;
    }

    const playheadFrame = Math.round(playheadPosition * projectFps);
    let activeClip: Clip | null = null;
    for (const track of tracks) {
      if (!track.visible || track.type !== 'video') continue;
      for (const clip of track.clips) {
        const clipStart = clip.startFrame;
        const clipEnd = clip.startFrame + clip.durationFrames;
        if (playheadFrame >= clipStart && playheadFrame < clipEnd) {
          activeClip = clip;
          break;
        }
      }
      if (activeClip) break;
    }

    if (!activeClip) return;

    const clipStart = activeClip.startFrame / projectFps;
    const relativeTime = playheadPosition - clipStart;
    const speed = activeClip.speed ?? 1;
    const inPoint = activeClip.inPoint ?? 0;
    const sourceTime = inPoint + relativeTime * speed;

    const decoder = getDecoder(
      activeClip.id,
      `${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(activeClip.proxyPath || activeClip.sourcePath)}`
    );

    let active = true;
    decoder.getFrame(sourceTime).then((frame) => {
      if (!active) {
        frame?.close();
        return;
      }
      setDecodedFrame((prev) => {
        prev?.close();
        return frame;
      });
    });

    return () => {
      active = false;
    };
  }, [isPlaying, playheadPosition, projectFps, tracks, getDecoder]);

  const [localDuration, setLocalDuration] = useState(0);
  const videoDuration = duration || localDuration;

  useEffect(() => {
    if (canvasRef.current) {
      try {
        rendererRef.current = new WebGLVideoRenderer(canvasRef.current);
      } catch (e) {
        console.error('Failed to initialize WebGLVideoRenderer:', e);
      }
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  const transitionState = useMemo(() => {
    const playheadFrame = Math.round(playheadPosition * projectFps);
    for (const track of tracks) {
      if (track.type !== 'video') continue;
      const clips = track.clips;
      for (let i = 0; i < clips.length - 1; i++) {
        const clip = clips[i];
        const nextClip = clips[i + 1];
        if (!clip.transition) continue;
        const transitionDuration = clip.transition.duration;
        const transitionDurationFrames = Math.round(transitionDuration * projectFps);
        const clipEndFrame = clip.startFrame + clip.durationFrames;
        const transitionStartFrame = clipEndFrame - transitionDurationFrames;
        if (playheadFrame >= transitionStartFrame && playheadFrame < clipEndFrame) {
          const progress = (playheadFrame - transitionStartFrame) / transitionDurationFrames;
          return {
            active: true,
            type: clip.transition.type,
            progress: Math.max(0, Math.min(1, progress)),
            currentClip: clip,
            nextClip: nextClip,
          };
        }
      }
    }
    return { active: false };
  }, [tracks, playheadPosition, projectFps]);

  useEffect(() => {
    const map = clipAudioEls.current;
    const id = transitionState.nextClip?.id ?? null;
    if (transitionClipIdRef.current && transitionClipIdRef.current !== id) {
      map.delete(transitionClipIdRef.current);
    }
    if (id && transitionVideoRef.current) {
      map.set(id, transitionVideoRef.current);
      transitionClipIdRef.current = id;
    }
  }, [transitionState.nextClip?.id]);

  useAudioMixer(clipAudioEls.current, tracks, isPlaying, playheadPosition, projectFps);

  const path = proxyPath || sourcePath;
  const videoUrl = path ? `${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(path)}` : '';

  const kfTime = Math.max(0, playheadPosition - clipTimeOffset);

  const kfOpacity = clipKeyframes['opacity']?.length
    ? evaluateKeyframes(clipKeyframes['opacity'], kfTime)
    : undefined;
  const kfScaleX = clipKeyframes['scaleX']?.length
    ? evaluateKeyframes(clipKeyframes['scaleX'], kfTime)
    : undefined;
  const kfScaleY = clipKeyframes['scaleY']?.length
    ? evaluateKeyframes(clipKeyframes['scaleY'], kfTime)
    : undefined;
  const kfRotation = clipKeyframes['rotation']?.length
    ? evaluateKeyframes(clipKeyframes['rotation'], kfTime)
    : undefined;
  const kfX = clipKeyframes['x']?.length
    ? evaluateKeyframes(clipKeyframes['x'], kfTime)
    : undefined;
  const kfY = clipKeyframes['y']?.length
    ? evaluateKeyframes(clipKeyframes['y'], kfTime)
    : undefined;

  const baseTransform = clipTransform ?? DEFAULT_TRANSFORM;

  const currentTransform = useMemo(() => {
    return {
      x: kfX ?? baseTransform.x,
      y: kfY ?? baseTransform.y,
      scaleX: kfScaleX ?? baseTransform.scaleX,
      scaleY: kfScaleY ?? baseTransform.scaleY,
      rotation: kfRotation ?? baseTransform.rotation,
      opacity: kfOpacity ?? baseTransform.opacity,
    };
  }, [kfOpacity, kfScaleX, kfScaleY, kfRotation, kfX, kfY, baseTransform]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && isPlaying) {
      onSeek(video.currentTime);
    }
  }, [isPlaying, onSeek]);

  const effects = clipEffects ?? DEFAULT_EFFECTS;
  const hasEffectsApplied = !isDefaultEffects(effects);

  const containerRef = useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = useState<'fit' | number>('fit');
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const computeSize = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (containerWidth === 0 || containerHeight === 0) return;

      const aspect = projectWidth / projectHeight;
      let displayWidth: number;
      let displayHeight: number;

      if (containerWidth / containerHeight > aspect) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * aspect;
      } else {
        displayWidth = containerWidth;
        displayHeight = displayWidth / aspect;
      }

      setCanvasDisplaySize({ width: displayWidth, height: displayHeight });
    };

    computeSize();
    const ro = new ResizeObserver(computeSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [projectWidth, projectHeight]);

  const handleCompareMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    compareDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!compareDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      setCompareRatio(Math.max(0.05, Math.min(0.95, x)));
    };
    const onUp = () => {
      compareDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [compareDragging, setCompareRatio]);

  const handleStepBack = useCallback(() => {
    onSeek(Math.max(0, playheadPosition - 1 / projectFps));
  }, [playheadPosition, onSeek, projectFps]);

  const handleStepForward = useCallback(() => {
    onSeek(playheadPosition + 1 / projectFps);
  }, [playheadPosition, onSeek, projectFps]);

  const renderWebGL = useCallback(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const video = decodedFrame || videoRef.current;
    if (!renderer || !canvas || !video) return;

    if (canvas.width !== projectWidth || canvas.height !== projectHeight) {
      canvas.width = projectWidth;
      canvas.height = projectHeight;
    }

    renderer.clear();

    if (transitionState.active) {
      const p = transitionState.progress;
      const t = transitionState.type;
      const progress = p ?? 0;

      let baseOpacity = currentTransform.opacity;
      let baseTranslateX = currentTransform.x;
      let baseTranslateY = currentTransform.y;

      if (t === 'crossfade' || t === 'dissolve') {
        baseOpacity = (1 - progress) * currentTransform.opacity;
      } else if (t === 'slide-left') {
        baseTranslateX = currentTransform.x - progress * projectWidth;
      } else if (t === 'slide-right') {
        baseTranslateX = currentTransform.x + progress * projectWidth;
      } else if (t === 'wipe-left') {
        baseTranslateX = currentTransform.x + progress * projectWidth;
      } else if (t === 'wipe-right') {
        baseTranslateX = currentTransform.x - progress * projectWidth;
      }

      const modifiedTransform = {
        ...currentTransform,
        opacity: baseOpacity,
        x: baseTranslateX,
        y: baseTranslateY,
      };

      renderer.render(video, effects, modifiedTransform, projectWidth, projectHeight);

      const nextVideo = transitionVideoRef.current;
      if (nextVideo && transitionState.nextClip) {
        let nextOpacity = transitionState.nextClip.transform.opacity;
        let nextTranslateX = transitionState.nextClip.transform.x;
        let nextTranslateY = transitionState.nextClip.transform.y;

        if (t === 'crossfade' || t === 'dissolve') {
          nextOpacity = progress * transitionState.nextClip.transform.opacity;
        } else if (t === 'slide-left') {
          nextTranslateX = transitionState.nextClip.transform.x + (1 - progress) * projectWidth;
        } else if (t === 'slide-right') {
          nextTranslateX = transitionState.nextClip.transform.x - (1 - progress) * projectWidth;
        } else if (t === 'wipe-left') {
          nextTranslateX = transitionState.nextClip.transform.x - (1 - progress) * projectWidth;
        } else if (t === 'wipe-right') {
          nextTranslateX = transitionState.nextClip.transform.x + (1 - progress) * projectWidth;
        }

        const nextModifiedTransform = {
          ...transitionState.nextClip.transform,
          opacity: nextOpacity,
          x: nextTranslateX,
          y: nextTranslateY,
        };

        renderer.render(nextVideo, transitionState.nextClip.effects || DEFAULT_EFFECTS, nextModifiedTransform, projectWidth, projectHeight);
      }
    } else {
      if (compareMode && hasEffectsApplied) {
        const splitX = compareRatio * projectWidth;
        const gl = canvas.getContext('webgl')!;

        gl.enable(gl.SCISSOR_TEST);

        gl.scissor(0, 0, splitX, projectHeight);
        renderer.render(video, DEFAULT_EFFECTS, currentTransform, projectWidth, projectHeight);

        gl.scissor(splitX, 0, projectWidth - splitX, projectHeight);
        renderer.render(video, effects, currentTransform, projectWidth, projectHeight);

        gl.disable(gl.SCISSOR_TEST);
      } else {
        renderer.render(video, effects, currentTransform, projectWidth, projectHeight);
      }
    }

    if (additionalClips && additionalClips.length > 0) {
      additionalClips.forEach((clip) => {
        const videoEl = additionalVideoRefs.current.get(clip.id);
        if (videoEl) {
          renderer.render(videoEl, clip.effects || DEFAULT_EFFECTS, clip.transform, projectWidth, projectHeight);
        }
      });
    }
  }, [
    projectWidth, projectHeight, effects, currentTransform,
    transitionState, compareMode, compareRatio, hasEffectsApplied, additionalClips, decodedFrame
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const relativeTime = playheadPosition - clipTimeOffset;
      const speed = clipSpeed ?? 1;
      const inPoint = clipInPoint ?? 0;
      const sourceTime = Math.max(0, inPoint + relativeTime * speed);
      if (Math.abs(video.currentTime - sourceTime) > 0.05) {
        if (video.seeking) {
          targetSeekTimeRef.current = sourceTime;
        } else {
          video.currentTime = sourceTime;
        }
      }
    }

    if (additionalClips) {
      additionalClips.forEach((clip) => {
        const videoEl = additionalVideoRefs.current.get(clip.id);
        if (videoEl) {
          const clipStart = clip.startFrame / projectFps;
          const relativeTime = playheadPosition - clipStart;
          const speed = clip.speed ?? 1;
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = Math.max(0, inPoint + relativeTime * speed);
          if (Math.abs(videoEl.currentTime - sourceTime) > 0.05) {
            if (videoEl.seeking) {
              additionalSeekTargets.current.set(clip.id, sourceTime);
            } else {
              videoEl.currentTime = sourceTime;
            }
          }
        }
      });
    }

    if (transitionState.active && transitionState.nextClip) {
      const nextVideo = transitionVideoRef.current;
      if (nextVideo) {
        const nextClipStart = transitionState.nextClip.startFrame / projectFps;
        const relativeTime = playheadPosition - nextClipStart;
        const speed = transitionState.nextClip.speed ?? 1;
        const inPoint = transitionState.nextClip.inPoint ?? 0;
        const sourceTime = Math.max(0, inPoint + relativeTime * speed);
        if (Math.abs(nextVideo.currentTime - sourceTime) > 0.05) {
          if (nextVideo.seeking) {
            transitionSeekTarget.current = sourceTime;
          } else {
            nextVideo.currentTime = sourceTime;
          }
        }
      }
    }
  }, [
    playheadPosition, clipTimeOffset, clipSpeed, clipInPoint,
    additionalClips, transitionState, isPlaying, projectFps
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => {
      if (!isPlaying) {
        renderWebGL();
      }
      if (targetSeekTimeRef.current !== null) {
        const nextTime = targetSeekTimeRef.current;
        targetSeekTimeRef.current = null;
        video.currentTime = nextTime;
      }
    };

    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, [renderWebGL, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => onPause());
    } else {
      video.pause();
    }
  }, [isPlaying, onPause]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      renderWebGL();
      if (isPlaying) {
        frameId = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      frameId = requestAnimationFrame(loop);
    } else {
      renderWebGL();
    }

    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, renderWebGL]);

  useEffect(() => {
    renderWebGL();
  }, [playheadPosition, renderWebGL]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#111]">
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-0 relative flex items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="block bg-black"
          style={{
            width: canvasDisplaySize ? canvasDisplaySize.width : '100%',
            height: canvasDisplaySize ? canvasDisplaySize.height : '100%',
            transform: previewZoom === 'fit' ? undefined : `scale(${previewZoom / 100})`,
            transformOrigin: 'center center',
          }}
        />

        {compareMode && hasEffectsApplied && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 cursor-ew-resize z-10"
            style={{ left: `${compareRatio * 100}%` }}
            onMouseDown={handleCompareMouseDown}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-3 h-3 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>
        )}

        {compareMode && hasEffectsApplied && (
          <>
            <span className="absolute top-2 left-2 text-[10px] text-white/70 bg-black/50 rounded px-1.5 py-0.5 z-10">
              Before
            </span>
            <span className="absolute top-2 right-2 text-[10px] text-white/70 bg-black/50 rounded px-1.5 py-0.5 z-10">
              After
            </span>
          </>
        )}
      </div>

      <video
        ref={videoRef}
        src={videoUrl}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
        onLoadedMetadata={(e) => setLocalDuration(e.currentTarget.duration)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onPause}
        onSeeked={() => {
          if (!isPlaying) renderWebGL();
        }}
      />

      {transitionState.active && transitionState.nextClip && (
        <video
          ref={transitionVideoRef}
          src={`${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(transitionState.nextClip.proxyPath || transitionState.nextClip.sourcePath)}`}
          preload="metadata"
          crossOrigin="anonymous"
          className="hidden"
          onSeeked={(e) => {
            if (!isPlaying) renderWebGL();
            if (transitionSeekTarget.current !== null) {
              const nextTime = transitionSeekTarget.current;
              transitionSeekTarget.current = null;
              e.currentTarget.currentTime = nextTime;
            }
          }}
          onTimeUpdate={(e) => {
            const nextClip = transitionState.nextClip;
            if (!nextClip) return;
            const nextClipStart = nextClip.startFrame / projectFps;
            const relativeTime = playheadPosition - nextClipStart;
            const speed = nextClip.speed ?? 1;
            const inPoint = nextClip.inPoint ?? 0;
            const sourceTime = inPoint + relativeTime * speed;
            if (Math.abs(e.currentTarget.currentTime - sourceTime) > 0.1) {
              e.currentTarget.currentTime = Math.max(0, sourceTime);
            }
          }}
        />
      )}

      {additionalClips?.map((clip) => (
        <video
          key={clip.id}
          ref={(el) => {
            if (el) {
              additionalVideoRefs.current.set(clip.id, el);
              clipAudioEls.current.set(clip.id, el);
            } else {
              additionalVideoRefs.current.delete(clip.id);
              clipAudioEls.current.delete(clip.id);
            }
          }}
          src={`${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(clip.proxyPath || clip.sourcePath)}`}
          preload="metadata"
          crossOrigin="anonymous"
          className="hidden"
          onSeeked={(e) => {
            if (!isPlaying) renderWebGL();
            const pending = additionalSeekTargets.current.get(clip.id);
            if (pending !== undefined) {
              additionalSeekTargets.current.delete(clip.id);
              e.currentTarget.currentTime = pending;
            }
          }}
          onTimeUpdate={(e) => {
            const clipStart = clip.startFrame / projectFps;
            const relativeTime = playheadPosition - clipStart;
            const speed = clip.speed ?? 1;
            const inPoint = clip.inPoint ?? 0;
            const sourceTime = inPoint + relativeTime * speed;
            if (Math.abs(e.currentTarget.currentTime - sourceTime) > 0.1) {
              e.currentTarget.currentTime = Math.max(0, sourceTime);
            }
          }}
        />
      ))}

      <div className="h-11 bg-[#161616] border-t border-[#252525] flex items-center justify-between px-4 shrink-0 z-10">
        <div className="w-24 shrink-0" />

        <div className="flex items-center gap-3">
          <button onClick={handleStepBack} className="text-[#999] hover:text-white p-1 transition-colors" title="Previous frame">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => isPlaying ? onPause() : onPlay()}
            className="text-white bg-[#333] hover:bg-[#444] rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={handleStepForward} className="text-[#999] hover:text-white p-1 transition-colors" title="Next frame">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <span className="text-[#999] text-xs font-mono tabular-nums ml-2 select-none">
            {formatTimecode(playheadPosition)} / {formatTimecode(videoDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            value={previewZoom === 'fit' ? 'fit' : `${previewZoom}%`}
            onChange={(val) => setPreviewZoom(val === 'fit' ? 'fit' : parseInt(val as string))}
            options={[
              { value: 'fit', label: 'Fit' },
              { value: '25%', label: '25%' },
              { value: '50%', label: '50%' },
              { value: '75%', label: '75%' },
              { value: '100%', label: '100%' },
            ]}
            className="w-16"
          />

          <button
            onClick={() => containerRef.current?.requestFullscreen?.()}
            className="text-[#999] hover:text-white p-1 transition-colors"
            title="Fullscreen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
