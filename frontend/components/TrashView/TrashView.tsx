import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, RotateCcw, AlertTriangle, CheckSquare, Square,
  Play, Info, Clock, AlertCircle, X, ChevronDown, LayoutGrid, Grid3X3,
  Film, Image as ImageIcon
} from 'lucide-react';
import { Photo } from '../../types';
import { API_BASE, photoSrc } from '../../constants';
import { customConfirm } from '../../services/ConfirmService';
import { useTelemetry } from '../../hooks/useTelemetry';

interface TrashViewProps {
  photos: Photo[];
  selectedIds: Set<string>;
  onPhotoClick: (photo: Photo | null) => void;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection?: (ids: string[]) => void;
  onUpdatePhotos?: React.Dispatch<React.SetStateAction<Photo[]>>;
}

type MediaFilter = 'all' | 'photos' | 'videos';
type SortOption = 'days_remaining' | 'size' | 'name';
type DensityOption = 'comfortable' | 'compact';

/**
 * Helper to compute retention days remaining (30 days default auto-purge policy)
 */
function getRetentionDetails(photo: Photo) {
  const dateStr = photo.upload_date || photo.date || photo.date_taken;
  let deletedDate = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(deletedDate.getTime())) {
    deletedDate = new Date();
  }

  const now = Date.now();
  const deletedTime = deletedDate.getTime();
  const elapsedDays = Math.max(0, Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24)));
  
  const idHash = typeof photo.id === 'string' ? photo.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : Number(photo.id);
  const pseudoDays = (Math.abs(idHash) % 30) + 1;
  const daysRemaining = Math.max(1, 30 - (elapsedDays % 30));
  const effectiveDays = daysRemaining <= 0 ? pseudoDays : daysRemaining;

  const isCritical = effectiveDays <= 1;
  const label = isCritical ? '6 hrs left' : `${effectiveDays} days left`;

  return { effectiveDays, isCritical, label };
}

/**
 * Helper to format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * TrashView - Prism Archival Retention & Trash Studio
 */
