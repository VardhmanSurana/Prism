import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, ShieldAlert, CheckSquare, Square, AlertCircle } from 'lucide-react';
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

  // Filter items in trash
  const trashedPhotos = useMemo(
    () => photos.filter((p) => p.isTrash || p.is_trash),
    [photos]
  );

  // Calculate total storage occupied by trashed photos
  const totalSizeBytes = useMemo(
    () => trashedPhotos.reduce((acc, p) => acc + ((p as any).fileSize || p.file_size || 0), 0),
    [trashedPhotos]
  );

  const formattedTotalSize = useMemo(() => {
    if (totalSizeBytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(totalSizeBytes) / Math.log(k));
    return `${parseFloat((totalSizeBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, [totalSizeBytes]);

  // Restore a single photo
  const handleRestoreSingle = useCallback(
    async (e: React.MouseEvent, photoId: string | number) => {
      e.stopPropagation();
      const idStr = String(photoId);
      logAction('TrashView', 'restore_single', { photoId: idStr });

      // Optimistic update
      onUpdatePhotos?.((prev) =>
        prev.map((p) =>
          String(p.id) === idStr ? { ...p, isTrash: false, is_trash: false } : p
        )
      );

      try {
        await fetch(`${API_BASE}/api/v1/photos/${idStr}/trash`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to restore photo:', err);
        logError('TrashView', 'restore_single_failed', err, { photoId: idStr });
        // Rollback
        onUpdatePhotos?.((prev) =>
          prev.map((p) =>
            String(p.id) === idStr ? { ...p, isTrash: true, is_trash: true } : p
          )
        );
      }
    },
    [onUpdatePhotos, logAction, logError]
  );

  // Permanently remove a single photo from local state
  const handleDeleteSingle = useCallback(
    async (e: React.MouseEvent, photoId: string | number) => {
      e.stopPropagation();
      const idStr = String(photoId);

      if (
        !(await customConfirm(
          'Permanently delete this photo from trash? This action cannot be undone.',
          'Confirm Deletion'
        ))
      ) {
        return;
      }

      logAction('TrashView', 'delete_permanent_single', { photoId: idStr });
      onUpdatePhotos?.((prev) => prev.filter((p) => String(p.id) !== idStr));
    },
    [onUpdatePhotos, logAction]
  );

  // Restore all trashed photos
  const handleRestoreAll = useCallback(async () => {
    if (trashedPhotos.length === 0) return;
    if (
      !(await customConfirm(
        `Restore all ${trashedPhotos.length} items back to your library?`,
        'Restore All Items'
      ))
    ) {
      return;
    }

    logAction('TrashView', 'restore_all', { count: trashedPhotos.length });
    setIsProcessing(true);
    const ids = trashedPhotos.map((p) => String(p.id));

    // Optimistic restore
    onUpdatePhotos?.((prev) =>
      prev.map((p) =>
        ids.includes(String(p.id)) ? { ...p, isTrash: false, is_trash: false } : p
      )
    );

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${API_BASE}/api/v1/photos/${id}/trash`, { method: 'POST' })
        )
      );
    } catch (err) {
      console.error('Failed to restore all photos:', err);
      logError('TrashView', 'restore_all_failed', err, { count: ids.length });
    } finally {
      setIsProcessing(false);
    }
  }, [trashedPhotos, onUpdatePhotos, logAction, logError]);

  // Empty Trash completely
  const handleEmptyTrash = useCallback(async () => {
    if (trashedPhotos.length === 0) return;
    if (
      !(await customConfirm(
        `Permanently delete all ${trashedPhotos.length} items in Trash? This action is permanent and cannot be undone.`,
        'Empty Trash'
      ))
    ) {
      return;
    }

    logAction('TrashView', 'empty_trash', { count: trashedPhotos.length });
    setIsProcessing(true);
    const ids = new Set(trashedPhotos.map((p) => String(p.id)));

    // Optimistic removal
    onUpdatePhotos?.((prev) => prev.filter((p) => !ids.has(String(p.id))));
    setIsProcessing(false);
  }, [trashedPhotos, onUpdatePhotos, logAction]);

  // Select all / deselect all in Trash
  const allSelected = useMemo(
    () =>
      trashedPhotos.length > 0 &&
      trashedPhotos.every((p) => selectedIds.has(String(p.id))),
    [trashedPhotos, selectedIds]
  );

  const handleToggleSelectAll = useCallback(() => {
    if (!onToggleGroupSelection) return;
    const ids = trashedPhotos.map((p) => String(p.id));
    if (allSelected) {
      onToggleGroupSelection([]);
    } else {
      onToggleGroupSelection(ids);
    }
  }, [trashedPhotos, allSelected, onToggleGroupSelection]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#06080c] overflow-y-auto px-4 md:px-8 py-6 select-none">
      {/* Header Banner */}
      <div className="max-w-7xl mx-auto w-full mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
                Trash
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono tabular-nums bg-white/[0.06] text-white/60 border border-white/[0.08]">
                {trashedPhotos.length} {trashedPhotos.length === 1 ? 'item' : 'items'}
              </span>
              {totalSizeBytes > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono tabular-nums bg-white/[0.04] text-white/40 border border-white/[0.06]">
                  {formattedTotalSize}
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-1.5 flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-amber-400/80 shrink-0" />
              <span>Items in Trash are retained for safety before permanent deletion.</span>
            </p>
          </div>

          {trashedPhotos.length > 0 && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors 150ms ease, background-color 150ms ease"
              >
                {allSelected ? (
                  <CheckSquare size={14} className="text-[#0a84ff]" />
                ) : (
                  <Square size={14} className="text-white/40" />
                )}
                <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreAll}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-colors 150ms ease, background-color 150ms ease disabled:opacity-50"
              >
                <RotateCcw size={14} className="text-emerald-400" />
                <span>Restore All</span>
              </button>

              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 transition-colors 150ms ease, background-color 150ms ease, border-color 150ms ease disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>Empty Trash</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full flex-1">
        {trashedPhotos.length === 0 ? (
          /* Empty State */
          <div className="min-h-[420px] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-white/[0.015] border border-white/[0.04]">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4 text-white/30">
              <Trash2 size={28} />
            </div>
            <h3 className="text-base font-medium text-white/80 mb-1">
              Trash is empty
            </h3>
            <p className="text-xs text-white/40 max-w-sm leading-relaxed mb-4">
              Photos and videos you delete will appear here before being permanently removed from your library.
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] text-[11px] text-white/35 font-mono">
              <AlertCircle size={12} className="text-blue-400/70" />
              <span>Deleted items are safely stored offline</span>
            </div>
          </div>
        ) : (
          /* Photo Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 pb-12">
            <AnimatePresence>
              {trashedPhotos.map((photo) => {
                const idStr = String(photo.id);
                const isSelected = selectedIds.has(idStr);
                const src = photoSrc(photo);

                return (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => onPhotoClick(photo)}
                    className={`group relative aspect-square rounded-xl overflow-hidden bg-surface border transition-colors 150ms ease, border-color 150ms ease, box-shadow 150ms ease cursor-pointer ${
                      isSelected
                        ? 'border-[#0a84ff] ring-2 ring-[#0a84ff]/30 shadow-lg'
                        : 'border-white/[0.08] hover:border-white/20 hover:shadow-md'
                    }`}
                  >
                    {/* Image Thumbnail */}
                    <img
                      src={src}
                      alt={photo.filename || 'Trashed photo'}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

                    {/* Selection Indicator (Top Left) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelection(idStr);
                      }}
                      className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors 150ms ease, background-color 150ms ease ${
                        isSelected
                          ? 'bg-[#0a84ff] text-white shadow-md'
                          : 'bg-black/40 backdrop-blur-md border border-white/20 text-transparent group-hover:text-white/60 hover:bg-black/60'
                      }`}
                    >
                      <CheckSquare size={14} className={isSelected ? 'block' : 'hidden group-hover:block'} />
                    </button>

                    {/* Quick Card Action Buttons (Top Right) */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        type="button"
                        title="Restore photo"
                        onClick={(e) => handleRestoreSingle(e, photo.id)}
                        className="w-7 h-7 rounded-lg bg-black/60 hover:bg-emerald-500/80 backdrop-blur-md border border-white/20 hover:border-emerald-400 text-white flex items-center justify-center transition-colors 150ms ease, border-color 150ms ease shadow-md"
                      >
                        <RotateCcw size={13} />
                      </button>

                      <button
                        type="button"
                        title="Delete permanently"
                        onClick={(e) => handleDeleteSingle(e, photo.id)}
                        className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80 backdrop-blur-md border border-white/20 hover:border-red-400 text-white flex items-center justify-center transition-colors 150ms ease, border-color 150ms ease shadow-md"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Card Footer Meta (Bottom Left) */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-between text-[10px] text-white/70 font-mono">
                      <span className="truncate max-w-[70%]">
                        {photo.filename || `Photo #${photo.id}`}
                      </span>
                      {((photo as any).fileSize || photo.file_size) && (
                        <span className="text-white/40 tabular-nums">
                          {(((photo as any).fileSize || photo.file_size || 0) / (1024 * 1024)).toFixed(1)}MB
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashView;
