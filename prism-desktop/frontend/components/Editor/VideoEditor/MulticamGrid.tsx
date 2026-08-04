/**
 * MulticamGrid.tsx — Synchronized 4-up Multi-Camera Angle Grid display.
 * Displays live camera feeds for Angle 1, Angle 2, Angle 3, and Angle 4.
 * Enables 1-click live camera angle cutting during video playback.
 */

import React from 'react';
import type { Track, Clip } from '@/types/nle';
import { API_BASE } from '@/constants';

export interface MulticamGridProps {
  tracks: Track[];
  playheadPosition: number;
  projectFps: number;
  onSelectAngle: (angle: number) => void;
  onClose: () => void;
}

interface CameraSlot {
  angle: number;
  trackName: string;
  activeClip: Clip | null;
  isVisible: boolean;
}

export const MulticamGrid: React.FC<MulticamGridProps> = ({
  tracks,
  playheadPosition,
  projectFps,
  onSelectAngle,
  onClose,
}) => {
  const videoTracks = tracks.filter((t) => t.type === 'video');

  // Map 4 camera slots (Angles 1 to 4)
  const slots: CameraSlot[] = [1, 2, 3, 4].map((angle) => {
    // Find track explicitly assigned to this angle, or fallback to track index
    const track =
      videoTracks.find((t) => t.angle === angle) ?? videoTracks[angle - 1];

    if (!track) {
      return { angle, trackName: `Cam ${angle}`, activeClip: null, isVisible: false };
    }

    const currentFrame = Math.round(playheadPosition * projectFps);
    const activeClip =
      track.clips.find(
        (c) => currentFrame >= c.startFrame && currentFrame < c.startFrame + c.durationFrames
      ) ?? null;

    return {
      angle,
      trackName: track.name || `Cam ${angle}`,
      activeClip,
      isVisible: track.visible,
    };
  });

  return (
    <div className="absolute inset-0 z-20 bg-black/90 flex flex-col p-2 border border-[#3b82f6]/40 rounded-lg shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[#252525] shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-white text-xs font-semibold tracking-wide">Multi-Cam Live Grid</span>
          <span className="text-[10px] text-[#888]">Press keys 1–4 to cut live</span>
        </div>

        <button
          onClick={onClose}
          className="text-[#777] hover:text-white text-sm p-1 transition-colors"
          title="Exit Multi-Cam Grid"
        >
          &times;
        </button>
      </div>

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 min-h-0">
        {slots.map((slot) => {
          const streamUrl = slot.activeClip
            ? `${API_BASE}/api/v1/nle/stream?path=${encodeURIComponent(
                slot.activeClip.proxyPath || slot.activeClip.sourcePath
              )}`
            : null;

          return (
            <div
              key={slot.angle}
              onClick={() => onSelectAngle(slot.angle)}
              className={`relative bg-[#0d0d0d] rounded-md border-2 overflow-hidden cursor-pointer group transition-all flex items-center justify-center ${
                slot.isVisible
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-[#222] hover:border-[#3b82f6]'
              }`}
            >
              {streamUrl ? (
                <video
                  src={streamUrl}
                  preload="metadata"
                  muted
                  className="w-full h-full object-contain pointer-events-none"
                  onLoadedMetadata={(e) => {
                    const clipStart = slot.activeClip!.startFrame / projectFps;
                    const rel = playheadPosition - clipStart;
                    e.currentTarget.currentTime = Math.max(0, slot.activeClip!.inPoint + rel);
                  }}
                />
              ) : (
                <div className="text-center px-4">
                  <span className="text-[#555] text-xs font-medium block">No Signal</span>
                  <span className="text-[#444] text-[10px]">Camera Angle {slot.angle}</span>
                </div>
              )}

              {/* Angle Tag & Hotkey Badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                <span className="bg-black/70 text-white font-mono text-[11px] px-2 py-0.5 rounded border border-white/10">
                  [{slot.angle}] {slot.trackName}
                </span>
                {slot.isVisible && (
                  <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider">
                    LIVE
                  </span>
                )}
              </div>

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-[#3b82f6]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
                  Cut to Angle {slot.angle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
