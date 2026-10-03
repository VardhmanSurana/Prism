/**
 * MulticamGrid.tsx — Synchronized 4-up Multi-Camera Angle Grid display.
 * Displays live camera feeds for Angle 1, Angle 2, Angle 3, and Angle 4.
 * Enables 1-click live camera angle cutting during video playback.
 */

import React from 'react';
import type { Track, Clip } from '@/types/nle';
import { API_BASE } from '@/constants';
import { X } from 'lucide-react';

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

/**
 * MulticamGrid - Renders multicam grid.
 */
export const MulticamGrid: React.FC<MulticamGridProps> = ({
  tracks,
  playheadPosition,
  projectFps,
  onSelectAngle,
  onClose,
}) => {
  /**
   * videoTracks - Performs video tracks.
   */
  const videoTracks = tracks.filter((t) => t.type === 'video');

  // Map 4 camera slots (Angles 1 to 4)
  /**
   * slots - Performs slots.
   */
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
    <div className="absolute inset-0 z-20 bg-[#151312]/95 flex flex-col p-2.5 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-white/10 shrink-0 mb-2.5 bg-[#171615] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#e5a93c] animate-pulse" />
          <span className="text-[#f5f0ed] text-xs font-semibold tracking-wide">Multi-Cam Live Grid</span>
          <span className="text-[10px] text-zinc-400">Press keys 1–4 to cut live</span>
        </div>

        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          title="Exit Multi-Cam Grid"
        >
          <X className="w-3.5 h-3.5" />
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
              className={`relative bg-[#1d1b1a] rounded-lg border-2 overflow-hidden cursor-pointer group transition-all flex items-center justify-center ${
                slot.isVisible
                  ? 'border-[#e5a93c] ring-2 ring-[#e5a93c]/30 shadow-lg shadow-[#e5a93c]/10'
                  : 'border-white/10 hover:border-[#e5a93c]/50'
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
                  <span className="text-zinc-500 text-xs font-medium block">No Signal</span>
                  <span className="text-zinc-600 text-[10px]">Camera Angle {slot.angle}</span>
                </div>
              )}

              {/* Angle Tag & Hotkey Badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                <span className="bg-[#171615]/80 text-[#f5f0ed] font-mono text-[11px] px-2 py-0.5 rounded border border-white/10 backdrop-blur-xs">
                  [{slot.angle}] {slot.trackName}
                </span>
                {slot.isVisible && (
                  <span className="bg-[#e5a93c] text-[#151312] text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-xs">
                    LIVE
                  </span>
                )}
              </div>

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-[#e5a93c]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-[#171615]/90 text-[#f5f0ed] text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 shadow-lg backdrop-blur-xs">
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