export const TrashView: React.FC<TrashViewProps> = ({
  photos,
  selectedIds,
  onPhotoClick,
  onToggleSelection,
  onToggleGroupSelection,
  onUpdatePhotos,
}) => {
  const { logAction, logError } = useTelemetry();
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('days_remaining');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [density, setDensity] = useState<DensityOption>('comfortable');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [infoPhoto, setInfoPhoto] = useState<Photo | null>(null);

  // Filter items in trash
  const trashedPhotos = useMemo(
    () => photos.filter((p) => p.isTrash || p.is_trash),
    [photos]
  );

  // Filtered by media type
  const filteredPhotos = useMemo(() => {
    let result = [...trashedPhotos];
    if (mediaFilter === 'photos') {
      result = result.filter((p) => p.type !== 'video' && !p.mime_type?.startsWith('video/'));
    } else if (mediaFilter === 'videos') {
      result = result.filter((p) => p.type === 'video' || p.mime_type?.startsWith('video/'));
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'days_remaining') {
        const retA = getRetentionDetails(a).effectiveDays;
        const retB = getRetentionDetails(b).effectiveDays;
        return retA - retB;
      }
      if (sortOption === 'size') {
        const sizeA = (a as any).fileSize || a.file_size || 0;
        const sizeB = (b as any).fileSize || b.file_size || 0;
        return sizeB - sizeA;
      }
      if (sortOption === 'name') {
        const nameA = a.filename || String(a.id);
        const nameB = b.filename || String(b.id);
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return result;
  }, [trashedPhotos, mediaFilter, sortOption]);

  // Statistics
  const stats = useMemo(() => {
    let photoCount = 0;
    let photoBytes = 0;
    let videoCount = 0;
    let videoBytes = 0;

    trashedPhotos.forEach((p) => {
      const size = (p as any).fileSize || p.file_size || (50 * 1024 * 1024);
      const isVideo = p.type === 'video' || p.mime_type?.startsWith('video/');
      if (isVideo) {
        videoCount++;
        videoBytes += size;
      } else {
        photoCount++;
        photoBytes += size;
      }
    });

    const totalBytes = photoBytes + videoBytes;

    return {
      totalCount: trashedPhotos.length,
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
      photoCount,
      photoBytes,
      formattedPhotos: formatBytes(photoBytes),
      videoCount,
      videoBytes,
      formattedVideos: formatBytes(videoBytes),
    };
  }, [trashedPhotos]);

  // Selected items calculation
  const selectedPhotos = useMemo(() => {
    return trashedPhotos.filter((p) => selectedIds.has(String(p.id)));
  }, [trashedPhotos, selectedIds]);

  const selectedSizeBytes = useMemo(() => {
    return selectedPhotos.reduce((acc, p) => acc + ((p as any).fileSize || p.file_size || (50 * 1024 * 1024)), 0);
  }, [selectedPhotos]);

  const allSelected = useMemo(
    () => trashedPhotos.length > 0 && trashedPhotos.every((p) => selectedIds.has(String(p.id))),
    [trashedPhotos, selectedIds]
  );

  // Toggle select all
  const handleToggleSelectAll = useCallback(() => {
    if (!onToggleGroupSelection) return;
    if (allSelected) {
      onToggleGroupSelection([]);
    } else {
      onToggleGroupSelection(trashedPhotos.map((p) => String(p.id)));
    }
  }, [trashedPhotos, allSelected, onToggleGroupSelection]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    onToggleGroupSelection?.([]);
  }, [onToggleGroupSelection]);

  // Restore single
  const handleRestoreSingle = useCallback(
    async (e: React.MouseEvent, photoId: string | number) => {
      e.stopPropagation();
      const idStr = String(photoId);
      const target = photos.find((p) => String(p.id) === idStr);
      logAction('TrashView', 'restore_single', { photoId: idStr });

      onUpdatePhotos?.((prev) =>
        prev.map((p) =>
          String(p.id) === idStr ? { ...p, isTrash: false, is_trash: false } : p
        )
      );

      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${target?.uuid ?? target?.id}/restore`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error(`Restore failed with status ${res.status}`);
      } catch (err) {
        console.error('Failed to restore photo:', err);
        logError('TrashView', 'restore_single_failed', err, { photoId: idStr });
        onUpdatePhotos?.((prev) =>
          prev.map((p) =>
            String(p.id) === idStr ? { ...p, isTrash: true, is_trash: true } : p
          )
        );
      }
    },
    [photos, onUpdatePhotos, logAction, logError]
  );

  // Delete single permanent
  const handleDeleteSingle = useCallback(
    async (e: React.MouseEvent, photoId: string | number) => {
      e.stopPropagation();
      const idStr = String(photoId);
      const target = photos.find((p) => String(p.id) === idStr);

      if (
        !(await customConfirm(
          'Permanently purge this item from your local archive? This cannot be undone.',
          'Confirm Permanent Removal'
        ))
      ) {
        return;
      }

      logAction('TrashView', 'delete_permanent_single', { photoId: idStr });

      let snapshot: Photo[] = [];
      onUpdatePhotos?.((prev) => {
        snapshot = prev;
        return prev.filter((p) => String(p.id) !== idStr);
      });

      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${target?.uuid ?? target?.id}/purge`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`Purge failed with status ${res.status}`);
      } catch (err) {
        console.error('Failed to purge photo:', err);
        logError('TrashView', 'delete_permanent_single_failed', err, { photoId: idStr });
        if (snapshot.length > 0) onUpdatePhotos?.(() => snapshot);
      }
    },
    [photos, onUpdatePhotos, logAction, logError]
  );

  // Restore selected
  const handleRestoreSelected = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    const ids = selectedPhotos.map((p) => String(p.id));

    logAction('TrashView', 'restore_selected', { count: ids.length });
    setIsProcessing(true);

    onUpdatePhotos?.((prev) =>
      prev.map((p) => (ids.includes(String(p.id)) ? { ...p, isTrash: false, is_trash: false } : p))
    );
    handleClearSelection();

    try {
      await Promise.allSettled(
        selectedPhotos.map((p) =>
          fetch(`${API_BASE}/api/v1/photos/${p.uuid ?? p.id}/restore`, { method: 'POST' })
        )
      );
    } catch (err) {
      console.error('Failed restoring selected items:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhotos, onUpdatePhotos, handleClearSelection, logAction]);

  // Purge selected
  const handlePurgeSelected = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    if (
      !(await customConfirm(
        `Permanently expunge ${selectedPhotos.length} selected items (${formatBytes(selectedSizeBytes)})? This action cannot be rolled back.`,
        'Purge Selected Items'
      ))
    ) {
      return;
    }

    const ids = new Set(selectedPhotos.map((p) => String(p.id)));
    logAction('TrashView', 'purge_selected', { count: ids.size });
    setIsProcessing(true);

    let snapshot: Photo[] = [];
    onUpdatePhotos?.((prev) => {
      snapshot = prev;
      return prev.filter((p) => !ids.has(String(p.id)));
    });
    handleClearSelection();

    try {
      await Promise.allSettled(
        selectedPhotos.map((p) =>
          fetch(`${API_BASE}/api/v1/photos/${p.uuid ?? p.id}/purge`, { method: 'DELETE' })
        )
      );
    } catch (err) {
      console.error('Failed purging selected items:', err);
      if (snapshot.length > 0) onUpdatePhotos?.(() => snapshot);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhotos, selectedSizeBytes, onUpdatePhotos, handleClearSelection, logAction]);

  // Restore all
  const handleRestoreAll = useCallback(async () => {
    if (trashedPhotos.length === 0) return;
    if (
      !(await customConfirm(
        `Restore all ${trashedPhotos.length} items back to your archive library?`,
        'Restore All Items'
      ))
    ) {
      return;
    }

    logAction('TrashView', 'restore_all', { count: trashedPhotos.length });
    setIsProcessing(true);
    const ids = trashedPhotos.map((p) => String(p.id));

    onUpdatePhotos?.((prev) =>
      prev.map((p) => (ids.includes(String(p.id)) ? { ...p, isTrash: false, is_trash: false } : p))
    );

    try {
      await Promise.allSettled(
        trashedPhotos.map((p) =>
          fetch(`${API_BASE}/api/v1/photos/${p.uuid ?? p.id}/restore`, { method: 'POST' })
        )
      );
    } catch (err) {
      console.error('Failed to restore all photos:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [trashedPhotos, onUpdatePhotos, logAction]);

  // Execute full empty trash from modal
  const handleConfirmExpungeAll = useCallback(async () => {
    setShowPurgeModal(false);
    if (trashedPhotos.length === 0) return;

    logAction('TrashView', 'empty_trash_confirmed', { count: trashedPhotos.length });
    setIsProcessing(true);
    const itemsToPurge = [...trashedPhotos];
    const purgeIds = new Set(itemsToPurge.map((p) => String(p.id)));

    let snapshot: Photo[] = [];
    onUpdatePhotos?.((prev) => {
      snapshot = prev;
      return prev.filter((p) => !purgeIds.has(String(p.id)));
    });

    try {
      await Promise.allSettled(
        itemsToPurge.map((p) =>
          fetch(`${API_BASE}/api/v1/photos/${p.uuid ?? p.id}/purge`, { method: 'DELETE' })
        )
      );
    } catch (err) {
      console.error('Failed to empty trash:', err);
      if (snapshot.length > 0) onUpdatePhotos?.(() => snapshot);
    } finally {
      setIsProcessing(false);
    }
  }, [trashedPhotos, onUpdatePhotos, logAction]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#151312] overflow-y-auto px-4 md:px-8 py-6 select-none relative font-sans text-[#e7e1df]">
      {/* ── Atmospheric Ambient Canvas Backlights ── */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-16 left-1/4 w-96 h-96 bg-[#c6c6c7]/5 rounded-full blur-[140px]" />
        <div className="absolute top-24 right-12 w-80 h-80 bg-[#ffb4ab]/5 rounded-full blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col gap-6">
        {/* ── Header & Telemetry ── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-mono tracking-widest text-[#998f8a] uppercase">
                  Local Vault • Archival Retention
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2c2928] text-[#d0c4be] text-[11px] font-medium border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9c6c4]" />
                  Auto-Purge Active (30d)
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl md:text-4xl font-serif text-[#e7e1df] tracking-tight font-normal">
                  Trash Archive
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#211f1e] text-[12px] font-medium text-[#e7e1df] border border-white/[0.05]">
                    {stats.totalCount} {stats.totalCount === 1 ? 'Item' : 'Items'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#373433] text-[12px] font-medium text-[#ffb4ab] border border-[#ffb4ab]/10">
                    {stats.formattedTotal} Reclaimable
                  </span>
                </div>
              </div>

              <p className="text-[13px] text-[#a8a29e] max-w-2xl mt-2 leading-relaxed">
                Items are held in local isolation before irreversible removal. Master RAWs and ProRes files remain intact until the retention countdown lapses.
              </p>
            </div>

            {/* Global Actions */}
            {trashedPhotos.length > 0 && (
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c2928] hover:bg-[#3b3937] text-[#e7e1df] text-xs font-medium border border-white/[0.06] transition-all duration-150 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>Restore All ({stats.totalCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPurgeModal(true)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#93000a]/80 hover:bg-[#93000a] text-[#ffdad6] text-xs font-medium border border-[#ffb4ab]/20 transition-all duration-150 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Empty Trash ({stats.formattedTotal})</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Storage Impact Sparkline & Filter Strip ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-[#1d1b1a] border border-white/[0.05] rounded-xl p-3.5 shadow-sm">
            {/* Media Filters */}
            <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMediaFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  mediaFilter === 'all'
                    ? 'bg-[#121414] text-[#e7e1df] border border-white/10 shadow-sm'
                    : 'bg-[#211f1e] text-[#a8a29e] hover:text-[#e7e1df]'
                }`}
              >
                All Media <span className="text-[#c6c6c7] ml-1 font-mono">{stats.totalCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaFilter('photos')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  mediaFilter === 'photos'
                    ? 'bg-[#121414] text-[#e7e1df] border border-white/10 shadow-sm'
                    : 'bg-[#211f1e] text-[#a8a29e] hover:text-[#e7e1df]'
                }`}
              >
                RAW & Photos <span className="text-[#998f8a] ml-1 font-mono">{stats.photoCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaFilter('videos')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  mediaFilter === 'videos'
                    ? 'bg-[#121414] text-[#e7e1df] border border-white/10 shadow-sm'
                    : 'bg-[#211f1e] text-[#a8a29e] hover:text-[#e7e1df]'
                }`}
              >
                4K Video Masters <span className="text-[#998f8a] ml-1 font-mono">{stats.videoCount}</span>
              </button>

              <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#998f8a]">
                <span className="uppercase text-[10px] tracking-wider font-mono">Vault Footprint:</span>
                <span className="text-[#c9c6c4] font-medium font-mono">{stats.formattedTotal} of 2 TB Local NVMe</span>
              </div>
            </div>

            {/* Storage Breakdown Visual (Mini Donut + Details) */}
            <div className="lg:col-span-3 flex items-center gap-3">
              <div className="relative w-8 h-8 shrink-0">
                <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                  <circle className="text-[#373433]" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeWidth="4" />
                  <circle className="text-[#c6c6c7]" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="88" strokeDashoffset="62" strokeWidth="4" />
                  <circle className="text-[#ffb4ab]" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="88" strokeDashoffset="26" strokeWidth="4" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0 text-xs">
                <span className="text-[#d0c4be] truncate font-medium">
                  Photos {stats.formattedPhotos} • Video {stats.formattedVideos}
                </span>
                <span className="text-[#998f8a] text-[11px]">
                  Earliest purge in <span className="text-[#ffb4ab] font-medium">6 hours</span>
                </span>
              </div>
            </div>

            {/* Controls: Sort & Density */}
            <div className="lg:col-span-3 flex items-center justify-end gap-2.5">
              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium border border-white/[0.06] transition-colors cursor-pointer"
                >
                  <span className="text-[#998f8a]">Sort:</span>
                  <span className="capitalize">
                    {sortOption === 'days_remaining' ? 'Days Remaining' : sortOption === 'size' ? 'File Size' : 'Filename'}
                  </span>
                  <ChevronDown size={14} className="text-[#998f8a]" />
                </button>

                {isSortOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-[#1d1b1a] border border-white/10 rounded-xl py-1 shadow-2xl z-30">
                    <button
                      type="button"
                      onClick={() => { setSortOption('days_remaining'); setIsSortOpen(false); }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-[#e7e1df] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      Days Remaining
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSortOption('size'); setIsSortOpen(false); }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-[#e7e1df] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      File Size
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSortOption('name'); setIsSortOpen(false); }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-[#e7e1df] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      Filename
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Density */}
              <div className="flex items-center bg-[#211f1e] p-0.5 rounded-lg border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    density === 'comfortable' ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm' : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                  title="Comfortable Grid"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    density === 'compact' ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm' : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                  title="Compact Grid"
                >
                  <Grid3X3 size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky Selection Action Bar ── */}
        <AnimatePresence>
          {selectedPhotos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="sticky top-4 z-30 w-full"
            >
              <div className="bg-[#373433]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded accent-[#c6c6c7] bg-[#100e0d] border-[#4d4541] cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-[#e7e1df]">
                      {selectedPhotos.length} {selectedPhotos.length === 1 ? 'item' : 'items'} selected
                    </span>
                  </label>
                  <span className="text-xs font-mono text-[#c9c6c4]">
                    • {formatBytes(selectedSizeBytes)} staged
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-[11px] font-mono tracking-wider uppercase text-[#c6c6c7] hover:underline underline-offset-4 ml-1 cursor-pointer"
                  >
                    {allSelected ? 'Deselect All' : `Select All ${stats.totalCount} Items (${stats.formattedTotal})`}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreSelected}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1d1b1a] hover:bg-[#3b3937] text-[#e7e1df] text-xs font-medium border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    <span>Restore to Origin</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePurgeSelected}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffb4ab] text-[#690005] hover:opacity-90 text-xs font-medium transition-opacity shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>Purge Permanently</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#998f8a] hover:text-[#e7e1df] hover:bg-[#211f1e] transition-colors cursor-pointer"
                    title="Clear selection"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Media Grid ── */}
        {filteredPhotos.length === 0 ? (
          <div className="min-h-[380px] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[#1d1b1a]/50 border border-white/[0.04]">
            <div className="w-16 h-16 rounded-2xl bg-[#211f1e] border border-white/[0.06] flex items-center justify-center mb-4 text-[#998f8a]">
              <Trash2 size={28} />
            </div>
            <h3 className="text-base font-serif text-[#e7e1df] font-normal mb-1">
              Trash Archive is Clear
            </h3>
            <p className="text-xs text-[#a8a29e] max-w-sm leading-relaxed mb-4">
              Deleted negatives and video clips are stored safely in local isolation before irreversible removal.
            </p>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#211f1e] border border-white/[0.06] text-[11px] text-[#998f8a] font-mono">
              <Clock size={12} className="text-[#34d399]" />
              <span>Retention policy: 30 days automated rolling purge</span>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-4 pb-16 ${
              density === 'comfortable'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
            }`}
          >
            <AnimatePresence>
              {filteredPhotos.map((photo) => {
                const idStr = String(photo.id);
                const isSelected = selectedIds.has(idStr);
                const src = photoSrc(photo);
                const retention = getRetentionDetails(photo);
                const isVideo = photo.type === 'video' || photo.mime_type?.startsWith('video/');
                const size = (photo as any).fileSize || photo.file_size || (50 * 1024 * 1024);
                const cameraInfo = photo.exif_model || (photo.width && photo.height ? `${photo.width}×${photo.height}` : 'Local Capture');
                const originAlbum = photo.location || photo.city || 'Primary Vault';

                return (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => onPhotoClick(photo)}
                    className="group relative flex flex-col bg-[#1d1b1a] hover:bg-[#211f1e] rounded-xl overflow-hidden transition-all duration-200 border border-white/[0.05] hover:border-white/15 shadow-sm hover:shadow-lg cursor-pointer"
                  >
                    {/* Media Thumbnail Container */}
                    <div className="relative w-full aspect-[4/5] bg-[#100e0d] overflow-hidden">
                      <img
                        src={src}
                        alt={photo.filename || 'Trashed media'}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Selection Checkbox */}
                      <div className="absolute top-2.5 left-2.5 z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelection(idStr);
                          }}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#c6c6c7] text-[#1a1c1c] shadow-md'
                              : 'bg-[#100e0d]/70 backdrop-blur-md border border-white/20 text-transparent hover:border-white/40'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Retention Countdown Badge */}
                      <div className="absolute top-2.5 right-2.5 z-20">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider flex items-center gap-1 backdrop-blur-md shadow-sm border ${
                            retention.isCritical
                              ? 'bg-[#93000a]/90 text-[#ffdad6] border-[#ffb4ab]/30'
                              : 'bg-[#373433]/90 text-[#d0c4be] border-white/10'
                          }`}
                        >
                          <Clock size={11} className={retention.isCritical ? 'text-[#ffb4ab]' : 'text-[#a8a29e]'} />
                          {retention.label}
                        </span>
                      </div>

                      {/* Video Duration / Specs Badge */}
                      {isVideo && (
                        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[#e7e1df] font-mono text-[10px] border border-white/10">
                          <Play size={10} className="fill-current" />
                          <span>{photo.duration ? `${Math.floor(photo.duration / 60)}:${Math.floor(photo.duration % 60).toString().padStart(2, '0')}` : '02:45'} • {photo.codec || 'ProRes 422'}</span>
                        </div>
                      )}

                      {/* Hover Floating Action Bar */}
                      <div className="absolute inset-x-2 bottom-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-between p-1 bg-[#100e0d]/90 backdrop-blur-md rounded-full shadow-xl border border-white/10">
                        <button
                          type="button"
                          onClick={(e) => handleRestoreSingle(e, photo.id)}
                          className="p-1.5 rounded-full hover:bg-[#3b3937] text-[#e7e1df] hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Restore item"
                        >
                          <RotateCcw size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfoPhoto(photo);
                          }}
                          className="p-1.5 rounded-full hover:bg-[#3b3937] text-[#a8a29e] hover:text-[#e7e1df] transition-colors cursor-pointer"
                          title="View metadata"
                        >
                          <Info size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSingle(e, photo.id)}
                          className="p-1.5 rounded-full hover:bg-[#93000a]/50 text-[#ffb4ab] transition-colors cursor-pointer"
                          title="Purge immediately"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Subtle Top & Bottom Vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d] via-transparent to-black/25 pointer-events-none" />
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-3 flex flex-col gap-0.5">
                      <h3 className="font-serif text-sm text-[#e7e1df] truncate tracking-tight font-light">
                        {photo.filename || `Archival_Plate_${photo.id}`}
                      </h3>
                      <p className="text-[11px] text-[#998f8a] font-mono truncate">
                        {formatBytes(size)} • {cameraInfo}
                      </p>
                      <span className="text-[11px] text-[#a8a29e] truncate mt-0.5">
                        Origin: <span className="text-[#c9c6c4]">{originAlbum}</span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Empty Trash Confirmation Modal Dialog ── */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-[#1d1b1a] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 overflow-hidden">
            {/* Ambient Modal Glow */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#ffb4ab]/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#93000a]/30 border border-[#ffb4ab]/20 text-[#ffb4ab] flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-mono tracking-widest text-[#ffb4ab] uppercase font-semibold">
                  Irreversible Action
                </span>
                <h2 className="text-xl font-serif text-[#e7e1df] font-normal mt-0.5">
                  Permanently Expunge {stats.totalCount} Items?
                </h2>
                <p className="text-xs text-[#a8a29e] mt-2 leading-relaxed">
                  This will permanently erase <strong className="text-[#e7e1df] font-medium font-mono">{stats.formattedTotal}</strong> of camera RAW captures and video masters from your local cache and disk vault. This operation cannot be rolled back.
                </p>
              </div>
            </div>

            {/* File Breakdown Table */}
            <div className="bg-[#211f1e] border border-white/[0.05] rounded-xl p-3.5 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center text-[#e7e1df]">
                <span className="flex items-center gap-2">
                  <ImageIcon size={15} className="text-[#998f8a]" />
                  <span>{stats.photoCount} RAW Digital Negatives</span>
                </span>
                <span className="text-[#c9c6c4] font-mono">{stats.formattedPhotos}</span>
              </div>

              <div className="flex justify-between items-center text-[#e7e1df]">
                <span className="flex items-center gap-2">
                  <Film size={15} className="text-[#998f8a]" />
                  <span>{stats.videoCount} Master Video Files (4K/ProRes)</span>
                </span>
                <span className="text-[#c9c6c4] font-mono">{stats.formattedVideos}</span>
              </div>

              <div className="h-px bg-white/10 my-1" />

              <div className="flex justify-between items-center font-medium">
                <span className="text-[#e7e1df]">Total Reclaimed Local Capacity</span>
                <span className="text-[#ffb4ab] font-mono font-semibold">{stats.formattedTotal}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 rounded-full bg-[#2c2928] hover:bg-[#3b3937] text-[#e7e1df] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel • Keep in Archive
              </button>
              <button
                type="button"
                onClick={handleConfirmExpungeAll}
                className="px-4 py-2 rounded-full bg-[#ffb4ab] hover:opacity-90 text-[#690005] text-xs font-medium transition-opacity shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} />
                <span>Expunge All Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Metadata Info Modal ── */}
      {infoPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#1d1b1a] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-serif text-lg text-[#e7e1df]">Plate Information</h3>
              <button
                type="button"
                onClick={() => setInfoPhoto(null)}
                className="text-[#998f8a] hover:text-[#e7e1df] p-1 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#998f8a]">Filename</span>
                <span className="text-[#e7e1df] truncate max-w-[200px]">{infoPhoto.filename || `Photo #${infoPhoto.id}`}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#998f8a]">File Size</span>
                <span className="text-[#e7e1df]">{formatBytes((infoPhoto as any).fileSize || infoPhoto.file_size || 0)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#998f8a]">Dimensions</span>
                <span className="text-[#e7e1df]">{infoPhoto.width} × {infoPhoto.height} px</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#998f8a]">Origin</span>
                <span className="text-[#e7e1df]">{infoPhoto.location || infoPhoto.city || 'Primary Vault'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#998f8a]">Camera</span>
                <span className="text-[#e7e1df]">{infoPhoto.exif_make ? `${infoPhoto.exif_make} ${infoPhoto.exif_model || ''}` : 'Camera Negatives'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#998f8a]">Retention Status</span>
                <span className="text-[#ffb4ab]">{getRetentionDetails(infoPhoto).label}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInfoPhoto(null)}
                className="px-4 py-1.5 rounded-full bg-[#2c2928] text-xs text-[#e7e1df] hover:bg-[#3b3937] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashView;
