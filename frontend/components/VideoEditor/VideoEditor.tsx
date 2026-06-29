import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useVideoEditorStore } from '@/store/videoEditorStore';
import { VideoEditorProps } from './types';
import { TopBar } from './TopBar';

const Timeline = React.lazy(() => import('./Timeline/Timeline').then(m => ({ default: m.Timeline })));
const VideoPreview = React.lazy(() => import('./Preview/VideoPreview').then(m => ({ default: m.VideoPreview })));
const EditorSidebar = React.lazy(() => import('./Sidebar/EditorSidebar').then(m => ({ default: m.EditorSidebar })));
const TransportControls = React.lazy(() => import('./Timeline/TransportControls').then(m => ({ default: m.TransportControls })));

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-white/5 border-t-white/40 rounded-full animate-spin" />
  </div>
);

export const VideoEditor: React.FC<VideoEditorProps> = ({ photo, photos, onClose }) => {
  const openEditor = useVideoEditorStore((s) => s.openEditor);
  const closeEditor = useVideoEditorStore((s) => s.closeEditor);
  const project = useVideoEditorStore((s) => s.project);
  const setPlaying = useVideoEditorStore((s) => s.setPlaying);
  const setCurrentTime = useVideoEditorStore((s) => s.setCurrentTime);

  useEffect(() => {
    openEditor(photo.path, photo.duration || 0);
    return () => closeEditor();
  }, [photo.path, photo.duration, openEditor, closeEditor]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      setPlaying(!useVideoEditorStore.getState().project?.isPlaying);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [setPlaying, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!project) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#050505] overflow-hidden"
    >
      <TopBar onClose={onClose} />

      <div className="flex-1 flex min-w-0 overflow-hidden">
        <React.Suspense fallback={<LoadingFallback />}>
          <EditorSidebar activeTool="media" onToolChange={() => {}} />
        </React.Suspense>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <React.Suspense fallback={<LoadingFallback />}>
            <VideoPreview
              videoSrc={photo.path}
              currentTime={project.currentTime}
              isPlaying={project.isPlaying}
              tracks={project.tracks}
              duration={project.duration}
              onTimeUpdate={setCurrentTime}
              onSeek={setCurrentTime}
            />
          </React.Suspense>
        </div>
      </div>

      <div className="border-t border-white/5">
        <React.Suspense fallback={<LoadingFallback />}>
          <TransportControls
            isPlaying={project.isPlaying}
            currentTime={project.currentTime}
            duration={project.duration}
            onPlayPause={() => setPlaying(!project.isPlaying)}
            onSeek={setCurrentTime}
          />
        </React.Suspense>
      </div>

      <div className="h-[200px] border-t border-white/5 shrink-0 overflow-hidden">
        <React.Suspense fallback={<LoadingFallback />}>
          <Timeline
            tracks={project.tracks}
            duration={project.duration}
            currentTime={project.currentTime}
            zoom={project.zoom}
            selectedClipId={project.selectedClipId}
            onSeek={setCurrentTime}
            onClipSelect={useVideoEditorStore.getState().selectClip}
            onClipUpdate={useVideoEditorStore.getState().updateClip}
            onClipSplit={useVideoEditorStore.getState().splitClip}
            onClipDelete={(trackId, clipId) => useVideoEditorStore.getState().removeClip(trackId, clipId)}
          />
        </React.Suspense>
      </div>
    </motion.div>
  );
};
