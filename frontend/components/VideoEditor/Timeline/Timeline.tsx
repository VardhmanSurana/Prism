import React, { useCallback, useRef, useState } from 'react';
import {
  Video,
  Music,
  Type,
  Subtitles,
  Volume2,
  VolumeX,
  Trash2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { useVideoEditorStore, ClipType } from '@/store/videoEditorStore';
import type { TimelineProps } from '../types';
import { TrackRow } from './TrackRow';
import { Playhead } from './Playhead';
import { TimeRuler } from './TimeRuler';

const TRACK_WIDTH = 140;
const TRACK_HEIGHT = 72;

const TYPE_ICONS: Record<ClipType, React.FC<{ size?: number; className?: string }>> = {
  video: Video,
  audio: Music,
  text: Type,
  subtitle: Subtitles,
};

const TYPE_LABELS: Record<ClipType, string> = {
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
  subtitle: 'Subtitle',
};

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  duration,
  currentTime,
  zoom,
  selectedClipId,
  onSeek,
  onClipSelect,
  onClipUpdate,
  onClipSplit,
  onClipDelete,
}) => {
  const [showAddTrack, setShowAddTrack] = useState(false);
  const addTrackRef = useRef<HTMLDivElement>(null);
  const clipAreaRef = useRef<HTMLDivElement>(null);

  const { addTrack, updateTrack, removeTrack } = useVideoEditorStore();

  const totalWidth = duration * zoom;
  const trackAreaHeight = tracks.length * TRACK_HEIGHT;

  const handleAddTrack = useCallback(
    (type: ClipType) => {
      const name = TYPE_LABELS[type];
      addTrack(type, name);
      setShowAddTrack(false);
    },
    [addTrack],
  );

  const handleMuteToggle = useCallback(
    (trackId: string, muted: boolean) => {
      updateTrack(trackId, { muted: !muted });
    },
    [updateTrack],
  );

  const handleClipUpdate = useCallback(
    (trackId: string, clipId: string, updates: Partial<import('@/store/videoEditorStore').Clip>) => {
      onClipUpdate(trackId, clipId, updates);
    },
    [onClipUpdate],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#070709]">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Track Headers */}
        <div className="flex-shrink-0 border-r border-white/5 overflow-y-auto custom-scrollbar" style={{ width: TRACK_WIDTH }}>
          {tracks.map((track, idx) => {
            const Icon = TYPE_ICONS[track.type] || Video;
            return (
              <div
                key={track.id}
                className={`flex items-center gap-2 px-3 border-b border-white/5 ${
                  idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
                }`}
                style={{ height: TRACK_HEIGHT }}
              >
                <Icon size={14} className="text-white/40 flex-shrink-0" />
                <span className="text-xs text-white/70 truncate flex-1 min-w-0">{track.name}</span>
                <button
                  onClick={() => handleMuteToggle(track.id, track.muted)}
                  className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                  title={track.muted ? 'Unmute' : 'Mute'}
                >
                  {track.muted ? (
                    <VolumeX size={12} className="text-white/30" />
                  ) : (
                    <Volume2 size={12} className="text-white/50" />
                  )}
                </button>
                <button
                  onClick={() => removeTrack(track.id)}
                  className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                  title="Delete track"
                >
                  <Trash2 size={12} className="text-white/30 hover:text-red-400" />
                </button>
              </div>
            );
          })}

          {/* Add track button */}
          <div className="relative border-b border-white/5" style={{ height: TRACK_HEIGHT }}>
            <div ref={addTrackRef} className="absolute inset-0 flex items-center px-3">
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
              >
                <Plus size={12} />
                Add Track
                <ChevronDown size={10} className={`transition-transform ${showAddTrack ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showAddTrack && (
              <div className="absolute top-full left-0 mt-1 bg-[#1a1c24] border border-white/10 rounded-lg py-1 shadow-2xl z-50 min-w-[120px]">
                {(Object.keys(TYPE_LABELS) as ClipType[]).map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleAddTrack(type)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <Icon size={12} />
                      {TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Clip Area */}
        <div
          ref={clipAreaRef}
          className="flex-1 overflow-x-auto overflow-y-auto min-w-0 custom-scrollbar"
        >
          <div className="relative" style={{ width: totalWidth, height: trackAreaHeight }}>
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                className="absolute left-0 right-0"
                style={{ top: idx * TRACK_HEIGHT, height: TRACK_HEIGHT }}
              >
                <TrackRow
                  track={track}
                  duration={duration}
                  zoom={zoom}
                  selectedClipId={selectedClipId}
                  onClipSelect={onClipSelect}
                  onClipUpdate={(clipId, updates) => handleClipUpdate(track.id, clipId, updates)}
                  onClipSplit={(clipId, time) => onClipSplit(track.id, clipId, time)}
                  onClipDelete={(clipId) => onClipDelete(track.id, clipId)}
                />
              </div>
            ))}

            <Playhead
              currentTime={currentTime}
              zoom={zoom}
              onSeek={onSeek}
              trackHeight={trackAreaHeight}
            />
          </div>
        </div>
      </div>

      {/* Time Ruler */}
      <TimeRuler duration={duration} zoom={zoom} currentTime={currentTime} onSeek={onSeek} />
    </div>
  );
};
