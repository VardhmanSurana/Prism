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
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Layers,
  SplitSquareHorizontal,
  Plus,
  Save,
  Download,
  Video,
  Loader2,
} from 'lucide-react';

interface VideoEditorModeProps {
  photo: Photo;
  onClose: () => void;
}

/**
 * VideoEditorMode - Renders video editor mode.
 */
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

  /**
   * canUndo - Performs can undo.
   */
  const canUndo = useNLEStore(s => s.canUndo());
  /**
   * canRedo - Performs can redo.
   */
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
        /**
         * hasClips - Performs has clips.
         */
        const hasClips = state.tracks.some((t) => t.clips.length > 0);
        if (state.tracks.length > 0 && !hasClips) {
          // Find the first video track (not text/audio) to place the clip
          /**
           * videoTrack - Performs video track.
           */
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
    /**
     * timer - Performs timer.
     */
    const timer = setInterval(() => {
      saveProject();
    }, 30000);
    return () => clearInterval(timer);
  }, [isDirty, saveProject]);

  // Auto-save on Ctrl+S
  /**
   * handleSave - Handles save.
   */
  const handleSave = useCallback(() => {
    saveProject();
  }, [saveProject]);

  /**
   * handleClose - Handles close.
   */
  const handleClose = useCallback(() => {
    if (isDirty) saveProject();
    onClose();
  }, [isDirty, saveProject, onClose]);

  /**
   * handleExport - Handles export.
   */
  const handleExport = useCallback(() => {
    setExportDialogOpen(true);
  }, [setExportDialogOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    /**
     * handleKeyDown - Handles key down.
     */
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
      <div className="fixed inset-0 z-[100] bg-[#151312] flex flex-col items-center justify-center gap-6 select-none">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-[#e5a93c]/15 border border-[#e5a93c]/30 flex items-center justify-center shadow-[0_0_24px_rgba(229,169,60,0.2)]">
            <Video className="w-7 h-7 text-[#e5a93c] animate-pulse" />
          </div>
          <div className="absolute -inset-3 border border-[#e5a93c]/15 rounded-3xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[#f5f0ed] text-sm font-semibold tracking-wide">Initializing Video Editor</p>
          <p className="text-zinc-400 text-xs">Analyzing audio-visual tracks and setting up timeline...</p>
        </div>
        <div className="w-48 h-1 bg-[#1d1b1a] border border-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#e5a93c]/20 via-[#e5a93c] to-[#e5a93c]/20 animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#151312] text-[#f5f0ed] flex flex-col select-none">
      {/* Top Bar */}
      <div className="h-12 bg-[#151312] border-b border-white/10 flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={handleClose}
          className="text-zinc-400 hover:text-[#f5f0ed] text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div className="flex-1 text-center flex items-center justify-center gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => useNLEStore.setState({ projectName: e.target.value, isDirty: true })}
            className="bg-transparent text-[#f5f0ed] text-sm text-center border-b border-transparent hover:border-white/20 focus:border-[#e5a93c] outline-none px-2 py-0.5 transition-colors font-medium tracking-wide"
          />
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            isSaving
              ? 'text-amber-400 bg-amber-400/10'
              : isDirty
              ? 'text-amber-400/80 bg-amber-400/5'
              : 'text-emerald-400 bg-emerald-400/10'
          }`}>
            {isSaving ? 'Saving...' : isDirty ? '● Unsaved' : 'Saved'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="text-zinc-400 hover:text-white disabled:opacity-20 p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          {/* Redo */}
          <button
            onClick={redo}
            disabled={!canRedo}
            className="text-zinc-400 hover:text-white disabled:opacity-20 p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <button
            onClick={toggleMulticamMode}
            className={`text-[11px] font-medium flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 transition-all cursor-pointer ${
              isMulticamMode
                ? 'text-[#34d399] border-[#34d399]/40 bg-[#34d399]/15'
                : 'text-zinc-400 border-white/10 hover:border-white/20 hover:text-white hover:bg-white/5'
            }`}
            title="Toggle Multi-Cam Mode"
          >
            <Layers size={13} />
            Multi-Cam
          </button>

          <button
            onClick={() => setCompareMode((prev) => !prev)}
            className={`text-[11px] font-medium flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 transition-all cursor-pointer ${
              compareMode
                ? 'text-[#e5a93c] border-[#e5a93c]/40 bg-[#e5a93c]/15'
                : 'text-zinc-400 border-white/10 hover:border-white/20 hover:text-white hover:bg-white/5'
            }`}
            title="Toggle Before/After (\\)"
          >
            <SplitSquareHorizontal size={13} />
            Compare
          </button>

          <button
            onClick={() => {
              const firstTrack = tracks[0];
              if (firstTrack) {
                setActivePanel('assets');
              }
            }}
            className="text-zinc-400 hover:text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
          >
            <Plus size={13} />
            Add Clip
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="text-zinc-400 hover:text-white text-[11px] font-medium disabled:opacity-20 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>

          <button
            onClick={handleExport}
            className="bg-[#e5a93c] hover:bg-[#d4982f] text-[#151312] text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-[#e5a93c]/20 cursor-pointer"
          >
            <Download size={13} strokeWidth={2.5} />
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
