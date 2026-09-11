import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Check, 
  X as XIcon, 
  Minus, 
  Star, 
  Sparkles, 
  Columns, 
  Maximize2, 
  Minimize2, 
  Trash2, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Layers, 
  Keyboard
} from 'lucide-react';
import { useCullStore } from '../../store/cullStore';
import { API_BASE } from '../../constants';
import { Photo } from '../../types';

export const CullingView: React.FC = () => {
  const {
    clusters,
    activeClusterIndex,
    primaryIndex,
    secondaryIndex,
    compareMode,
    zoomLevel,
    autoAdvance,
    panOffset,
    isLoading,
    fetchBursts,
    setActiveClusterIndex,
    setPrimaryIndex,
    setSecondaryIndex,
    toggleCompareMode,
    toggleZoom,
    setPanOffset,
    setAutoAdvance,
    setPhotoCullStatus,
    setPhotoRating,
    advanceCandidate,
    purgeRejected,
    undoPurge,
    getActiveCluster,
    getPrimaryPhoto,
    getSecondaryPhoto,
    getTriageStats,
  } = useCullStore();

  const [purgeToast, setPurgeToast] = useState<{ count: number; timer: number } | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    fetchBursts(true);
  }, [fetchBursts]);

  const activeCluster = getActiveCluster();
  const primaryPhoto = getPrimaryPhoto();
  const secondaryPhoto = getSecondaryPhoto();
  const stats = getTriageStats();

  // Keyboard navigation & triage handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'p' || e.key === 'P') {
        if (primaryPhoto) setPhotoCullStatus(primaryPhoto.id, 'picked');
      } else if (e.key === 'x' || e.key === 'X') {
        if (primaryPhoto) setPhotoCullStatus(primaryPhoto.id, 'rejected');
      } else if (e.key === 'u' || e.key === 'U') {
        if (primaryPhoto) setPhotoCullStatus(primaryPhoto.id, 'unflagged');
      } else if (e.key >= '1' && e.key <= '5') {
        if (primaryPhoto) setPhotoRating(primaryPhoto.id, parseInt(e.key, 10));
      } else if (e.key === '0') {
        if (primaryPhoto) setPhotoRating(primaryPhoto.id, 0);
      } else if (e.key === 'c' || e.key === 'C') {
        toggleCompareMode();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleZoom();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advanceCandidate(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        advanceCandidate(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeClusterIndex + 1 < clusters.length) {
          setActiveClusterIndex(activeClusterIndex + 1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeClusterIndex > 0) {
          setActiveClusterIndex(activeClusterIndex - 1);
        }
      } else if (e.key === '?') {
        setShowShortcutsHelp((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    primaryPhoto,
    setPhotoCullStatus,
    setPhotoRating,
    toggleCompareMode,
    toggleZoom,
    advanceCandidate,
    activeClusterIndex,
    clusters.length,
    setActiveClusterIndex,
  ]);

  // Synchronized Pan interaction
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel === 1) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startPanRef.current = { ...panOffset };
  }, [zoomLevel, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || zoomLevel === 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: startPanRef.current.x + dx,
      y: startPanRef.current.y + dy,
    });
  }, [zoomLevel, setPanOffset]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handlePurge = async () => {
    if (stats.rejected === 0) return;
    const count = await purgeRejected();
    if (count > 0) {
      setPurgeToast({ count, timer: 10 });
    }
  };

  // Countdown timer for purge undo toast
  useEffect(() => {
    if (!purgeToast) return;
    if (purgeToast.timer <= 0) {
      setPurgeToast(null);
      return;
    }
    const interval = setInterval(() => {
      setPurgeToast((prev) => (prev ? { ...prev, timer: prev.timer - 1 } : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [purgeToast]);

  const getImageUrl = (photo?: Photo) => {
    if (!photo) return '';
    return `${API_BASE}/local?path=${encodeURIComponent(photo.path)}`;
  };

  const getThumbUrl = (photo?: Photo) => {
    if (!photo) return '';
    return `${API_BASE}/thumbnails/${photo.id}.jpg`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--cr-bg)] text-[var(--cr-text-primary)] select-none overflow-hidden relative">
      {/* Top HUD / Toolbar */}
      <header className="h-12 border-b border-[var(--cr-border)] px-4 flex items-center justify-between bg-[var(--cr-surface-raised)] shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            <Flame size={16} className="text-[var(--cr-accent)]" />
            <span>Fast Review & Culling</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] font-mono text-[11px] text-[var(--cr-text-secondary)]">
            <Layers size={12} />
            <span>Sequence {clusters.length > 0 ? activeClusterIndex + 1 : 0} of {clusters.length}</span>
            {activeCluster && (
              <span className="text-[var(--cr-text-muted)]">({activeCluster.photos.length} frames)</span>
            )}
          </div>
        </div>

        {/* Center Mode Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCompareMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition ${
              compareMode
                ? 'bg-[var(--cr-accent)] text-white border-transparent'
                : 'bg-[var(--cr-surface-sunken)] border-[var(--cr-border)] text-[var(--cr-text-secondary)] hover:bg-[var(--cr-surface-hover)]'
            }`}
            title="Toggle side-by-side comparison (Shortcut: C)"
          >
            <Columns size={13} />
            <span className="hidden md:inline">Compare</span>
          </button>

          <button
            onClick={toggleZoom}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition ${
              zoomLevel === 2
                ? 'bg-[var(--cr-accent)] text-white border-transparent'
                : 'bg-[var(--cr-surface-sunken)] border-[var(--cr-border)] text-[var(--cr-text-secondary)] hover:bg-[var(--cr-surface-hover)]'
            }`}
            title="Inspect 200% Pixel Peep (Shortcut: Space)"
          >
            {zoomLevel === 2 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden md:inline">{zoomLevel === 2 ? 'Fit' : '200%'}</span>
          </button>

          <label className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-[var(--cr-text-secondary)] cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="accent-[var(--cr-accent)]"
            />
            Auto-advance
          </label>
        </div>

        {/* Right Stats & Help */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShortcutsHelp((prev) => !prev)}
            className="p-1.5 rounded hover:bg-[var(--cr-surface-hover)] text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] transition"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={15} />
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div 
        className="flex-1 flex overflow-hidden relative bg-black/95"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {isLoading ? (
          <div className="m-auto flex flex-col items-center gap-2 text-xs text-[var(--cr-text-muted)] font-mono">
            <div className="w-6 h-6 border-2 border-[var(--cr-accent)] border-t-transparent rounded-full animate-spin" />
            <span>Clustering burst sequences...</span>
          </div>
        ) : !primaryPhoto ? (
          <div className="m-auto text-center p-6 space-y-2">
            <Layers size={32} className="mx-auto text-[var(--cr-text-muted)]" />
            <h3 className="text-sm font-semibold">No photos available for culling</h3>
            <p className="text-xs text-[var(--cr-text-muted)]">All photos in your library are culled or no active photos found.</p>
          </div>
        ) : (
          <div className={`w-full h-full flex ${compareMode ? 'divide-x divide-white/10' : ''}`}>
            {/* Primary Candidate Canvas */}
            <div className="flex-1 h-full relative flex items-center justify-center overflow-hidden">
              <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: zoomLevel === 2 
                    ? `scale(2) translate(${panOffset.x / 2}px, ${panOffset.y / 2}px)` 
                    : 'scale(1) translate(0px, 0px)',
                  cursor: zoomLevel === 2 ? 'grab' : 'default',
                }}
              >
                <img
                  src={getImageUrl(primaryPhoto)}
                  alt={primaryPhoto.filename}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              </div>

              {/* Status Badges on Canvas */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none z-10">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-black/70 backdrop-blur-md text-white border border-white/10">
                  {primaryIndex + 1} / {activeCluster?.photos.length || 1}
                </span>

                {primaryPhoto.id === activeCluster?.best_photo_id && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/90 text-black font-semibold shadow">
                    <Sparkles size={11} />
                    Sharpest Frame
                  </span>
                )}

                {primaryPhoto.cull_status === 'picked' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500 text-white font-bold">
                    <Check size={11} />
                    PICKED
                  </span>
                )}

                {primaryPhoto.cull_status === 'rejected' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-600 text-white font-bold">
                    <XIcon size={11} />
                    REJECTED
                  </span>
                )}
              </div>

              {/* Candidate Info Overlay */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 text-[11px] font-mono text-white/80 pointer-events-none">
                <span>{primaryPhoto.filename}</span>
                {primaryPhoto.exif_model && <span className="ml-2 text-white/40">· {primaryPhoto.exif_model}</span>}
                {primaryPhoto.rating ? <span className="ml-2 text-amber-400">★ {primaryPhoto.rating}</span> : null}
              </div>
            </div>

            {/* Secondary Candidate Canvas (Dual Comparison Mode) */}
            {compareMode && secondaryPhoto && (
              <div className="flex-1 h-full relative flex items-center justify-center overflow-hidden bg-black/95">
                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: zoomLevel === 2 
                      ? `scale(2) translate(${panOffset.x / 2}px, ${panOffset.y / 2}px)` 
                      : 'scale(1) translate(0px, 0px)',
                    cursor: zoomLevel === 2 ? 'grab' : 'default',
                  }}
                >
                  <img
                    src={getImageUrl(secondaryPhoto)}
                    alt={secondaryPhoto.filename}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                  />
                </div>

                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none z-10">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-black/70 backdrop-blur-md text-white border border-white/10">
                    Compare: Frame {secondaryIndex + 1}
                  </span>

                  {secondaryPhoto.id === activeCluster?.best_photo_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/90 text-black font-semibold shadow">
                      <Sparkles size={11} />
                      Sharpest Frame
                    </span>
                  )}

                  {secondaryPhoto.cull_status === 'picked' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500 text-white font-bold">
                      <Check size={11} />
                      PICKED
                    </span>
                  )}

                  {secondaryPhoto.cull_status === 'rejected' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-600 text-white font-bold">
                      <XIcon size={11} />
                      REJECTED
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 text-[11px] font-mono text-white/80 pointer-events-none">
                  <span>{secondaryPhoto.filename}</span>
                  {secondaryPhoto.exif_model && <span className="ml-2 text-white/40">· {secondaryPhoto.exif_model}</span>}
                  {secondaryPhoto.rating ? <span className="ml-2 text-amber-400">★ {secondaryPhoto.rating}</span> : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Burst Filmstrip Selector */}
      {activeCluster && (
        <div className="h-20 bg-[var(--cr-surface-raised)] border-t border-[var(--cr-border)] flex items-center px-4 gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 mr-2 border-r border-[var(--cr-border)] pr-3 font-mono text-xs text-[var(--cr-text-secondary)]">
            <button
              onClick={() => advanceCandidate(-1)}
              className="p-1 rounded hover:bg-[var(--cr-surface-hover)]"
              title="Previous Photo (Left Arrow)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => advanceCandidate(1)}
              className="p-1 rounded hover:bg-[var(--cr-surface-hover)]"
              title="Next Photo (Right Arrow)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeCluster.photos.map((photo, idx) => {
              const isPrimary = idx === primaryIndex;
              const isSecondary = compareMode && idx === secondaryIndex;
              const isBest = photo.id === activeCluster.best_photo_id;

              return (
                <div
                  key={photo.id}
                  onClick={(e) => {
                    if (e.shiftKey && compareMode) {
                      setSecondaryIndex(idx);
                    } else {
                      setPrimaryIndex(idx);
                    }
                  }}
                  className={`relative w-16 h-16 rounded overflow-hidden cursor-pointer shrink-0 border-2 transition ${
                    isPrimary
                      ? 'border-[var(--cr-accent)] ring-2 ring-[var(--cr-accent)]/30'
                      : isSecondary
                      ? 'border-sky-400 ring-2 ring-sky-400/30'
                      : 'border-transparent hover:border-white/30 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getThumbUrl(photo)}
                    alt=""
                    className="w-full h-full object-cover"
                  />

                  {/* Flag indicator dot */}
                  {photo.cull_status === 'picked' && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-white shadow">
                      <Check size={9} strokeWidth={3} />
                    </div>
                  )}
                  {photo.cull_status === 'rejected' && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-600 border border-white flex items-center justify-center text-white shadow">
                      <XIcon size={9} strokeWidth={3} />
                    </div>
                  )}

                  {isBest && (
                    <div className="absolute bottom-0 inset-x-0 bg-amber-500/90 text-black text-[9px] font-mono text-center font-bold">
                      BEST
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Triage HUD Bar */}
      <footer className="h-12 bg-[var(--cr-surface-sunken)] border-t border-[var(--cr-border)] px-4 flex items-center justify-between shrink-0 font-mono text-xs">
        {/* Triage Stats Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-semibold">
            <Check size={13} />
            <span>Picked: {stats.picked}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold">
            <XIcon size={13} />
            <span>Rejected: {stats.rejected}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] text-[var(--cr-text-muted)]">
            <Minus size={13} />
            <span>Unflagged: {stats.unflagged}</span>
          </div>
        </div>

        {/* Quick Triage Buttons */}
        <div className="flex items-center gap-2">
          {primaryPhoto && (
            <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-[var(--cr-border)] pr-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setPhotoRating(primaryPhoto.id, star)}
                  className={`p-1 rounded hover:bg-[var(--cr-surface-hover)] transition ${
                    (primaryPhoto.rating || 0) >= star ? 'text-amber-400' : 'text-[var(--cr-text-muted)]'
                  }`}
                  title={`Rate ${star} star (${star})`}
                >
                  <Star size={14} fill={(primaryPhoto.rating || 0) >= star ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => primaryPhoto && setPhotoCullStatus(primaryPhoto.id, 'picked')}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition"
            title="Mark as Pick (P)"
          >
            <Check size={14} />
            <span>Pick (P)</span>
          </button>

          <button
            onClick={() => primaryPhoto && setPhotoCullStatus(primaryPhoto.id, 'rejected')}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-rose-600 text-white font-semibold hover:bg-rose-500 transition"
            title="Mark as Reject (X)"
          >
            <XIcon size={14} />
            <span>Reject (X)</span>
          </button>

          <button
            onClick={() => primaryPhoto && setPhotoCullStatus(primaryPhoto.id, 'unflagged')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] text-[var(--cr-text-secondary)] hover:bg-[var(--cr-surface-hover)] transition"
            title="Unflag (U)"
          >
            <Minus size={14} />
            <span>Unflag (U)</span>
          </button>

          <button
            onClick={handlePurge}
            disabled={stats.rejected === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--cr-surface-raised)] border border-[var(--cr-status-error)]/40 text-[var(--cr-status-error)] hover:bg-[var(--cr-status-error)] hover:text-white transition disabled:opacity-40 disabled:pointer-events-none ml-2"
            title="Move all rejected photos to trash"
          >
            <Trash2 size={13} />
            <span>Purge Rejected ({stats.rejected})</span>
          </button>
        </div>
      </footer>

      {/* Undo Toast Notification */}
      {purgeToast && (
        <div className="absolute bottom-16 right-6 z-50 bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] rounded-lg shadow-2xl p-3 flex items-center gap-3 font-mono text-xs">
          <span>Moved {purgeToast.count} photos to trash.</span>
          <button
            onClick={async () => {
              await undoPurge();
              setPurgeToast(null);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--cr-accent)] text-white font-medium hover:opacity-90 transition"
          >
            <RotateCcw size={12} />
            Undo ({purgeToast.timer}s)
          </button>
        </div>
      )}

      {/* Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--cr-surface-raised)] border border-[var(--cr-border)] rounded-lg shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--cr-border)] pb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Keyboard size={16} className="text-[var(--cr-accent)]" />
                Culling Shortcuts
              </h4>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-xs text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Pick Candidate</span>
                <span className="font-bold text-emerald-500">P</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Reject Candidate</span>
                <span className="font-bold text-rose-500">X</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Unflag Candidate</span>
                <span className="font-bold text-[var(--cr-text-muted)]">U</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Star Rating</span>
                <span className="font-bold">1 – 5 (0 to clear)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Dual Compare</span>
                <span className="font-bold">C</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Toggle 200% Zoom</span>
                <span className="font-bold">Space</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Next / Prev Frame</span>
                <span className="font-bold">← / →</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cr-border)]/50">
                <span className="text-[var(--cr-text-secondary)]">Next / Prev Burst</span>
                <span className="font-bold">↑ / ↓</span>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full py-1.5 rounded text-xs font-mono bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] text-[var(--cr-text-primary)] hover:bg-[var(--cr-surface-hover)]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
