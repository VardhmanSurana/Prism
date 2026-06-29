import React, { Suspense } from 'react';
import {
  FolderOpen,
  Type,
  Music,
  Subtitles,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { EditorSidebarProps, SidebarTool } from '../types';

const MediaPanel = React.lazy(() => import('./MediaPanel').then(m => ({ default: m.MediaPanel })));
const TextPanel = React.lazy(() => import('./TextPanel').then(m => ({ default: m.TextPanel })));
const AudioPanel = React.lazy(() => import('./AudioPanel').then(m => ({ default: m.AudioPanel })));
const SubtitlesPanel = React.lazy(() => import('./SubtitlesPanel').then(m => ({ default: m.SubtitlesPanel })));
const EffectsPanel = React.lazy(() => import('./EffectsPanel').then(m => ({ default: m.EffectsPanel })));
const TransitionsPanel = React.lazy(() => import('./TransitionsPanel').then(m => ({ default: m.TransitionsPanel })));

const TOOL_TABS: { id: SidebarTool; icon: React.ReactNode; label: string }[] = [
  { id: 'media', icon: <FolderOpen size={20} strokeWidth={1.5} />, label: 'Media' },
  { id: 'text', icon: <Type size={20} strokeWidth={1.5} />, label: 'Text' },
  { id: 'audio', icon: <Music size={20} strokeWidth={1.5} />, label: 'Audio' },
  { id: 'subtitles', icon: <Subtitles size={20} strokeWidth={1.5} />, label: 'Subtitles' },
  { id: 'effects', icon: <Sparkles size={20} strokeWidth={1.5} />, label: 'Effects' },
  { id: 'transitions', icon: <ArrowRightLeft size={20} strokeWidth={1.5} />, label: 'Transitions' },
];

const PanelFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-white/5 border-t-white/30 rounded-full animate-spin" />
  </div>
);

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ activeTool, onToolChange }) => {
  return (
    <div className="flex h-full shrink-0 relative z-30">
      <div className="w-[56px] shrink-0 bg-[var(--bg-secondary)] border-r border-white/5 flex flex-col items-center py-6 space-y-4 h-full">
        {TOOL_TABS.map((tab) => {
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onToolChange(tab.id)}
              className={`group w-[40px] h-[40px] shrink-0 flex flex-col items-center justify-center transition-all duration-300 rounded-xl relative ${
                isActive
                  ? 'text-primary'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {isActive && (
                <div className="absolute -left-[8px] top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary),0.5)]" />
              )}
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              <div className="absolute left-[64px] bg-[#1e232b] text-white px-3 py-2 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-2xl z-50 border border-white/10 whitespace-nowrap">
                <span className="text-[11px] font-bold tracking-wide">{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {activeTool && (
        <div className="w-[260px] shrink-0 bg-[var(--bg-secondary)] border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-5 py-4 shrink-0 border-b border-white/5">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/20">
              {TOOL_TABS.find(t => t.id === activeTool)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-8">
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
