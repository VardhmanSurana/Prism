/**
 * Timeline — bottom panel with tracks, clips, playhead, drag, trim, split, zoom.
 * Upgraded to match OpenCut's timeline aesthetic and frame-accurate tick ruler.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNLEStore } from '@/store/nleStore';
import type { Clip } from '@/types/nle';
import { Ruler } from './components/Ruler';
import { Playhead } from './components/Playhead';
import { TrackLanes } from './components/TrackLanes';
import { DEFAULT_EFFECTS, DEFAULT_TRANSFORM } from '@/types/nle';
import { API_BASE } from '@/constants';

const PIXELS_PER_SECOND = 100;
const TRACK_HEIGHT = 48;
const HEADER_WIDTH = 140;
const TRIM_HANDLE_WIDTH = 6;

// ── Ruler configuration constants for frame-accurate ticks (OpenCut) ──
const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;
const SECOND_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;
const MIN_LABEL_SPACING_PX = 120;
const MIN_TICK_SPACING_PX = 18;

function getRulerConfig(pixelsPerSec: number, fps: number) {
  const pixelsPerFrame = pixelsPerSec / fps;

  // Find optimal label interval
  let labelIntervalSeconds = 60;
  for (const frameInterval of LABEL_FRAME_INTERVALS) {
    if (pixelsPerFrame * frameInterval >= MIN_LABEL_SPACING_PX) {
      labelIntervalSeconds = frameInterval / fps;
      break;
    }
  }
  if (labelIntervalSeconds === 60) {
    for (const secondMultiplier of SECOND_MULTIPLIERS) {
      if (pixelsPerSec * secondMultiplier >= MIN_LABEL_SPACING_PX) {
        labelIntervalSeconds = secondMultiplier;
        break;
      }
    }
  }

  // Find optimal tick interval
  let rawTickIntervalSeconds = 60;
  for (const frameInterval of TICK_FRAME_INTERVALS) {
    if (pixelsPerFrame * frameInterval >= MIN_TICK_SPACING_PX) {
      rawTickIntervalSeconds = frameInterval / fps;
      break;
    }
  }
  if (rawTickIntervalSeconds === 60) {
    for (const secondMultiplier of SECOND_MULTIPLIERS) {
      if (pixelsPerSec * secondMultiplier >= MIN_TICK_SPACING_PX) {
        rawTickIntervalSeconds = secondMultiplier;
        break;
      }
    }
  }

  // Ensure tick divides label evenly
  let tickIntervalSeconds = rawTickIntervalSeconds;
  const labelFrames = Math.round(labelIntervalSeconds * fps);
  const tickFrames = Math.round(tickIntervalSeconds * fps);
  if (labelFrames % tickFrames !== 0) {
    let found = false;
    for (const candidateFrames of TICK_FRAME_INTERVALS) {
      if (labelFrames % candidateFrames === 0) {
        if (pixelsPerFrame * candidateFrames >= MIN_TICK_SPACING_PX) {
          tickIntervalSeconds = candidateFrames / fps;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      for (const candidateSeconds of SECOND_MULTIPLIERS) {
        const ratio = labelIntervalSeconds / candidateSeconds;
        if (Math.abs(ratio - Math.round(ratio)) < 0.0001) {
          if (pixelsPerSec * candidateSeconds >= MIN_TICK_SPACING_PX) {
            tickIntervalSeconds = candidateSeconds;
            found = true;
            break;
          }
        }
      }
    }
    if (!found) {
      tickIntervalSeconds = labelIntervalSeconds;
    }
  }

  return { labelIntervalSeconds, tickIntervalSeconds };
}

function formatRulerLabel(timeInSeconds: number, fps: number): string {
  const epsilon = 0.0001;
  const remainder = timeInSeconds % 1;
  const isSecondBoundary = remainder < epsilon || remainder > 1 - epsilon;

  if (isSecondBoundary) {
    const totalSeconds = Math.round(timeInSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  const frameWithinSecond = Math.round(remainder * fps);
  return `${frameWithinSecond}f`;
}

export const Timeline: React.FC = () => {
  const {
    tracks, playheadPosition, zoomLevel, selectedClipId, duration,
    projectFps, isPlaying, bookmarks, snapEnabled, clipboardClip,
    seek, selectClip, setZoomLevel, moveClip, trimClip, splitClip,
    toggleTrackMute, toggleTrackSolo, toggleTrackVisibility, toggleTrackLocked,
    selectTrack, addTrack, selectedTrackId, addFreezeFrame, addClip,
    addBookmark, removeBookmark, linkClips, unlinkClip, toggleSnap,
    setClipboardClip, reorderTrack,
  } = useNLEStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setContainerWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pixelsPerSec = PIXELS_PER_SECOND * (zoomLevel / 100);
  const totalWidth = Math.max(duration * pixelsPerSec + 200, containerWidth);

  // ---- Clipboard for copy/paste ----
  const nextClipIdRef = useRef(0);

  // ---- Drag state ----
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-in' | 'trim-out';
    clipId: string;
    startMouseX: number;
    startFrame: number;
    sourceTrackId: string;
  } | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const [dragTrackOverId, setDragTrackOverId] = useState<string | null>(null);

  // ---- Track reordering ----
  const handleTrackDragStart = useCallback((e: React.DragEvent, trackId: string) => {
    e.stopPropagation();
    setDragTrackId(trackId);
    
    // Create a drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-[#3b82f6] text-white text-xs px-2 py-1 rounded shadow-lg';
    dragImage.textContent = 'Move Track';
    document.body.appendChild(dragImage);
    
    // Set drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
      e.dataTransfer.setDragImage(dragImage, 0, 0);
    }
  }, []);

  const handleTrackDragOver = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    if (dragTrackId && dragTrackId !== trackId) {
      setDragTrackOverId(trackId);
    }
  }, [dragTrackId]);

  const handleTrackDragLeave = useCallback(() => {
    setDragTrackOverId(null);
  }, []);

  const handleTrackDrop = useCallback((e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    if (!dragTrackId || dragTrackId === targetTrackId) return;

    reorderTrack(dragTrackId, targetTrackId);

    setDragTrackId(null);
    setDragTrackOverId(null);

    // Clean up drag image
    const dragImage = document.querySelector('.bg-[#3b82f6].text-white.text-xs.px-2.py-1.rounded.shadow-lg');
    if (dragImage) document.body.removeChild(dragImage);
  }, [dragTrackId, reorderTrack]);

  // ---- Scroll-wheel zoom ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoomLevel(zoomLevel + delta);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, setZoomLevel]);

  // ---- Handle global mouse events for drag ----
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startMouseX;
      const dFrames = Math.round((dx / pixelsPerSec) * projectFps);

      if (dragState.type === 'move') {
        let newFrame = Math.max(0, dragState.startFrame + dFrames);

        // Snap logic: snap to playhead and other clip edges when snapEnabled
        if (snapEnabled) {
          const SNAP_THRESHOLD = 5; // frames
          const snapTargets: number[] = [0, Math.round(playheadPosition * projectFps)];
          for (const t of tracks) {
            for (const c of t.clips) {
              if (c.id === dragState.clipId) continue;
              snapTargets.push(c.startFrame);
              snapTargets.push(c.startFrame + c.durationFrames);
            }
          }
          const clip = findClip(dragState.clipId);
          if (clip) {
            for (const target of snapTargets) {
              const diff = Math.abs(newFrame - target);
              if (diff <= SNAP_THRESHOLD) {
                newFrame = target;
                break;
              }
              // Snap the end of the clip
              const endDiff = Math.abs((newFrame + clip.durationFrames) - target);
              if (endDiff <= SNAP_THRESHOLD) {
                newFrame = target - clip.durationFrames;
                break;
              }
            }
          }
        }
        const trackContentEl = containerRef.current?.querySelector('[data-track-area]');
        if (trackContentEl) {
          const rect = trackContentEl.getBoundingClientRect();
          const mouseY = e.clientY - rect.top + (containerRef.current?.scrollTop ?? 0);
          const targetTrackIdx = Math.floor(mouseY / TRACK_HEIGHT);
          if (targetTrackIdx >= 0 && targetTrackIdx < tracks.length) {
            const targetTrackId = tracks[targetTrackIdx].id;
            setDragOverTrackId(targetTrackId);
            moveClip(dragState.clipId, newFrame, targetTrackId !== dragState.sourceTrackId ? targetTrackId : undefined);
          } else {
            setDragOverTrackId(null);
            moveClip(dragState.clipId, newFrame);
          }
        } else {
          moveClip(dragState.clipId, newFrame);
        }
      } else if (dragState.type === 'trim-in') {
        const clip = findClip(dragState.clipId);
        if (clip) {
          const newInFrame = dragState.startFrame + dFrames;
          const minFrame = 0;
          const maxFrame = clip.startFrame + clip.durationFrames - Math.round(0.5 * projectFps);
          const clamped = Math.max(minFrame, Math.min(maxFrame, newInFrame));
          trimClip(dragState.clipId, 'in', clip.startFrame + (clamped - dragState.startFrame));
        }
      } else if (dragState.type === 'trim-out') {
        const clip = findClip(dragState.clipId);
        if (clip) {
          const newDuration = clip.durationFrames + dFrames;
          const minDuration = Math.round(0.5 * projectFps);
          trimClip(dragState.clipId, 'out', clip.startFrame + Math.max(minDuration, newDuration));
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setDragOverTrackId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelsPerSec, projectFps, moveClip, trimClip, tracks, snapEnabled, playheadPosition]);

  function findClip(clipId: string): Clip | undefined {
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    seek(Math.max(0, x / pixelsPerSec));
  }, [pixelsPerSec, seek]);

  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectClip(null);
    }
  }, [selectClip]);

  const handleTrackDoubleClick = useCallback(() => {
    if (selectedClipId) {
      splitClip(selectedClipId, playheadPosition);
    }
  }, [selectedClipId, playheadPosition, splitClip]);

  const handleCopy = useCallback(() => {
    if (!selectedClipId) return;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        setClipboardClip(JSON.parse(JSON.stringify(clip)));
        break;
      }
    }
  }, [selectedClipId, tracks, setClipboardClip]);

  const handlePaste = useCallback(() => {
    const clipData = clipboardClip;
    if (!clipData) return;
    // Find the first video track, or the selected track
    const targetTrackId = selectedTrackId ?? tracks[0]?.id;
    if (!targetTrackId) return;
    const targetTrack = tracks.find((t) => t.id === targetTrackId);
    if (!targetTrack) return;

    // Generate a new unique id
    nextClipIdRef.current++;
    const newClip: Clip = {
      ...clipData,
      id: `clip_paste_${Date.now()}_${nextClipIdRef.current}`,
      startFrame: Math.round(playheadPosition * projectFps),
    };
    addClip(targetTrackId, newClip);
  }, [selectedTrackId, tracks, playheadPosition, projectFps, addClip, clipboardClip]);

  return (
    <div className="h-[220px] bg-[#121212] border-t border-[#222] flex flex-col shrink-0">
      {/* ── Toolbar row ── */}
      <div className="h-9 bg-[#141414] flex items-center px-3 border-b border-[#222] gap-1 shrink-0">
        {/* Left tools */}
        <ToolButton
          title="Split at playhead"
          onClick={() => selectedClipId && splitClip(selectedClipId, playheadPosition)}
          active={false}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M14.5 2v6m0 0l4-4m-4 4l-4-4m4 4v14" />
            <path d="M9.5 22v-6m0 0l-4 4m4-4l4 4m-4-4V6" />
          </svg>
        </ToolButton>
        <ToolButton title="Copy" onClick={handleCopy} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
          </svg>
        </ToolButton>
        <ToolButton title="Paste" onClick={handlePaste} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
            <path d="M16 2v4M8 2v4M6 10h12" />
          </svg>
        </ToolButton>
        <ToolButton title="Link clips" onClick={() => {
          // Link selected clip with the next clip on the same track
          if (!selectedClipId) return;
          for (const track of tracks) {
            const idx = track.clips.findIndex((c) => c.id === selectedClipId);
            if (idx !== -1 && idx < track.clips.length - 1) {
              linkClips(track.clips[idx].id, track.clips[idx + 1].id);
              break;
            }
          }
        }} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        </ToolButton>
        <ToolButton title="Unlink clips" onClick={() => {
          if (!selectedClipId) return;
          unlinkClip(selectedClipId);
        }} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M15 7h3a5 5 0 010 10h-3m-6 0H6a5 5 0 010-10h3" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </ToolButton>
        <ToolButton
          title="Delete selected"
          onClick={() => selectedClipId && useNLEStore.getState().removeClip(selectedClipId)}
          active={false}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </ToolButton>
        <ToolButton title="Add bookmark at playhead" onClick={() => addBookmark()} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </ToolButton>
        <ToolButton title="Export / Download" onClick={() => useNLEStore.getState().setExportDialogOpen(true)} active={false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </ToolButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Center — Main scene pill */}
        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1e1e] hover:bg-[#2e2e2e] text-[#888] text-[11px] font-medium transition-colors border border-[#2d2d2d] cursor-pointer">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Main scene
        </button>

        <div className="flex-1" />

        {/* Right tools */}
        <ToolButton title="Snap to grid / clips" onClick={toggleSnap} active={snapEnabled}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M6 2v6m0 0a3 3 0 003 3 3 3 0 003-3m-6 0H6v6a4 4 0 008 0V2m0 6V2" />
          </svg>
        </ToolButton>
        <ToolButton title="Expand selected track" onClick={() => {
          const trackId = selectedTrackId ?? tracks[0]?.id;
          if (!trackId) return;
          setExpandedTracks((prev) => {
            const next = new Set(prev);
            if (next.has(trackId)) next.delete(trackId);
            else next.add(trackId);
            return next;
          });
        }} active={selectedTrackId ? expandedTracks.has(selectedTrackId) : false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </ToolButton>

        {/* Zoom slider */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={() => setZoomLevel(zoomLevel - 20)}
            className="text-[#666] hover:text-[#999] text-[11px] w-4 h-4 flex items-center justify-center transition-colors cursor-pointer"
          >
            −
          </button>
          <div className="relative w-20 h-1 bg-[#222] border border-[#2d2d2d] rounded-full cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              setZoomLevel(Math.round(pct * 5));
            }}
          >
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, (zoomLevel / 500) * 100)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${Math.min(100, (zoomLevel / 500) * 100)}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <button
            onClick={() => setZoomLevel(zoomLevel + 20)}
            className="text-[#666] hover:text-[#999] text-[11px] w-4 h-4 flex items-center justify-center transition-colors cursor-pointer"
          >
            +
          </button>
          <span className="text-[#666] text-[10px] w-8 text-right tabular-nums select-none">{zoomLevel}%</span>
        </div>
      </div>

      {/* ── Main timeline area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Track headers */}
        <div className="shrink-0 bg-[#141414] border-r border-[#222] flex flex-col" style={{ width: HEADER_WIDTH }}>
          {/* Ruler spacer */}
          <div className="h-6 border-b border-[#222] flex items-center px-3">
            <span className="text-[#555] text-[10px] uppercase font-bold select-none">Tracks</span>
          </div>
          {tracks.map((track) => {
            const isExpanded = expandedTracks.has(track.id);
            const headerH = isExpanded ? TRACK_HEIGHT * 2 : TRACK_HEIGHT;
            return (
              <div
                key={track.id}
                className={`flex items-center px-3 border-b border-[#222] justify-between gap-1.5 group transition-colors select-none ${
                  selectedTrackId === track.id
                    ? 'bg-[#1a1a1a] border-l-2 border-blue-500'
                    : 'hover:bg-[#1a1a1a]'
                } ${dragTrackOverId === track.id ? 'bg-blue-500/5' : ''}`}
                style={{ height: headerH, cursor: dragTrackId ? 'grabbing' : 'grab' }}
                onClick={() => selectTrack(track.id)}
                draggable
                onDragStart={(e) => handleTrackDragStart(e, track.id)}
                onDragOver={(e) => handleTrackDragOver(e, track.id)}
                onDragLeave={handleTrackDragLeave}
                onDrop={(e) => handleTrackDrop(e, track.id)}
              >
                {/* Left side: Track Icon + Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#555] w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    {track.type === 'video' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <rect x="2" y="4" width="15" height="16" rx="2" />
                        <path d="M17 8l5-3v14l-5-3" />
                      </svg>
                    ) : track.type === 'audio' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    ) : (
                      <span className="font-bold text-[10px]">T</span>
                    )}
                  </span>
                  <span className="text-[#aaa] text-[11px] font-medium truncate">{track.name}</span>
                </div>

                {/* Right side: Mute / Visibility / Lock / Edit */}
                <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackLocked(track.id); }}
                    className={`w-4 h-4 flex items-center justify-center transition-colors cursor-pointer ${
                      track.locked ? 'text-red-400 bg-red-950/20 rounded' : 'text-[#555] hover:text-[#aaa]'
                    }`}
                    title={track.locked ? 'Unlock track' : 'Lock track'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      {track.locked ? (
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      ) : (
                        <path d="M8 11V7a4 4 0 118 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
                      )}
                    </svg>
                  </button>

                  {/* Visibility (Eye) Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }}
                    className={`w-4 h-4 flex items-center justify-center transition-colors cursor-pointer ${
                      track.visible ? 'text-[#777] hover:text-[#aaa]' : 'text-[#333]'
                    }`}
                    title={track.visible ? 'Hide track' : 'Show track'}
                  >
                    {track.visible ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>

                  {/* Rename button (Pen) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newName = prompt('Track name:', track.name);
                      if (newName !== null && newName.trim()) {
                        useNLEStore.getState().renameTrack(track.id, newName.trim());
                      }
                    }}
                    className="w-4 h-4 flex items-center justify-center text-[#555] hover:text-[#aaa] transition-colors cursor-pointer"
                    title="Rename track"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>

                  {/* Solo (S) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-extrabold transition-colors cursor-pointer ${
                      track.solo ? 'text-yellow-400 bg-yellow-900/40 border border-yellow-700/60' : 'text-[#555] hover:text-[#aaa] border border-transparent'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>

                  {/* Mute (M) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-extrabold transition-colors cursor-pointer ${
                      track.muted ? 'text-red-400 bg-red-950/40 border border-red-900/60' : 'text-[#555] hover:text-[#aaa] border border-transparent'
                    }`}
                    title="Mute"
                  >
                    M
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add track button */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => addTrack('video')}
              className="text-[#555] hover:text-[#999] p-1.5 rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              title="Add video track"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable track area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          onScroll={(e) => useNLEStore.setState({ scrollOffset: e.currentTarget.scrollLeft })}
        >
          {/* Time ruler */}
          <div
            className="h-6 bg-[#141414] border-b border-[#222] relative cursor-pointer select-none"
            style={{ width: totalWidth }}
            onClick={handleRulerClick}
          >
            {(() => {
              const { labelIntervalSeconds, tickIntervalSeconds } = getRulerConfig(pixelsPerSec, projectFps);
              const rulerDuration = totalWidth / pixelsPerSec;
              const tickCount = Math.ceil(rulerDuration / tickIntervalSeconds) + 1;
              const ticks = [];
              for (let i = 0; i < tickCount; i++) {
                const time = i * tickIntervalSeconds;
                if (time > rulerDuration) break;
                const showLabel = i * tickIntervalSeconds % labelIntervalSeconds < 0.0001 || (i * tickIntervalSeconds % labelIntervalSeconds > labelIntervalSeconds - 0.0001);
                
                ticks.push(
                  <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col items-center pointer-events-none"
                    style={{ left: time * pixelsPerSec }}
                  >
                    {showLabel ? (
                      <span className="text-[#666] text-[9px] font-mono leading-none mt-1 select-none whitespace-nowrap">
                        {formatRulerLabel(time, projectFps)}
                      </span>
                    ) : (
                      <div className="w-px h-1.5 bg-[#2d2d2d] mt-[14px]" />
                    )}
                  </div>
                );
              }
              return ticks;
            })()}

            {/* Bookmark markers */}
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="absolute bottom-0 flex flex-col items-center cursor-pointer group"
                style={{ left: bm.time * pixelsPerSec }}
                title={`${bm.label} — ${bm.time.toFixed(1)}s (right-click to remove)`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  removeBookmark(bm.id);
                }}
              >
                <div
                  className="w-2 h-2 rounded-full -mb-0.5 ring-1 ring-black/50"
                  style={{ backgroundColor: bm.color }}
                />
                <div className="absolute top-0 text-[8px] text-white/70 bg-black/60 rounded px-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {bm.label}
                </div>
              </div>
            ))}
          </div>

          {/* Track content area */}
          <div
            className="relative bg-[#0d0d0d]"
            style={{ width: totalWidth, minHeight: tracks.length * TRACK_HEIGHT }}
            onClick={handleTrackAreaClick}
            onDoubleClick={handleTrackDoubleClick}
            data-track-area
          >
            {tracks.map((track, trackIdx) => {
              const trackTop = tracks.slice(0, trackIdx).reduce(
                (sum, t) => sum + (expandedTracks.has(t.id) ? TRACK_HEIGHT * 2 : TRACK_HEIGHT), 0
              );
              const isExpanded = expandedTracks.has(track.id);
              const trackH = isExpanded ? TRACK_HEIGHT * 2 : TRACK_HEIGHT;
              return (
                <div
                  key={track.id}
                  className={`absolute left-0 right-0 border-b border-[#222] transition-colors ${
                    dragOverTrackId === track.id ? 'bg-blue-500/5' : ''
                  } ${!track.visible ? 'opacity-20' : ''}`}
                  style={{ top: trackTop, height: trackH }}
                >
                  {track.clips.map((clip) => (
                    <ClipElement
                      key={clip.id}
                      clip={clip}
                      trackId={track.id}
                      trackType={track.type}
                      pixelsPerSec={pixelsPerSec}
                      fps={projectFps}
                      isSelected={clip.id === selectedClipId}
                      isDragging={dragState?.clipId === clip.id}
                      onSelect={() => selectClip(clip.id)}
                      onDragStart={(type, mouseX) => {
                        setDragState({
                          type,
                          clipId: clip.id,
                          startMouseX: mouseX,
                          startFrame: clip.startFrame,
                          sourceTrackId: track.id,
                        });
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-blue-500 z-10 pointer-events-none"
              style={{ left: playheadPosition * pixelsPerSec }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-500 rotate-45 rounded-[2px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ClipElement — with drag, trim handles, selection
// ---------------------------------------------------------------------------

interface ClipElementProps {
  clip: Clip;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
  pixelsPerSec: number;
  fps: number;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (type: 'move' | 'trim-in' | 'trim-out', mouseX: number) => void;
}

const ClipElement: React.FC<ClipElementProps> = ({
  clip, trackType, pixelsPerSec, fps, isSelected, isDragging, onSelect, onDragStart,
}) => {
  const left = (clip.startFrame / fps) * pixelsPerSec;
  const width = (clip.durationFrames / fps) * pixelsPerSec;

  // Color theme class names based on trackType
  const getThemeClasses = () => {
    if (isDragging) {
      return 'bg-[#2563eb] border-2 border-blue-400 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20';
    }
    if (isSelected) {
      switch (trackType) {
        case 'audio':
          return 'bg-[#183327] border-2 border-[#10b981] shadow-lg shadow-emerald-500/20';
        case 'text':
          return 'bg-[#2f1d38] border-2 border-[#a855f7] shadow-lg shadow-purple-500/20';
        case 'video':
        default:
          return 'bg-[#1d2d44] border-2 border-blue-500 shadow-lg shadow-blue-500/20';
      }
    }
    // Default / Unselected states
    switch (trackType) {
      case 'audio':
        return 'bg-[#10241b] border border-emerald-500/35 hover:bg-[#153024] hover:border-emerald-500/50';
      case 'text':
        return 'bg-[#1f1225] border border-purple-500/35 hover:bg-[#2a1a32] hover:border-purple-500/50';
      case 'video':
      default:
        return 'bg-[#132030] border border-blue-500/35 hover:bg-[#1a2b42] hover:border-blue-500/50';
    }
  };

  return (
    <div
      className={`absolute top-1 bottom-1 rounded-[4px] cursor-pointer overflow-hidden transition-all select-none ${getThemeClasses()}`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 z-20 flex items-center justify-center border-r border-white/5"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart('trim-in', e.clientX);
        }}
      >
        <div className="w-[1.5px] h-3 bg-white/40 rounded-full" />
      </div>

      {/* Clip content — draggable */}
      <div
        className="absolute inset-0 px-2.5 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
          onDragStart('move', e.clientX);
        }}
      >
        {/* Render asset preview content */}
        {trackType === 'video' && (
          <ThumbnailStrip sourcePath={clip.sourcePath} width={width} height={TRACK_HEIGHT - 8} speed={clip.speed} inPoint={clip.inPoint} outPoint={clip.outPoint} />
        )}
        {trackType === 'audio' && (
          <WaveformBar clipId={clip.id} sourcePath={clip.sourcePath} width={width} height={TRACK_HEIGHT - 8} speed={clip.speed} inPoint={clip.inPoint} outPoint={clip.outPoint} />
        )}

        {/* Text subtitle display overlay */}
        {trackType === 'text' && clip.text?.text && (
          <div className="absolute inset-0 flex items-center justify-center px-4 select-none pointer-events-none">
            <span className="text-[10px] text-purple-300 font-mono italic truncate max-w-full">
              "{clip.text.text}"
            </span>
          </div>
        )}

        {/* Header label with filename */}
        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-0.5 pointer-events-none z-10">
          <div className="text-[9px] text-white/90 font-medium truncate leading-none select-none">
            {clip.sourcePath.split('/').pop() || clip.text?.text || 'Clip'}
          </div>
        </div>

        {/* Freeze/Speed indicators overlay */}
        <div className="absolute bottom-1 left-2.5 pointer-events-none z-10 flex gap-1">
          {clip.speed === 0 && (
            <div className="text-[8px] bg-cyan-950/80 text-cyan-300 px-1 rounded-[2px] leading-tight select-none border border-cyan-800/40">❄ Freeze</div>
          )}
          {clip.speed < 0 && clip.speed !== 0 && (
            <div className="text-[8px] bg-orange-950/80 text-orange-300 px-1 rounded-[2px] leading-tight select-none border border-orange-850/40">◀ {Math.abs(clip.speed)}x</div>
          )}
          {clip.speed > 0 && clip.speed !== 1 && (
            <div className="text-[8px] bg-yellow-950/80 text-yellow-300 px-1 rounded-[2px] leading-tight select-none border border-yellow-800/40">{clip.speed}x</div>
          )}
        </div>
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/10 z-20 flex items-center justify-center border-l border-white/5"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart('trim-out', e.clientX);
        }}
      >
        <div className="w-[1.5px] h-3 bg-white/40 rounded-full" />
      </div>

      {/* Fade indicators */}
      {clip.fadeIn > 0 && (
        <div className="absolute left-2 top-0 bottom-0 w-2 bg-gradient-to-r from-green-400/40 to-transparent pointer-events-none" />
      )}
      {clip.fadeOut > 0 && (
        <div className="absolute right-2 top-0 bottom-0 w-2 bg-gradient-to-l from-red-400/40 to-transparent pointer-events-none" />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ToolButton — small toolbar icon button
// ---------------------------------------------------------------------------

const WaveformBar: React.FC<{ clipId: string; sourcePath: string; width: number; height: number; speed: number; inPoint: number; outPoint: number }> = ({ clipId, sourcePath, width, height, speed, inPoint, outPoint }) => {
  const [peaks, setPeaks] = useState<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/nle/clips/waveform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: sourcePath, speed, in_point: inPoint, out_point: outPoint }),
    }).then(r => r.json()).then(data => {
      if (!cancelled && data.peaks) setPeaks(data.peaks);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePath, speed, inPoint, outPoint]);

  if (peaks.length === 0) return null;
  const barWidth = width / peaks.length;
  return (
    <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
      {peaks.map((p, i) => (
        <rect key={i} x={i * barWidth} y={height / 2 - (p * height / 2.5)} width={Math.max(barWidth - 0.5, 0.5)} height={p * height * 0.8} fill="rgba(52, 211, 153, 0.35)" />
      ))}
    </svg>
  );
};

const ThumbnailStrip: React.FC<{ sourcePath: string; width: number; height: number; speed: number; inPoint: number; outPoint: number }> = ({ sourcePath, width, height, speed, inPoint, outPoint }) => {
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/nle/clips/thumbnail-strip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: sourcePath, num_thumbnails: Math.max(3, Math.floor(width / 80)), speed, in_point: inPoint, out_point: outPoint }),
    }).then(r => r.json()).then(data => {
      if (!cancelled && data.thumbnails) setThumbs(data.thumbnails);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePath, width, speed, inPoint, outPoint]);

  if (thumbs.length === 0) return null;
  const thumbWidth = width / thumbs.length;
  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {thumbs.map((b64, i) => (
        <img key={i} src={`data:image/jpeg;base64,${b64}`} className="h-full object-cover select-none pointer-events-none opacity-85" style={{ width: thumbWidth }} alt="" />
      ))}
    </div>
  );
};

const ToolButton: React.FC<{
  title: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
      active
        ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30'
        : 'text-[#666] hover:text-[#999] hover:bg-[#252525]'
    }`}
  >
    {children}
  </button>
);

export default Timeline;
