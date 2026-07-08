/**
 * VideoEditorMode — Full-screen NLE overlay for video editing.
 * OpenCut-inspired layout: far-left icon sidebar, left assets panel,
 * center preview, right inspector, timeline at bottom.
 */
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { API_BASE } from '@/constants';
import type { Photo } from '@/types';
import type { VideoClipAnalysis, Clip } from '@/types/nle';
import { DEFAULT_TRANSFORM, DEFAULT_EFFECTS, isDefaultEffects } from '@/types/nle';
import { evaluateKeyframes } from '@/lib/keyframes';
import { WebGLVideoRenderer } from '@/lib/videoShaderMapper';
import { useAudioMixer } from '@/hooks/useAudioMixer';
import { VideoFrameDecoder } from '@/utils/videoFrameDecoder';
import { Timeline } from './Timeline/Timeline';
import { InspectorPanel } from './InspectorPanel/InspectorPanel';
import { ExportDialog } from './ExportDialog';
import { LeftSidebar, type EditorPanel } from './LeftSidebar';
import { AssetsPanel } from './AssetsPanel';
import { AdjustPanel } from './AdjustPanel';
import { TextPanel } from './TextPanel';
import { ElementsPanel } from './ElementsPanel';
import { EffectsBrowserPanel } from './EffectsBrowserPanel';
import { TransitionsPanel } from './TransitionsPanel';
import { PresetsPanel } from './PresetsPanel';
import { SettingsPanel } from './SettingsPanel';
import { VignetteOverlay } from './VignetteOverlay';
import { Dropdown } from '@/components/ui/Dropdown';

interface VideoEditorModeProps {
  photo: Photo;
  onClose: () => void;
}

