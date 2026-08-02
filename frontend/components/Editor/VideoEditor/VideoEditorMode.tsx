/**
 * VideoEditorMode — Full-screen NLE overlay for video editing.
 * OpenCut-inspired layout: far-left icon sidebar, left assets panel,
 * center preview, right inspector, timeline at bottom.
 */
import React, { useEffect, useLayoutEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { API_BASE } from '@/constants';
import type { Photo } from '@/types';
import { findClipById } from '@/store/nle/helpers';
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
import { Dropdown } from '@/components/ui/Dropdown';
import { formatTimecode, getActiveVideoClips } from './editorUtils';
import { PreviewArea } from './PreviewArea';

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
    projectWidth, projectHeight, duration,
    isMulticamMode, toggleMulticamMode, switchMulticamAngle,
  } = useNLEStore();

  const canUndo = useNLEStore(s => s.canUndo());
  const canRedo = useNLEStore(s => s.canRedo());

  const activeClips = useMemo(
    () => getActiveVideoClips(tracks, playheadPosition, projectFps),
    [tracks, playheadPosition, projectFps],
  );

  const selectedClip = useMemo(
    () => (selectedClipId ? findClipById(tracks, selectedClipId) : null),
    [tracks, selectedClipId],
  );

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

    // When launched from VideoEditorFromProject, photo.path is '' (project-stub).
    // In that case the NLE store was already pre-loaded by the wrapper — skip init.
    if (!photo.path) {
      setIsLoading(false);
      return;
    }

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
          if (cancelled || !project) return;
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
        if (selectedClip) {
          e.preventDefault();
          setClipboardClip(JSON.parse(JSON.stringify(selectedClip)));
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
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          switchMulticamAngle(parseInt(e.key), playheadPosition);
          break;
        case 'Escape':
          handleClose();
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playheadPosition, selectedClipId, handleClose, undo, redo, tracks, addClip, projectFps, clipboardClip, setClipboardClip, selectedTrackId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 border border-[#3b82f6]/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#3b82f6] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="absolute -inset-4 border border-[#3b82f6]/10 rounded-2xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/90 text-sm font-medium tracking-wide">Preparing Editor</p>
          <p className="text-white/40 text-xs">Analyzing clip and loading project...</p>
        </div>
        <div className="w-48 h-0.5 bg-[#222] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#3b82f6]/0 via-[#3b82f6] to-[#3b82f6]/0 animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#1a1a1a] flex flex-col">
      {/* Top Bar */}
      <div className="h-11 bg-[#111113] border-b border-white/[0.06] flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={handleClose}
          className="text-white/50 hover:text-white text-xs flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/[0.06] transition-colors duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div            className="flex-1 text-center">
          <input
            type="text"
            value={projectName}
            onChange={(e) => useNLEStore.setState({ projectName: e.target.value, isDirty: true })}
            className="bg-transparent text-white/90 text-sm text-center border-b border-transparent hover:border-white/20 focus:border-white/40 outline-none px-2 py-0.5 transition-colors duration-150 font-medium tracking-wide"
          />
          <span className="text-white/30 text-[10px] ml-2 font-mono">
            {isSaving ? 'Saving...' : isDirty ? '● Unsaved' : 'Saved'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="text-white/40 hover:text-white disabled:opacity-20 p-1.5 rounded-md hover:bg-white/[0.06] transition-all duration-150"
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
            className="text-white/40 hover:text-white disabled:opacity-20 p-1.5 rounded-md hover:bg-white/[0.06] transition-all duration-150"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-5 5m5-5l-5-5" />
            </svg>
          </button>

          <button
            onClick={toggleMulticamMode}
            className={`text-[11px] font-medium flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 transition-all duration-150 ${
              isMulticamMode
                ? 'text-[#34d399] border-[#34d399]/30 bg-[#34d399]/10'
                : 'text-white/40 border-white/[0.08] hover:border-white/20 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
            title="Toggle Multi-Cam Mode"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Multi-Cam
          </button>

          <button
            onClick={() => setCompareMode((prev) => !prev)}
            className={`text-[11px] font-medium flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 transition-all duration-150 ${
              compareMode
                ? 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10'
                : 'text-white/40 border-white/[0.08] hover:border-white/20 hover:text-white/80 hover:bg-white/[0.04]'
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
            className="text-white/40 hover:text-white/80 text-[11px] font-medium flex items-center gap-1.5 border border-white/[0.08] rounded-md px-2.5 py-1.5 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Clip
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="text-white/40 hover:text-white/80 text-[11px] font-medium disabled:opacity-20 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-all duration-150"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            className="bg-white/90 hover:bg-white text-black text-[11px] font-semibold px-3.5 py-1.5 rounded-md transition-all duration-150"
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
          <PreviewArea
            sourcePath={activeClip?.sourcePath ?? clipAnalysis?.source_path ?? ""}
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
            duration={clipAnalysis?.duration ?? duration ?? 0}
            projectFps={projectFps}
            tracks={tracks}
            projectWidth={projectWidth}
            projectHeight={projectHeight}
          />
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

export default VideoEditorMode;
