import React from 'react';
import { FolderOpen, Type, Music, Plus } from 'lucide-react';
import { MediaPanelProps } from '../types';
import { useVideoEditorStore } from '@/store/videoEditorStore';
import { resolveUrl } from '@/constants';

export const MediaPanel: React.FC<MediaPanelProps> = ({ onSelectMedia }) => {
  const project = useVideoEditorStore((s) => s.project);

  const videoClip = project?.tracks.find(t => t.type === 'video')?.clips[0];
  const videoPath = videoClip?.sourcePath ?? '';

  const handleAddTextLayer = () => {
    const state = useVideoEditorStore.getState();
    const textTrack = state.project?.tracks.find(t => t.type === 'text');
    if (textTrack) {
      const clip = {
        id: 'clip_' + Date.now(),
        type: 'text' as const,
        startTime: state.project?.currentTime ?? 0,
        duration: 3,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        text: 'New Text',
        fontFamily: 'Arial',
        fontSize: 32,
        fontColor: '#ffffff',
        fontWeight: 'normal',
        textAlign: 'center' as const,
        x: 50,
        y: 50,
      };
      state.addClip(textTrack.id, clip);
    } else {
      state.addTrack('text', 'Text');
      const newState = useVideoEditorStore.getState();
      const newTextTrack = newState.project?.tracks.find(t => t.type === 'text');
      if (newTextTrack) {
        const clip = {
          id: 'clip_' + Date.now(),
          type: 'text' as const,
          startTime: newState.project?.currentTime ?? 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 0,
          speed: 1,
          text: 'New Text',
          fontFamily: 'Arial',
          fontSize: 32,
          fontColor: '#ffffff',
          fontWeight: 'normal',
          textAlign: 'center' as const,
          x: 50,
          y: 50,
        };
        state.addClip(newTextTrack.id, clip);
      }
    }
  };

  const thumbnailUrl = videoPath ? resolveUrl(`local://${videoPath}`) : '';

  return (
    <div className="space-y-6">
      {videoClip && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
            Current Video
          </label>
          <div className="rounded-lg overflow-hidden border border-white/5 bg-black/40">
            {thumbnailUrl && (
              <div className="aspect-video bg-[#0a0a0a] flex items-center justify-center">
                <video
                  src={thumbnailUrl}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                />
              </div>
            )}
            <div className="px-3 py-2">
              <p className="text-[11px] text-white/50 truncate">
                {videoPath.split('/').pop()}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {videoClip.sourceDuration ? `${Math.round(videoClip.sourceDuration)}s` : 'Unknown duration'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Add Layers
        </label>

        <button
          onClick={handleAddTextLayer}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Type size={14} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70 font-medium">Add Text Layer</p>
            <p className="text-[10px] text-white/30">Overlay text on the video</p>
          </div>
          <Plus size={14} className="text-white/20 group-hover:text-white/40 ml-auto shrink-0 transition-colors" />
        </button>

        <button
          onClick={() => onSelectMedia('', 0)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
            <Music size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70 font-medium">Add Audio</p>
            <p className="text-[10px] text-white/30">Import an audio file</p>
          </div>
          <Plus size={14} className="text-white/20 group-hover:text-white/40 ml-auto shrink-0 transition-colors" />
        </button>

        <button
          onClick={() => onSelectMedia('', 0)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
            <FolderOpen size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70 font-medium">Add from Library</p>
            <p className="text-[10px] text-white/30">Browse your media library</p>
          </div>
          <Plus size={14} className="text-white/20 group-hover:text-white/40 ml-auto shrink-0 transition-colors" />
        </button>
      </div>
    </div>
  );
};
