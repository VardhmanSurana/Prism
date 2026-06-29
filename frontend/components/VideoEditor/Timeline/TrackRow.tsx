import React from 'react';
import type { TrackRowProps } from '../types';
import { ClipItem } from './ClipItem';

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  zoom,
  selectedClipId,
  onClipSelect,
  onClipUpdate,
  onClipSplit,
  onClipDelete,
}) => {
  return (
    <div className="relative h-16 border-b border-white/5 bg-white/[0.02]">
      {track.clips.map((clip) => (
        <ClipItem
          key={clip.id}
          clip={clip}
          zoom={zoom}
          isSelected={clip.id === selectedClipId}
          onSelect={() => onClipSelect(clip.id)}
          onTrimStart={(delta) => {
            const newTrimStart = Math.max(0, clip.trimStart + delta * clip.speed);
            const newDuration = Math.max(0.1, clip.duration - delta);
            const newStartTime = Math.max(0, clip.startTime + delta);
            onClipUpdate(clip.id, {
              trimStart: newTrimStart,
              duration: newDuration,
              startTime: delta > 0 ? newStartTime : clip.startTime,
            });
          }}
          onTrimEnd={(delta) => {
            const newDuration = Math.max(0.1, clip.duration + delta);
            onClipUpdate(clip.id, { duration: newDuration });
          }}
          onDrag={(newStartTime) => {
            onClipUpdate(clip.id, { startTime: newStartTime });
          }}
        />
      ))}
    </div>
  );
};
