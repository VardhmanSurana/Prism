import React from 'react';

interface ClipDragLayerProps {
  dragState: any;
  pixelsPerSec: number;
  projectFps: number;
}

export const ClipDragLayer: React.FC<ClipDragLayerProps> = ({ dragState, pixelsPerSec, projectFps }) => {
  if (!dragState || dragState.type !== 'move') return null;

  const left = (dragState.currentStart / projectFps) * pixelsPerSec;
  const width = ((dragState.clip.endFrame - dragState.clip.startFrame) / projectFps) * pixelsPerSec;

  return (
    <div
      className="absolute top-2 bottom-2 rounded-md bg-white/20 border-2 border-dashed border-white/50 pointer-events-none z-50 mix-blend-screen"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: 0, // This needs to be relative to the track, handled in TrackLanes usually
        height: '64px' // Approximate track height
      }}
    />
  );
};
