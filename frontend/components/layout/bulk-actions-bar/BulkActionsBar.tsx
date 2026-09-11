import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FolderMinus, Trash2, Heart,
  RotateCcw, LayoutGrid, BookOpen, ClipboardPaste,
  Share2,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { useBulkActions } from './useBulkActions';
import { useEditStore } from '@/store/editStore';
import { soundEffects } from '@/utils/soundEffects';
import { customConfirm } from '@/services/ConfirmService';
import { ActionButton } from './ActionButton';
import { CssTrashIcon, CssFolderIcon, CssVaultIcon } from './BulkActionIcons';
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
  const copiedAdjustments = useEditStore((s) => s.copiedAdjustments);

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
    <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2">
      <div
        className="bg-surface/90 backdrop-blur-xl rounded-full px-4 py-2.5 flex items-center gap-3"
      >
        {/* ── Left: clear + count ────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-border/30 select-none">
          <button
            onClick={handleClose}
            className="p-1 hover:bg-surfaceHover rounded-full transition-colors flex-shrink-0"
            title="Clear selection"
          >
            <X size={18} className="text-gray-400" />
          </button>
          <span className="font-bold text-gray-100 text-sm whitespace-nowrap">
            {selectedCount} selected
          </span>
        </div>

        {/* ── Right: action icons ──────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          {isTrashView ? (
            <>
              <ActionButton onClick={() => { onRestore?.(); onClear(); }} label="Restore" className="hover:text-green-400">
                <RotateCcw size={20} />
              </ActionButton>
              <ActionButton onClick={() => { onDelete(false); onClear(); }} label="Delete Permanently" className="hover:text-red-400">
                <Trash2 size={20} />
              </ActionButton>
            </>
          ) : (
            <>
              {/* Productive actions */}
              <ActionButton
                onClick={handleFavorite}
                label={isFavorited ? 'Unfavorite' : 'Favorite'}
                className={isFavorited ? 'text-rose-400 hover:text-rose-300' : 'hover:text-rose-400'}
              >
                <Heart size={20} className={isFavorited ? 'fill-rose-400' : ''} />
              </ActionButton>

              {currentView === 'albums' && onRemoveFromAlbum && (
                <ActionButton onClick={() => { onRemoveFromAlbum(); onClear(); }} label="Remove from Album" className="hover:text-red-400">
                  <FolderMinus size={20} />
                </ActionButton>
              )}

              <ActionButton onClick={handleAddToAlbum} label="Album">
                <CssFolderIcon />
              </ActionButton>

              {onShare && (
                <ActionButton onClick={onShare} label="Share" className="hover:text-primary">
                  <Share2 size={20} />
                </ActionButton>
              )}

              {onToolbox && (
                <ActionButton onClick={onToolbox} label="Toolbox" className="hover:text-primary">
                  <img src="/toolbox.svg" alt="Toolbox" className="w-5 h-5 object-contain filter invert brightness-125" />
                </ActionButton>
              )}

              {copiedAdjustments && onPasteEdits && (
                <ActionButton onClick={() => { onPasteEdits(); onClear(); }} label="Paste Edits" className="hover:text-primary">
                  <ClipboardPaste size={20} />
                </ActionButton>
              )}

              {/* State-changing actions */}
              <div className="w-px h-7 bg-border/30 mx-1" />

              <ActionButton
                onClick={currentView === 'locked' ? () => { onToggleLock(); onClear(); } : handleLock}
                label={currentView === 'locked' ? 'Unlock' : 'Lock'}
                className={currentView === 'locked' ? 'text-primary' : 'hover:text-primary'}
              >
                <CssVaultIcon />
              </ActionButton>

              {/* ── Trash button ──────── */}
              <ActionButton
                onClick={handleTrashClick}
                label="Trash"
                className="text-red-400 hover:text-red-300"
                labelClassName="text-red-400"
              >
                <CssTrashIcon />
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {/* ── Overlay (portaled to document.body) ── */}
      {createPortal(
        <div className="trash-anim-overlay" />,
        document.body,
      )}
    </div>
  );
};
