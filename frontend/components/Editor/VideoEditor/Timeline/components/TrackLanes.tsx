import React, { useCallback } from 'react';
import { Track, Clip, Bookmark } from '@/types/nle';
import { ClipDragLayer } from './ClipDragLayer';
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Mic, MicOff, AlignLeft } from 'lucide-react';

interface TrackLanesProps {
  tracks: Track[];
  pixelsPerSec: number;
  projectFps: number;
  selectedClipId: string | null;
  selectClip: (clipId: string | null) => void;
  timelineWidth: number;
  dragState: any;
  setDragState: (state: unknown) => void;
}

export const TrackLanes: React.FC<TrackLanesProps> = ({
  tracks,
  pixelsPerSec,
  projectFps,
  selectedClipId,
  selectClip,
  timelineWidth,
  dragState,
  setDragState
}) => {

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: Clip, trackId: string, edge?: 'left' | 'right') => {
      e.stopPropagation();
      selectClip(clip.id);

      if (edge) {
        setDragState({
          type: 'trim',
          clip,
          trackId,
          edge,
          startX: e.clientX,
          initialStart: (clip as any).startFrame,
          initialEnd: (clip as any).endFrame,
        });
      } else {
        setDragState({
          type: 'move',
          clip,
          trackId,
          startX: e.clientX,
          initialStart: (clip as any).startFrame,
        });
      }
    },
    [selectClip, setDragState]
  );

  return (
    <div className="relative min-h-[300px]">
      {tracks.map((track, trackIdx) => (
        <div key={track.id} className="relative flex min-h-[80px] bg-[#111111] border-b border-white/5">
          {/* Track Header */}
          <div className="w-48 shrink-0 bg-[#161616] border-r border-white/5 sticky left-0 z-30 flex flex-col justify-center px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/80">{track.name}</span>
            </div>
          </div>

          {/* Track Content Area */}
          <div className="flex-1 relative">
            <div className="absolute inset-0" style={{ width: Math.max(timelineWidth, 2000) }}>
              {track.clips.map((clip) => {
                const isSelected = clip.id === selectedClipId;
                const isDragging = dragState?.clip?.id === clip.id;
                const left = ((clip as any).startFrame / projectFps) * pixelsPerSec;
                const width = (((clip as any).endFrame - (clip as any).startFrame) / projectFps) * pixelsPerSec;

                return (
                  <div
                    key={clip.id}
                    onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
                    className={`absolute top-2 bottom-2 rounded-md overflow-hidden cursor-move transition-opacity ${
                      isDragging ? 'opacity-50' : 'opacity-100 hover:brightness-110'
                    } ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#111111] z-20' : 'z-10'}`}
                    style={{
                      left: `${left}px`,
                      width: `${Math.max(width, 2)}px`,
                      backgroundColor: track.type === 'video' ? '#3b82f6' : track.type === 'audio' ? '#10b981' : '#f59e0b'
                    }}
                  >
                    {/* Trim Handles */}
                    {isSelected && (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize"
                          onMouseDown={(e) => handleClipMouseDown(e, clip, track.id, 'left')}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize"
                          onMouseDown={(e) => handleClipMouseDown(e, clip, track.id, 'right')}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {dragState && dragState.type === 'move' && (
        <ClipDragLayer
          dragState={dragState}
          pixelsPerSec={pixelsPerSec}
          projectFps={projectFps}
        />
      )}
    </div>
  );
};
