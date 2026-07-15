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
import { formatRulerLabel, getRulerConfig } from './ruler';
import { ClipElement } from './components/ClipElement';
import { ToolButton } from './components/ToolButton';

const PIXELS_PER_SECOND = 100;
const TRACK_HEIGHT = 48;
const HEADER_WIDTH = 140;
const TRIM_HANDLE_WIDTH = 6;

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

// Sub-components moved to separate files under Timeline/components/

export default Timeline;
