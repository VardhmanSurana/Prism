import { Clip, Track, TransitionType, Effect } from '@/store/videoEditorStore';
import { Photo } from '@/types';

export interface VideoEditorProps {
  photo: Photo;
  photos?: Photo[];
  onClose: () => void;
}

export interface TopBarProps {
  onClose: () => void;
}

export interface TimelineProps {
  tracks: Track[];
  duration: number;
  currentTime: number;
  zoom: number;
  selectedClipId: string | null;
  onSeek: (time: number) => void;
  onClipSelect: (clipId: string | null) => void;
  onClipUpdate: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  onClipSplit: (trackId: string, clipId: string, time: number) => void;
  onClipDelete: (trackId: string, clipId: string) => void;
}

export interface TrackRowProps {
  track: Track;
  duration: number;
  zoom: number;
  selectedClipId: string | null;
  onClipSelect: (clipId: string | null) => void;
  onClipUpdate: (clipId: string, updates: Partial<Clip>) => void;
  onClipSplit: (clipId: string, time: number) => void;
  onClipDelete: (clipId: string) => void;
}

export interface ClipProps {
  clip: Clip;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
  onTrimStart: (delta: number) => void;
  onTrimEnd: (delta: number) => void;
  onDrag: (newStartTime: number) => void;
}

export interface VideoPreviewProps {
  videoSrc: string;
  currentTime: number;
  isPlaying: boolean;
  tracks: Track[];
  duration: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
}

export interface EditorSidebarProps {
  activeTool: SidebarTool;
  onToolChange: (tool: SidebarTool) => void;
}

export type SidebarTool = 'media' | 'canvas' | 'text' | 'video_files' | 'audio' | 'photos' | 'records' | 'subtitles' | 'effects' | 'transitions';

export interface MediaPanelProps {
  onSelectMedia: (path: string, duration: number) => void;
}

export interface TextPanelProps {
  selectedClip: Clip | null;
  onUpdate: (updates: Partial<Clip>) => void;
}

export interface AudioPanelProps {
  tracks: Track[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
}

export interface SubtitlesPanelProps {
  tracks: Track[];
  onAddSubtitle: (trackId: string, clip: Clip) => void;
  onUpdateSubtitle: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  onDeleteSubtitle: (trackId: string, clipId: string) => void;
  videoPath: string;
}

export interface EffectsPanelProps {
  selectedClip: Clip | null;
  onUpdate: (updates: Partial<Clip>) => void;
}

export interface TransitionsPanelProps {
  selectedClip: Clip | null;
  onUpdate: (updates: Partial<Clip>) => void;
}
