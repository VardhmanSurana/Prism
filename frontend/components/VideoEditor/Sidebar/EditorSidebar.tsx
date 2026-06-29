import React, { Suspense } from 'react';
import {
  FolderOpen,
  Type,
  Music,
  Subtitles,
  Sparkles,
  ArrowRightLeft,
  Square,
  Film,
  Image,
  Mic,
  Plus,
} from 'lucide-react';
import { EditorSidebarProps, SidebarTool } from '../types';

const MediaPanel = React.lazy(() => import('./MediaPanel').then(m => ({ default: m.MediaPanel })));
const TextPanel = React.lazy(() => import('./TextPanel').then(m => ({ default: m.TextPanel })));
const AudioPanel = React.lazy(() => import('./AudioPanel').then(m => ({ default: m.AudioPanel })));
const SubtitlesPanel = React.lazy(() => import('./SubtitlesPanel').then(m => ({ default: m.SubtitlesPanel })));
const EffectsPanel = React.lazy(() => import('./EffectsPanel').then(m => ({ default: m.EffectsPanel })));
const TransitionsPanel = React.lazy(() => import('./TransitionsPanel').then(m => ({ default: m.TransitionsPanel })));

const TOOL_TABS: { id: SidebarTool; icon: React.ReactNode; label: string }[] = [
  { id: 'media', icon: <FolderOpen size={18} strokeWidth={1.5} />, label: 'Uploads' },
  { id: 'canvas', icon: <Square size={18} strokeWidth={1.5} />, label: 'Canvas' },
  { id: 'text', icon: <Type size={18} strokeWidth={1.5} />, label: 'Text' },
  { id: 'video_files', icon: <Film size={18} strokeWidth={1.5} />, label: 'Videos' },
  { id: 'audio', icon: <Music size={18} strokeWidth={1.5} />, label: 'Audios' },
  { id: 'photos', icon: <Image size={18} strokeWidth={1.5} />, label: 'Photos' },
  { id: 'records', icon: <Mic size={18} strokeWidth={1.5} />, label: 'Records' },
  { id: 'subtitles', icon: <Subtitles size={18} strokeWidth={1.5} />, label: 'Subtitles' },
];

const PanelFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-white/5 border-t-white/30 rounded-full animate-spin" />
  </div>
);

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ activeTool, onToolChange }) => {
  return (
    <div className="flex h-full shrink-0 relative z-30">
      {/* Icon strip with labels */}
      <div className="w-[64px] shrink-0 bg-[#070709]/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-4 space-y-1 h-full">
        <div className="w-[44px] h-[44px] rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-all mb-4 hover:scale-105 active:scale-95">
          <Plus size={16} />
        </div>
        {TOOL_TABS.map((tab) => {
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onToolChange(isActive ? null as any : tab.id)}
              className={`group w-full flex flex-col items-center gap-1 py-2 px-1 transition-all duration-200 rounded-lg relative ${
                isActive
                  ? 'text-white bg-white/[0.06]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <div className={`transition-transform duration-200 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                {tab.icon}
              </div>
              <span className="text-[9px] font-medium tracking-wide leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      {activeTool && (
        <div className="w-[280px] shrink-0 bg-[#070709]/60 backdrop-blur-xl border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-5 py-4 shrink-0 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">
              {TOOL_TABS.find(t => t.id === activeTool)?.label}
            </h2>
            <button
              onClick={() => onToolChange(null as any)}
              className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <Suspense fallback={<PanelFallback />}>
              <PanelContent activeTool={activeTool} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

import { useVideoEditorStore, Effect } from '@/store/videoEditorStore';

function PanelContent({ activeTool }: { activeTool: SidebarTool }) {
  const project = useVideoEditorStore((s) => s.project);
  const selectClip = useVideoEditorStore((s) => s.selectClip);
  const addClip = useVideoEditorStore((s) => s.addClip);
  const addTrack = useVideoEditorStore((s) => s.addTrack);
  const updateClip = useVideoEditorStore((s) => s.updateClip);
  const updateTrack = useVideoEditorStore((s) => s.updateTrack);
  const removeClip = useVideoEditorStore((s) => s.removeClip);
  const setCurrentTime = useVideoEditorStore((s) => s.setCurrentTime);

  const selectedClip = project?.tracks
    .flatMap(t => t.clips)
    .find(c => c.id === project?.selectedClipId) ?? null;

  switch (activeTool) {
    case 'media':
      return (
        <MediaPanel
          onSelectMedia={(path, duration) => {
            const videoTrack = project?.tracks.find(t => t.type === 'video');
            if (videoTrack) {
              const clip = {
                id: 'clip_' + Date.now(),
                type: 'video' as const,
                sourcePath: path,
                sourceDuration: duration,
                startTime: 0,
                duration,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                effects: [] as Effect[],
              };
              addClip(videoTrack.id, clip);
            }
          }}
        />
      );
    case 'canvas':
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full min-h-[300px] select-none">
          <Square className="w-10 h-10 text-white/20 mb-4 animate-pulse" strokeWidth={1.2} />
          <h3 className="text-xs font-semibold text-white/80 mb-2">Canvas Settings</h3>
          <p className="text-[11px] text-white/40 max-w-[200px] leading-relaxed">
            Customize aspect ratio, background gradients, and export boundaries.
          </p>
        </div>
      );
    case 'text':
      return (
        <TextPanel
          selectedClip={selectedClip}
          onUpdate={(updates) => {
            if (!project || !project.selectedClipId) return;
            const track = project.tracks.find(t => t.clips.some(c => c.id === project.selectedClipId));
            if (track) updateClip(track.id, project.selectedClipId, updates);
          }}
        />
      );
    case 'video_files':
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full min-h-[300px] select-none">
          <Film className="w-10 h-10 text-white/20 mb-4 animate-pulse" strokeWidth={1.2} />
          <h3 className="text-xs font-semibold text-white/80 mb-2">Videos Library</h3>
          <p className="text-[11px] text-white/40 max-w-[200px] leading-relaxed">
            Access stock footage, overlays, and background video materials.
          </p>
        </div>
      );
    case 'audio':
      return (
        <AudioPanel
          tracks={project?.tracks ?? []}
          onVolumeChange={(trackId, volume) => updateTrack(trackId, { volume })}
          onMuteToggle={(trackId) => {
            const track = project?.tracks.find(t => t.id === trackId);
            if (track) updateTrack(trackId, { muted: !track.muted });
          }}
        />
      );
    case 'photos':
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full min-h-[300px] select-none">
          <Image className="w-10 h-10 text-white/20 mb-4 animate-pulse" strokeWidth={1.2} />
          <h3 className="text-xs font-semibold text-white/80 mb-2">Photos Library</h3>
          <p className="text-[11px] text-white/40 max-w-[200px] leading-relaxed">
            Browse stock images, graphics, patterns, and background layers.
          </p>
        </div>
      );
    case 'records':
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full min-h-[300px] select-none">
          <Mic className="w-10 h-10 text-white/20 mb-4 animate-pulse" strokeWidth={1.2} />
          <h3 className="text-xs font-semibold text-white/80 mb-2">Record Audio & Screen</h3>
          <p className="text-[11px] text-white/40 max-w-[200px] leading-relaxed">
            Record voiceovers, screen captures, or webcam directly to your timeline.
          </p>
        </div>
      );
    case 'subtitles':
      return (
        <SubtitlesPanel
          tracks={project?.tracks ?? []}
          onAddSubtitle={(trackId, clip) => addClip(trackId, clip)}
          onUpdateSubtitle={(trackId, clipId, updates) => updateClip(trackId, clipId, updates)}
          onDeleteSubtitle={(trackId, clipId) => removeClip(trackId, clipId)}
          videoPath={project?.tracks.find(t => t.type === 'video')?.clips[0]?.sourcePath ?? ''}
        />
      );
    case 'effects':
      return (
        <EffectsPanel
          selectedClip={selectedClip}
          onUpdate={(updates) => {
            if (!project || !project.selectedClipId) return;
            const track = project.tracks.find(t => t.clips.some(c => c.id === project.selectedClipId));
            if (track) updateClip(track.id, project.selectedClipId, updates);
          }}
        />
      );
    case 'transitions':
      return (
        <TransitionsPanel
          selectedClip={selectedClip}
          onUpdate={(updates) => {
            if (!project || !project.selectedClipId) return;
            const track = project.tracks.find(t => t.clips.some(c => c.id === project.selectedClipId));
            if (track) updateClip(track.id, project.selectedClipId, updates);
          }}
        />
      );
    default:
      return null;
  }
}
