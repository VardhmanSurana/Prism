/**
 * VideoEditorMode — Full-screen NLE overlay for video editing.
 * OpenCut-inspired layout: far-left icon sidebar, left assets panel,
 * center preview, right inspector, timeline at bottom.
 */
import React, { useEffect, useLayoutEffect, useCallback, useState, useMemo, useRef } from 'react';
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
            onClick={toggleMulticamMode}
            className={`text-sm flex items-center gap-1 border rounded px-2 py-1 ${
              isMulticamMode
                ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
                : 'text-[#999] border-[#333] hover:border-[#555] hover:text-white'
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
