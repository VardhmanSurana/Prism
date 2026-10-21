import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, FolderMinus, Trash2, Heart,
  RotateCcw, BookmarkPlus,
  Share2, Sliders, Lock, Unlock,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { useBulkActions } from './useBulkActions';
import { soundEffects } from '@/utils/soundEffects';
import { customConfirm } from '@/services/ConfirmService';
import { ActionButton } from './ActionButton';
import './BulkActionsBar.css';

// ─── Component props ─────────────────────────────────────────────────────
export interface BulkActionsBarProps {
  selectedCount: number;
  currentView: ViewMode;
  onClear: () => void;
  onAddToAlbum: () => void;
  albumAddedSignal?: number;
  onRemoveFromAlbum?: () => void;
  onToggleLock: () => void;
  onFavorite: () => void;
  onDelete: (skipConfirm?: boolean) => void;
  onRestore?: () => void;
  onCollage?: () => void;
  onPhotoBook?: () => void;
  onToolbox?: () => void;
  isFavorited?: boolean;
  onPasteEdits?: () => void;
  onShare?: () => void;
}

// ─── BulkActionsBar ──────────────────────────────────────────────────────
/**
 * BulkActionsBar - Renders bulk actions bar.
 */
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  currentView,
  onClear,
  onAddToAlbum,
  albumAddedSignal,
  onRemoveFromAlbum,
  onToggleLock,
  onFavorite,
  onDelete,
  onRestore,
  onCollage,
  onPhotoBook,
  onToolbox,
  isFavorited,
  onPasteEdits,
  onShare,
}) => {
  const { isTrashView } = useBulkActions({ selectedCount, currentView });

  const prevCount = useRef(selectedCount);
  const [open, setOpen] = useState(selectedCount > 0);

  // ── Favorite ──────────────────────────────────────────────────────────
  const handleFavorite = useCallback(() => {
    soundEffects.play(isFavorited ? 'click' : 'favorite');
    onFavorite();
    onClear();
  }, [isFavorited, onFavorite, onClear]);

  // Close button
  const handleClose = useCallback(() => {
    setOpen(false);
    onClear();
  }, [onClear]);

  // ── Add to Album (no animation, just call handler) ────────────────────
  const handleAddToAlbum = useCallback(() => {
    if (selectedCount === 0) return;
    onAddToAlbum();
    onClear();
  }, [selectedCount, onAddToAlbum, onClear]);

  useEffect(() => {
    if (albumAddedSignal && albumAddedSignal > 0) {
      onClear();
    }
  }, [albumAddedSignal, onClear]);

  // ── Lock (no animation, just call handler) ────────────────────────────
  const handleLock = useCallback(() => {
    if (selectedCount === 0) return;
    onToggleLock();
    onClear();
  }, [selectedCount, onToggleLock, onClear]);

  // ── Trash ─────────────────────────────────────────────────────────────
  const handleTrashClick = useCallback(async () => {
    if (selectedCount === 0) return;

    if (isTrashView) {
      onDelete();
      return;
    }

    const isPermanent = currentView === 'trash';
    const message = isPermanent
      ? `Permanently delete ${selectedCount} items from Trash?`
      : `Move ${selectedCount} items to Trash?`;

    const confirmed = await customConfirm(message, 'Confirm Deletion');
    if (!confirmed) return;

    onDelete(true);
    onClear();
  }, [selectedCount, isTrashView, currentView, onDelete, onClear]);

  // Visibility
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = selectedCount;

    if (prev === 0 && selectedCount > 0) {
      setOpen(true);
    } else if (selectedCount === 0 && open) {
      setOpen(false);
    }
  }, [selectedCount, open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
      <div className="bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-2 flex items-center shadow-2xl shadow-black/80">
        {/* ── Left: dot + count + clear cross ── */}
        <div className="flex items-center gap-2.5 pr-4 border-r border-white/10 select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] inline-block flex-shrink-0" />
          <span className="font-medium text-white text-sm whitespace-nowrap tracking-tight">
            {selectedCount} Selected
          </span>
          <button
            onClick={handleClose}
            className="p-1 text-[#a8a29e] hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0 ml-0.5"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Right: action icons ── */}
        <div className="flex items-center pl-2 gap-1 sm:gap-2">
          {isTrashView ? (
            <>
              <ActionButton onClick={() => { onRestore?.(); onClear(); }} label="Restore" className="hover:text-green-400">
                <RotateCcw size={20} strokeWidth={1.8} />
              </ActionButton>
              <ActionButton onClick={() => { onDelete(false); onClear(); }} label="Delete" className="text-[#f87171] hover:text-red-400" labelClassName="text-[#f87171]">
                <Trash2 size={20} strokeWidth={1.8} />
              </ActionButton>
            </>
          ) : (
            <>
              {/* Favorite */}
              <ActionButton
                onClick={handleFavorite}
                label="Favorite"
                className={isFavorited ? 'text-rose-400 hover:text-rose-300' : 'hover:text-white'}
                labelClassName={isFavorited ? 'text-rose-400' : ''}
              >
                <Heart size={20} strokeWidth={1.8} className={isFavorited ? 'fill-rose-400' : ''} />
              </ActionButton>

              {/* Album (or remove if in album view) */}
              {currentView === 'albums' && onRemoveFromAlbum ? (
                <ActionButton onClick={() => { onRemoveFromAlbum(); onClear(); }} label="Remove" className="hover:text-red-400">
                  <FolderMinus size={20} strokeWidth={1.8} />
                </ActionButton>
              ) : (
                <ActionButton onClick={handleAddToAlbum} label="Album">
                  <BookmarkPlus size={20} strokeWidth={1.8} />
                </ActionButton>
              )}

              {/* Share */}
              {onShare && (
                <ActionButton onClick={onShare} label="Share">
                  <Share2 size={20} strokeWidth={1.8} />
                </ActionButton>
              )}

              {/* Toolbox */}
              {onToolbox && (
                <ActionButton onClick={onToolbox} label="Toolbox">
                  <Sliders size={20} strokeWidth={1.8} />
                </ActionButton>
              )}

              {/* Lock / Vault */}
              <ActionButton
                onClick={currentView === 'locked' ? () => { onToggleLock(); onClear(); } : handleLock}
                label={currentView === 'locked' ? 'Unlock' : 'Lock'}
                className={currentView === 'locked' ? 'text-amber-400' : ''}
              >
                {currentView === 'locked' ? (
                  <Unlock size={20} strokeWidth={1.8} />
                ) : (
                  <Lock size={20} strokeWidth={1.8} />
                )}
              </ActionButton>

              {/* Divider before Trash */}
              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Trash */}
              <ActionButton
                onClick={handleTrashClick}
                label="Trash"
                className="text-[#f87171] hover:text-red-400"
                labelClassName="text-[#f87171] group-hover/btn:text-red-400"
              >
                <Trash2 size={20} strokeWidth={1.8} />
              </ActionButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
