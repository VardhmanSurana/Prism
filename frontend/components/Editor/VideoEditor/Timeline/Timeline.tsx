/**
 * Timeline — bottom panel with tracks, clips, playhead, drag, trim, split, zoom.
 * Upgraded to match OpenCut's timeline aesthetic and frame-accurate tick ruler.
 */
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
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
import {
  Scissors,
  Copy,
  Clipboard,
  Link,
  Unlink,
  Trash2,
  Bookmark,
  Download,
  Magnet,
  Maximize2,
  Film,
  Music,
  Type,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Pencil,
  Plus,
} from 'lucide-react';

const PIXELS_PER_SECOND = 100;
const TRACK_HEIGHT = 48;
const HEADER_WIDTH = 140;
const TRIM_HANDLE_WIDTH = 6;

/**
 * Timeline - Renders timeline.
 */
export const Timeline: React.FC = () => {
  const {
    tracks, playheadPosition, zoomLevel, selectedClipId, duration,
    projectFps, isPlaying, bookmarks, snapEnabled, clipboardClip,
    seek, selectClip, setZoomLevel, moveClip, trimClip, splitClip,
    toggleTrackMute, toggleTrackSolo, toggleTrackVisibility, toggleTrackLocked,
    selectTrack, addTrack, selectedTrackId, addFreezeFrame, addClip,
    addBookmark, removeBookmark, linkClips, unlinkClip, toggleSnap,
    setClipboardClip, reorderTrack, pushHistory,
  } = useNLEStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setContainerWidth(el.clientWidth);

    /**
     * observer - Performs observer.
     */
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
  /**
   * handleTrackDragStart - Handles track drag start.
   */
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

  /**
   * handleTrackDragOver - Handles track drag over.
   */
  const handleTrackDragOver = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    if (dragTrackId && dragTrackId !== trackId) {
      setDragTrackOverId(trackId);
    }
  }, [dragTrackId]);

  /**
   * handleTrackDragLeave - Handles track drag leave.
   */
  const handleTrackDragLeave = useCallback(() => {
    setDragTrackOverId(null);
  }, []);

  /**
   * handleTrackDrop - Handles track drop.
   */
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
    /**
     * handleWheel - Handles wheel.
     */
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

    /**
     * handleMouseMove - Handles mouse move.
     */
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

    /**
     * handleMouseUp - Handles mouse up.
     */
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

  /**
   * findClip - Performs find clip.
   */
  function findClip(clipId: string): Clip | undefined {
    for (const track of tracks) {
      /**
       * clip - Performs clip.
       */
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }

  /**
   * handleRulerClick - Handles ruler click.
   */
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    seek(Math.max(0, x / pixelsPerSec));
  }, [pixelsPerSec, seek]);

  /**
   * handleTrackAreaClick - Handles track area click.
   */
  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectClip(null);
    }
  }, [selectClip]);

  /**
   * handleTrackDoubleClick - Handles track double click.
   */
  const handleTrackDoubleClick = useCallback(() => {
    if (selectedClipId) {
      splitClip(selectedClipId, playheadPosition);
    }
  }, [selectedClipId, playheadPosition, splitClip]);

  /**
   * handleCopy - Handles copy.
   */
  const handleCopy = useCallback(() => {
    if (!selectedClipId) return;
    for (const track of tracks) {
      /**
       * clip - Performs clip.
       */
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        setClipboardClip(JSON.parse(JSON.stringify(clip)));
        break;
      }
    }
  }, [selectedClipId, tracks, setClipboardClip]);

  /**
   * handlePaste - Handles paste.
   */
  const handlePaste = useCallback(() => {
    const clipData = clipboardClip;
    if (!clipData) return;
    // Find the first video track, or the selected track
    const targetTrackId = selectedTrackId ?? tracks[0]?.id;
    if (!targetTrackId) return;
    /**
     * targetTrack - Performs target track.
     */
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
    <div className="h-[220px] bg-[#151312] border-t border-white/10 flex flex-col shrink-0">
      {/* ── Toolbar row ── */}
      <div className="h-10 bg-[#171615] flex items-center px-3 border-b border-white/10 gap-1.5 shrink-0">
        {/* Left tools */}
        <ToolButton
          title="Split at playhead"
          onClick={() => selectedClipId && splitClip(selectedClipId, playheadPosition)}
          active={false}
        >
          <Scissors className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton title="Copy" onClick={handleCopy} active={false}>
          <Copy className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton title="Paste" onClick={handlePaste} active={false}>
          <Clipboard className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton title="Link clips" onClick={() => {
          if (!selectedClipId) return;
          for (const track of tracks) {
            const idx = track.clips.findIndex((c) => c.id === selectedClipId);
            if (idx !== -1 && idx < track.clips.length - 1) {
              linkClips(track.clips[idx].id, track.clips[idx + 1].id);
              break;
            }
          }
        }} active={false}>
          <Link className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton title="Unlink clips" onClick={() => {
          if (!selectedClipId) return;
          unlinkClip(selectedClipId);
        }} active={false}>
          <Unlink className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton
          title="Delete selected"
          onClick={() => selectedClipId && useNLEStore.getState().removeClip(selectedClipId)}
          active={false}
        >
          <Trash2 className="w-3.5 h-3.5 hover:text-red-400" />
        </ToolButton>
        <ToolButton title="Add bookmark at playhead" onClick={() => addBookmark()} active={false}>
          <Bookmark className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton title="Export / Download" onClick={() => useNLEStore.getState().setExportDialogOpen(true)} active={false}>
          <Download className="w-3.5 h-3.5 text-[#e5a93c]" />
        </ToolButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Center — Main scene pill */}
        <button className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1d1b1a] hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors border border-white/10 cursor-pointer shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] shadow-[0_0_6px_rgba(229,169,60,0.8)]" />
          <span>Main Sequence</span>
        </button>

        <div className="flex-1" />

        {/* Right tools */}
        <ToolButton title="Snap to grid / clips" onClick={toggleSnap} active={snapEnabled}>
          <Magnet className="w-3.5 h-3.5" />
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
          <Maximize2 className="w-3.5 h-3.5" />
        </ToolButton>

        {/* Zoom slider */}
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={() => setZoomLevel(zoomLevel - 20)}
            className="text-zinc-400 hover:text-white text-xs w-4 h-4 flex items-center justify-center transition-colors cursor-pointer"
          >
            −
          </button>
          <div className="relative w-20 h-1.5 bg-white/10 border border-white/10 rounded-full cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              setZoomLevel(Math.round(pct * 5));
            }}
          >
            <div
              className="absolute top-0 left-0 h-full bg-[#e5a93c] rounded-full"
              style={{ width: `${Math.min(100, (zoomLevel / 500) * 100)}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#f5f0ed] rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${Math.min(100, (zoomLevel / 500) * 100)}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <button
            onClick={() => setZoomLevel(zoomLevel + 20)}
            className="text-zinc-400 hover:text-white text-xs w-4 h-4 flex items-center justify-center transition-colors cursor-pointer"
          >
            +
          </button>
          <span className="text-zinc-400 text-[10px] w-8 text-right tabular-nums select-none font-mono">{zoomLevel}%</span>
        </div>
      </div>

      {/* ── Main timeline area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Track headers */}
        <div className="shrink-0 bg-[#171615] border-r border-white/10 flex flex-col" style={{ width: HEADER_WIDTH }}>
          {/* Ruler spacer */}
          <div className="h-6 border-b border-white/10 flex items-center px-3 bg-[#151312]">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider select-none">Tracks</span>
          </div>
          {tracks.map((track) => {
            const isExpanded = expandedTracks.has(track.id);
            const headerH = isExpanded ? TRACK_HEIGHT * 2 : TRACK_HEIGHT;
            return (
              <div
                key={track.id}
                className={`flex items-center px-3 border-b border-white/10 justify-between gap-1.5 group transition-colors select-none ${
                  selectedTrackId === track.id
                    ? 'bg-white/[0.04] border-l-2 border-[#e5a93c]'
                    : 'hover:bg-white/[0.02]'
                } ${dragTrackOverId === track.id ? 'bg-[#e5a93c]/10' : ''}`}
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
                  <span className="text-zinc-500 w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    {track.type === 'video' ? (
                      <Film className="w-3.5 h-3.5 text-zinc-400" />
                    ) : track.type === 'audio' ? (
                      <Music className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <Type className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </span>
                  <span className="text-zinc-300 text-[11px] font-medium truncate">{track.name}</span>
                </div>

                {/* Right side: Mute / Visibility / Lock / Edit */}
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackLocked(track.id); }}
                    className={`w-4 h-4 flex items-center justify-center transition-colors cursor-pointer rounded ${
                      track.locked ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title={track.locked ? 'Unlock track' : 'Lock track'}
                  >
                    {track.locked ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </button>

                  {/* Visibility (Eye) Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }}
                    className={`w-4 h-4 flex items-center justify-center transition-colors cursor-pointer rounded ${
                      track.visible ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                    title={track.visible ? 'Hide track' : 'Show track'}
                  >
                    {track.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
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
                    className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer rounded"
                    title="Rename track"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>

                  {/* Solo (S) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold transition-colors cursor-pointer ${
                      track.solo ? 'text-[#151312] bg-[#e5a93c] font-black' : 'text-zinc-500 hover:text-zinc-300 border border-white/10 hover:border-white/20'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>

                  {/* Mute (M) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold transition-colors cursor-pointer ${
                      track.muted ? 'text-white bg-red-600/80 font-black' : 'text-zinc-500 hover:text-zinc-300 border border-white/10 hover:border-white/20'
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
          <div className="flex-1 flex items-center justify-center py-2">
            <button
              onClick={() => addTrack('video')}
              className="text-zinc-400 hover:text-[#e5a93c] p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
              title="Add video track"
            >
              <Plus className="w-4 h-4" />
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
            className="h-6 bg-[#151312] border-b border-white/10 relative cursor-pointer select-none"
            style={{ width: totalWidth }}
            onClick={handleRulerClick}
          >
            {useMemo(() => {
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
                      <span className="text-zinc-500 text-[9px] font-mono leading-none mt-1 select-none whitespace-nowrap">
                        {formatRulerLabel(time, projectFps)}
                      </span>
                    ) : (
                      <div className="w-px h-1.5 bg-white/15 mt-[14px]" />
                    )}
                  </div>
                );
              }
              return ticks;
            }, [totalWidth, pixelsPerSec, projectFps])}

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
            className="relative bg-[#151312]"
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
                  className={`absolute left-0 right-0 border-b border-white/10 transition-colors ${
                    dragOverTrackId === track.id ? 'bg-[#e5a93c]/10' : ''
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
                        // Push one history snapshot per drag gesture, at gesture start —
                        // moveClip/trimClip deliberately don't push per-mousemove.
                        pushHistory();
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
              className="absolute top-0 bottom-0 w-px bg-[#e5a93c] z-10 pointer-events-none shadow-[0_0_8px_rgba(229,169,60,0.6)]"
              style={{ left: playheadPosition * pixelsPerSec }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#e5a93c] rotate-45 rounded-[2px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-components moved to separate files under Timeline/components/

export default Timeline;