export const VideoEditorMode: React.FC<VideoEditorModeProps> = ({ photo, onClose }) => {
  const {
    projectId, projectName, isDirty, isSaving,
    tracks, playheadPosition, isPlaying, selectedClipId,
    isExportDialogOpen, clipboardClip,
    loadProject, saveProject, createProject,
    play, pause, seek,
    setExportDialogOpen,
    addClip, removeClip, splitClip, selectClip, addFreezeFrame,
    undo, redo,
    pushHistory, projectFps, setClipboardClip, selectedTrackId,
    projectWidth, projectHeight,
  } = useNLEStore();

  const canUndo = useNLEStore(s => s.canUndo());
  const canRedo = useNLEStore(s => s.canRedo());

  // Find ALL clips at the current playhead position across all visible tracks
  const activeClips = useMemo(() => {
    const playheadFrame = Math.round(playheadPosition * projectFps);
    const result: Clip[] = [];
    for (const track of tracks) {
      if (!track.visible || track.type !== 'video') continue;
      for (const clip of track.clips) {
        const clipStart = clip.startFrame;
        const clipEnd = clip.startFrame + clip.durationFrames;
        if (playheadFrame >= clipStart && playheadFrame < clipEnd) {
          result.push(clip);
        }
      }
    }
    if (result.length === 0) {
      // Fallback: find the previous clip to show its last frame
      let prevClip: Clip | null = null;
      for (const track of tracks) {
        if (track.type !== 'video') continue;
        for (const clip of track.clips) {
          if (clip.startFrame < playheadFrame) {
            if (!prevClip || clip.startFrame > prevClip.startFrame) {
              prevClip = clip;
            }
          }
        }
      }
      if (prevClip) result.push(prevClip);
    }
    return result;
  }, [tracks, playheadPosition, projectFps]);

  // Primary clip (first visible) for backward compat
  const activeClip = activeClips[0] ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [clipAnalysis, setClipAnalysis] = useState<VideoClipAnalysis | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareRatio, setCompareRatio] = useState(0.5);
  const [activePanel, setActivePanel] = useState<EditorPanel>('assets');
  const compareDragging = useRef(false);

  // Initialize project on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const analyzeRes = await fetch(`${API_BASE}/api/v1/nle/clips/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_id: Number(photo.id),
            source_path: photo.path,
          }),
        });
        if (!analyzeRes.ok) throw new Error(`Failed to analyze video: ${analyzeRes.status} ${analyzeRes.statusText}`);
        const analysis: VideoClipAnalysis = await analyzeRes.json();
        if (cancelled) return;
        setClipAnalysis(analysis);

        // Check for existing project for this photo
        let project: import('@/types/nle').NLEProject | null = null;
        try {
          const existingRes = await fetch(
            `${API_BASE}/api/v1/nle/projects?cover_photo_id=${Number(photo.id)}`
          );
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            // API may return an array or a single object
            const projects = Array.isArray(existingData) ? existingData : existingData.projects ?? [];
            if (projects.length > 0) {
              // List endpoint doesn't include project_json — fetch full project data
              const fullRes = await fetch(`${API_BASE}/api/v1/nle/projects/${projects[0].id}`);
              if (fullRes.ok) {
                project = await fullRes.json();
              }
            }
          }
        } catch {
          // Ignore — we'll create a new project below
        }

        if (cancelled) return;

        if (project) {
          // Resume existing project
          loadProject(project);
        } else {
          // Create new project
          const projId = await createProject(
            Number(photo.id),
            photo.path,
            photo.filename ?? `Edit ${photo.id}`,
          );
          if (cancelled) return;

          const projRes = await fetch(`${API_BASE}/api/v1/nle/projects/${projId}`);
          if (!projRes.ok) throw new Error(`Failed to load project: ${projRes.status} ${projRes.statusText}`);
          project = await projRes.json();
          if (cancelled) return;
          loadProject(project);
        }

        const state = useNLEStore.getState();
        // Only add initial clip if the project has no clips on any track
        const hasClips = state.tracks.some((t) => t.clips.length > 0);
        if (state.tracks.length > 0 && !hasClips) {
          // Find the first video track (not text/audio) to place the clip
          const videoTrack = state.tracks.find((t) => t.type === 'video') ?? state.tracks[0];
          const fps = analysis.fps ?? 30;
          const clip = {
            id: `clip_init_${Date.now()}`,
            sourceId: analysis.clip_id,
            sourcePath: analysis.source_path,
            proxyPath: analysis.proxy_path,
            sourceDuration: analysis.duration,
            startFrame: 0,
            durationFrames: Math.round(analysis.duration * fps),
            inPoint: 0,
            outPoint: analysis.duration,
            speed: 1.0,
            volume: 1.0,
            muted: false,
            fadeIn: 0,
            fadeOut: 0,
            effects: {
              brightness: 0, contrast: 0, saturation: 0,
              temperature: 0, highlights: 0, shadows: 0,
              sharpness: 0, vignette: 0, noiseReduction: 0,
            },
            transform: DEFAULT_TRANSFORM,
            keyframes: {},
          };
          addClip(videoTrack.id, clip);
        }
      } catch (e) {
        console.error('Failed to initialize NLE project:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [photo.id, photo.path]);

  // Auto-save every 30 seconds when dirty
  useEffect(() => {
    if (!isDirty) return;
    const timer = setInterval(() => {
      saveProject();
    }, 30000);
    return () => clearInterval(timer);
  }, [isDirty, saveProject]);

  // Auto-save on Ctrl+S
  const handleSave = useCallback(() => {
    saveProject();
  }, [saveProject]);

  const handleClose = useCallback(() => {
    if (isDirty) saveProject();
    onClose();
  }, [isDirty, saveProject, onClose]);

  const handleExport = useCallback(() => {
    setExportDialogOpen(true);
  }, [setExportDialogOpen]);

  // Clipboard ref for copy/paste
  const clipboardRef = useRef<Clip | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((isCtrl && e.key === 'z' && e.shiftKey) || (isCtrl && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy: Ctrl+C
      if (isCtrl && e.key === 'c') {
        if (selectedClipId) {
          e.preventDefault();
          for (const track of tracks) {
            const clip = track.clips.find((c) => c.id === selectedClipId);
            if (clip) {
              setClipboardClip(JSON.parse(JSON.stringify(clip)));
              break;
            }
          }
        }
        return;
      }

      // Paste: Ctrl+V
      if (isCtrl && e.key === 'v') {
        if (clipboardClip) {
          e.preventDefault();
          const clipData = clipboardClip;
          const targetTrackId = selectedTrackId ?? tracks[0]?.id;
          if (targetTrackId) {
            const newClip: Clip = {
              ...clipData,
              id: `clip_paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              startFrame: Math.round(playheadPosition * projectFps),
            };
            addClip(targetTrackId, newClip);
          }
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          isPlaying ? pause() : play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, playheadPosition - 1 / projectFps));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(playheadPosition + 1 / projectFps);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            e.preventDefault();
            removeClip(selectedClipId);
          }
          break;
        case 's':
          if (isCtrl) {
            e.preventDefault();
            saveProject();
          } else if (selectedClipId) {
            e.preventDefault();
            splitClip(selectedClipId, playheadPosition);
          }
          break;
        case 'f':
          if (selectedClipId) {
            e.preventDefault();
            addFreezeFrame(selectedClipId, playheadPosition);
          }
          break;
        case '\\':
          e.preventDefault();
          setCompareMode((prev) => !prev);
          break;
        case 'Escape':
          handleClose();
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playheadPosition, selectedClipId, handleClose, undo, redo, tracks, addClip, projectFps, clipboardClip, setClipboardClip, selectedTrackId]);

  const selectedClip = useNLEStore((s) => s.getSelectedClip());

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#1a1a1a] flex flex-col">
      {/* Top Bar */}
      <div className="h-11 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={handleClose}
          className="text-[#999] hover:text-white text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex-1 text-center">
          <input
            type="text"
            value={projectName}
            onChange={(e) => useNLEStore.setState({ projectName: e.target.value, isDirty: true })}
            className="bg-transparent text-white text-sm text-center border-b border-transparent hover:border-[#444] focus:border-[#3b82f6] outline-none px-2 py-0.5"
          />
          <span className="text-[#666] text-xs ml-2">
            {isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="text-[#999] hover:text-white text-sm disabled:opacity-30 p-1"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l5 5m-5-5l5-5" />
            </svg>
          </button>
          {/* Redo */}
          <button
            onClick={redo}
            disabled={!canRedo}
            className="text-[#999] hover:text-white text-sm disabled:opacity-30 p-1"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-5 5m5-5l-5-5" />
            </svg>
          </button>

          <button
            onClick={() => setCompareMode((prev) => !prev)}
            className={`text-sm flex items-center gap-1 border rounded px-2 py-1 ${
              compareMode
                ? 'text-[#3b82f6] border-[#3b82f6]/50 bg-[#3b82f6]/10'
                : 'text-[#999] border-[#333] hover:border-[#555] hover:text-white'
            }`}
            title="Toggle Before/After (\\)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-3M16 3l5 5-5 5" />
            </svg>
            Compare
          </button>
          <button
            onClick={() => {
              const firstTrack = tracks[0];
              if (firstTrack) {
                setActivePanel('assets');
              }
            }}
            className="text-[#999] hover:text-white text-sm flex items-center gap-1 border border-[#333] rounded px-2 py-1 hover:border-[#555]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Clip
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="text-[#999] hover:text-white text-sm disabled:opacity-30"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm px-3 py-1 rounded"
          >
            Export
          </button>
        </div>
      </div>

      {/* Main content: LeftSidebar + AssetsPanel + Preview + Inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Far-left icon sidebar */}
        <LeftSidebar activePanel={activePanel} onPanelChange={setActivePanel} />

        {/* Left panel (context-dependent on sidebar selection) */}
        {activePanel === 'assets' && (
          <AssetsPanel
            isOpen={true}
            coverPhoto={photo}
          />
        )}
        {activePanel === 'adjust' && (
          <AdjustPanel />
        )}
        {activePanel === 'text' && (
          <TextPanel />
        )}
        {activePanel === 'elements' && (
          <ElementsPanel />
        )}
        {activePanel === 'effects' && (
          <EffectsBrowserPanel />
        )}
        {activePanel === 'transitions' && (
          <TransitionsPanel />
        )}
        {activePanel === 'presets' && (
          <PresetsPanel />
        )}
        {activePanel === 'settings' && (
          <SettingsPanel />
        )}

        {/* Center preview area */}
        <div className="flex-1 flex items-center justify-center bg-black">
          {clipAnalysis && (
            <PreviewArea
              sourcePath={activeClip?.sourcePath ?? clipAnalysis.source_path}
              proxyPath={activeClip?.proxyPath}
              activeClip={activeClip}
              additionalClips={activeClips.length > 1 ? activeClips.slice(1) : undefined}
              photoId={photo.id}
              isPlaying={isPlaying}
              playheadPosition={playheadPosition}
              clipTimeOffset={activeClip ? activeClip.startFrame / projectFps : 0}
              clipKeyframes={activeClip?.keyframes ?? {}}
              clipEffects={activeClip?.effects}
              clipTransform={activeClip?.transform}
              clipSpeed={activeClip?.speed}
              clipInPoint={activeClip?.inPoint}
              compareMode={compareMode}
              compareRatio={compareRatio}
              setCompareRatio={setCompareRatio}
              compareDragging={compareDragging}
              onSeek={seek}
              onPlay={play}
              onPause={pause}
              duration={clipAnalysis.duration}
              projectFps={projectFps}
              tracks={tracks}
              projectWidth={projectWidth}
              projectHeight={projectHeight}
            />
          )}
        </div>

        {/* Right inspector panel */}
        <InspectorPanel />
      </div>

      {/* Timeline */}
      <Timeline />

      {/* Export dialog */}
      {isExportDialogOpen && (
        <ExportDialog onClose={() => setExportDialogOpen(false)} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Preview Area
// ---------------------------------------------------------------------------

interface PreviewAreaProps {
  sourcePath: string;
  proxyPath?: string;
  additionalClips?: Clip[];
  activeClip?: Clip;
  photoId: string | number;
  isPlaying: boolean;
  playheadPosition: number;
  clipTimeOffset: number;
  clipKeyframes: Record<string, import('@/types/nle').Keyframe[]>;
  clipEffects?: import('@/types/nle').ClipEffects;
  clipTransform?: import('@/types/nle').ClipTransform;
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
  tracks: import('@/types/nle').Track[];
  projectWidth?: number;
  projectHeight?: number;
}

const PreviewArea: React.FC<PreviewAreaProps> = ({
  sourcePath, proxyPath, additionalClips, activeClip, photoId, isPlaying, playheadPosition, clipTimeOffset, clipKeyframes,
  clipEffects, clipTransform, clipSpeed, clipInPoint,
  compareMode, compareRatio, setCompareRatio, compareDragging,
  onSeek, onPlay, onPause, duration, projectFps, tracks,
  projectWidth = 1920, projectHeight = 1080,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const transitionVideoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<WebGLVideoRenderer | null>(null);
  const additionalVideoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const clipAudioEls = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  const decodersRef = useRef<Map<string, VideoFrameDecoder>>(new Map());
  const [decodedFrame, setDecodedFrame] = useState<VideoFrame | null>(null);

  const targetSeekTimeRef = useRef<number | null>(null);
  const additionalSeekTargets = useRef<Map<string, number>>(new Map());
  const transitionSeekTarget = useRef<number | null>(null);

  const activeClipIdRef = React.useRef<string | null>(null);
  const transitionClipIdRef = React.useRef<string | null>(null);

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

  // Cleanup decoders on unmount
  useEffect(() => {
    return () => {
      decodersRef.current.forEach((d) => d.destroy());
      decodersRef.current.clear();
      setDecodedFrame((prev) => {
        prev?.close();
        return null;
      });
    };
  }, []);

  // Scrubbing frame decoder sync
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

  // Initialize WebGL Renderer
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

  // --- Transition state detection ---
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

  const videoUrl = `${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(proxyPath || sourcePath)}`;

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

  // Unified rendering function
  const renderWebGL = useCallback(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const video = decodedFrame || videoRef.current;
    if (!renderer || !canvas || !video) return;

    // Ensure canvas dimensions match project settings
    if (canvas.width !== projectWidth || canvas.height !== projectHeight) {
      canvas.width = projectWidth;
      canvas.height = projectHeight;
    }

    renderer.clear();

    if (transitionState.active) {
      const p = transitionState.progress;
      const t = transitionState.type;

      let baseOpacity = currentTransform.opacity;
      let baseTranslateX = currentTransform.x;
      let baseTranslateY = currentTransform.y;

      if (t === 'crossfade' || t === 'dissolve') {
        baseOpacity = (1 - p) * currentTransform.opacity;
      } else if (t === 'slide-left') {
        baseTranslateX = currentTransform.x - p * projectWidth;
      } else if (t === 'slide-right') {
        baseTranslateX = currentTransform.x + p * projectWidth;
      } else if (t === 'wipe-left') {
        baseTranslateX = currentTransform.x + p * projectWidth;
      } else if (t === 'wipe-right') {
        baseTranslateX = currentTransform.x - p * projectWidth;
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
          nextOpacity = p * transitionState.nextClip.transform.opacity;
        } else if (t === 'slide-left') {
          nextTranslateX = transitionState.nextClip.transform.x + (1 - p) * projectWidth;
        } else if (t === 'slide-right') {
          nextTranslateX = transitionState.nextClip.transform.x - (1 - p) * projectWidth;
        } else if (t === 'wipe-left') {
          nextTranslateX = transitionState.nextClip.transform.x - (1 - p) * projectWidth;
        } else if (t === 'wipe-right') {
          nextTranslateX = transitionState.nextClip.transform.x + (1 - p) * projectWidth;
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

        // Before (no effects) - Left Side
        gl.scissor(0, 0, splitX, projectHeight);
        renderer.render(video, DEFAULT_EFFECTS, currentTransform, projectWidth, projectHeight);

        // After (with effects) - Right Side
        gl.scissor(splitX, 0, projectWidth - splitX, projectHeight);
        renderer.render(video, effects, currentTransform, projectWidth, projectHeight);

        gl.disable(gl.SCISSOR_TEST);
      } else {
        renderer.render(video, effects, currentTransform, projectWidth, projectHeight);
      }
    }

    // Render additional tracks
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

  // Seek all active video elements to the correct time based on the playhead, safely queued to prevent decoder freeze
  useEffect(() => {
    // 1. Primary video
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

    // 2. Additional videos
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

    // 3. Transition video
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

  // Listener to process queued seeks for the main video
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

  // Playback drawing loop
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

  // Render on manual position or parameter changes
  useEffect(() => {
    renderWebGL();
  }, [playheadPosition, renderWebGL]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#111]">
      {/* 1. Video viewport */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-0 relative flex items-center justify-center overflow-hidden"
      >
        {/* WebGL Canvas */}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain bg-black"
          style={{
            aspectRatio: `${projectWidth}/${projectHeight}`,
            transform: previewZoom === 'fit' ? undefined : `scale(${previewZoom / 100})`,
            transformOrigin: 'center center',
          }}
        />

        {/* Compare divider line */}
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

        {/* Compare labels */}
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

      {/* Hidden video elements for source playback */}
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

      {/* Transition Overlay */}
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

      {/* Additional tracks */}
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

      {/* 2. Control bar */}
      <div className="h-11 bg-[#161616] border-t border-[#252525] flex items-center justify-between px-4 shrink-0 z-10">
        {/* Left side: alignment box */}
        <div className="w-24 shrink-0" />

        {/* Center: Playback controls */}
        <div className="flex items-center gap-3">
          {/* Step back */}
          <button onClick={handleStepBack} className="text-[#999] hover:text-white p-1 transition-colors" title="Previous frame">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Play/Pause */}
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

          {/* Step forward */}
          <button onClick={handleStepForward} className="text-[#999] hover:text-white p-1 transition-colors" title="Next frame">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Timecode */}
          <span className="text-[#999] text-xs font-mono tabular-nums ml-2 select-none">
            {formatTimecode(playheadPosition)} / {formatTimecode(videoDuration)}
          </span>
        </div>

        {/* Right side: zoom & fullscreen */}
        <div className="flex items-center gap-2">
          {/* Fit dropdown */}
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

          {/* Fullscreen */}
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

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export default VideoEditorMode;
