/**
 * NLE (Non-Linear Editor) types for Prism video editing.
 */

export interface NLEProject {
  id: number;
  name: string;
  width: number;
  height: number;
  fps: number;
  cover_photo_id?: number;
  project_json?: TimelineState;
  created_at: string;
  updated_at: string;
}

export interface TimelineState {
  tracks: Track[];
  duration: number;
  playheadPosition: number;
  zoomLevel: number;
  scrollOffset: number;
  projectAssets?: import('@/store/nleStore').ProjectAsset[];
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  muted: boolean;
  solo: boolean;
  visible: boolean;
  locked: boolean;
  color?: string;
  clips: Clip[];
}

export interface ClipTransform {
  x: number;       // position offset (pixels from center)
  y: number;
  scaleX: number;  // scale factor (1.0 = 100%)
  scaleY: number;
  rotation: number; // degrees
  opacity: number;  // 0-1
}

export type KeyframeProperty = 'opacity' | 'scaleX' | 'scaleY' | 'rotation' | 'volume' | 'x' | 'y';

export interface BezierCP {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  t: number; // time in seconds relative to clip start
  v: number;
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierCP?: BezierCP;
}

export interface Clip {
  id: string;
  sourceId: number;
  sourcePath: string;
  proxyPath?: string;
  sourceDuration: number;
  // Timeline position
  startFrame: number;
  durationFrames: number;
  // Source trim
  inPoint: number;
  outPoint: number;
  // Playback
  speed: number;
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  // Visual
  effects: ClipEffects;
  transform: ClipTransform;
  // Keyframes (property name → sorted keyframes array)
  keyframes: Record<string, Keyframe[]>;
  // Text track specific
  text?: TextOverlay;
  // Transition out (to next clip on same track)
  transition?: Transition;
  // Linked clips (clips that move together)
  linkedId?: string;
}

export interface Transition {
  type: 'crossfade' | 'wipe-left' | 'wipe-right' | 'dissolve' | 'slide-left' | 'slide-right';
  duration: number;  // in seconds
}

export interface ClipEffects {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  vignette: number;
  noiseReduction: number;
}

export interface TextOverlay {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  x: number;
  y: number;
  start: number;
  end: number;
}

export const DEFAULT_EFFECTS: ClipEffects = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  vignette: 0,
  noiseReduction: 0,
};

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
};

export function isDefaultEffects(e: ClipEffects): boolean {
  return Object.values(e).every(v => v === 0);
}

export function isDefaultTransform(t: ClipTransform): boolean {
  return t.x === 0 && t.y === 0 && t.scaleX === 1 && t.scaleY === 1
    && t.rotation === 0 && t.opacity === 1;
}

export interface VideoClipAnalysis {
  clip_id: number;
  photo_id?: number;
  source_path: string;
  proxy_path?: string;
  duration: number;
  width: number;
  height: number;
  fps?: number;
  codec?: string;
  has_audio: boolean;
  proxy_status: string;
}

export interface Bookmark {
  id: string;
  time: number;
  label: string;
  color: string;
}

export const BOOKMARK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899'] as const;
