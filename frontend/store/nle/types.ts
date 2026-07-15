import { NLEProject, Track, Clip, ClipEffects, ClipTransform, Transition, VideoClipAnalysis, Keyframe, Bookmark } from '@/types/nle';
export * from '@/types/nle';

export interface ProjectAsset {
  id: number;
  path: string;
  filename?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  type: 'video' | 'image' | 'audio';
  thumbnailUrl?: string;
}

export interface NLEStore {
  // Project
  projectId: number | null;
  projectName: string;
  projectWidth: number;
  projectHeight: number;
  projectFps: number;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;

  // Timeline
  tracks: Track[];
  duration: number;
  playheadPosition: number;
  zoomLevel: number;
  scrollOffset: number;

  // Selection
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // Playback
  isPlaying: boolean;

  // Preview
  previewFrameUrl: string | null;

  // UI
  isExportDialogOpen: boolean;
  snapEnabled: boolean;
  bookmarks: Bookmark[];
  clipboardClip: Clip | null;

  // Project assets (videos/images/audio imported for this project)
  projectAssets: ProjectAsset[];

  // Undo/Redo history
  _history: Track[][];
  _historyIndex: number;

  // ---- Actions ----
  // Project
  loadProject: (project: NLEProject) => void;
  saveProject: () => Promise<void>;
  createProject: (photoId: number, photoPath: string, name?: string) => Promise<number>;

  // Timeline mutations
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartFrame: number, newTrackId?: string) => void;
  splitClip: (clipId: string, atTime: number) => void;
  trimClip: (clipId: string, side: 'in' | 'out', newFrame: number) => void;

  // Clip properties
  setClipSpeed: (clipId: string, speed: number) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  setClipMuted: (clipId: string, muted: boolean) => void;
  setClipEffects: (clipId: string, effects: Partial<ClipEffects>) => void;
  setClipFadeIn: (clipId: string, duration: number) => void;
  setClipFadeOut: (clipId: string, duration: number) => void;
  setClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
  setClipTransition: (clipId: string, transition: Transition | undefined) => void;
  setClipKeyframes: (clipId: string, property: string, keyframes: Keyframe[]) => void;
  addFreezeFrame: (clipId: string, atTime: number) => void;

  // Track actions
  addTrack: (type: 'video' | 'audio' | 'text') => void;
  removeTrack: (trackId: string) => void;
  reorderTrack: (sourceTrackId: string, targetTrackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLocked: (trackId: string) => void;
  selectTrack: (trackId: string | null) => void;
  renameTrack: (trackId: string, name: string) => void;

  // Multi-clip
  addClipFromLibrary: (trackId: string, photo: { id: number; path: string; filename?: string; duration?: number; width?: number; height?: number; fps?: number }) => Promise<void>;

  // Playback
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;

  // Selection
  selectClip: (clipId: string | null) => void;

  // UI
  setExportDialogOpen: (open: boolean) => void;
  setZoomLevel: (level: number) => void;
  toggleSnap: () => void;
  setClipboardClip: (clip: Clip | null) => void;

  // Bookmarks
  addBookmark: (label?: string, color?: string) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Bookmark>) => void;

  // Link / Unlink clips
  linkClips: (clipIdA: string, clipIdB: string) => void;
  unlinkClip: (clipId: string) => void;

  // Subtitles
  generateSubtitles: (trackId: string, sourcePath: string) => Promise<void>;

  // Project assets
  addProjectAsset: (asset: ProjectAsset) => void;
  removeProjectAsset: (assetId: number) => void;

  // Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Computed
  getSelectedClip: () => Clip | null;
  getTimelineDuration: () => number;
  toProjectJson: () => Record<string, unknown>;
}
