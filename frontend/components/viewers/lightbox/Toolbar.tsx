import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Heart,
  Info,
  Edit2,
  Trash2,
  FolderMinus,
  Image,
  MoreHorizontal,
  Copy,
  Presentation,
  UserCheck,
  Type,
  Share2,
} from 'lucide-react';
import { Photo } from '@/types';

export interface ExtendedToolbarProps {
  photo: Photo;
  metadata?: Photo | null;
  highResStatus: string;
  zoomScale: number;
  showInfo: boolean;
  currentIndex: number;
  totalCount: number;
  slideshowActive: boolean;
  canStartSlideshow: boolean;
  faceTaggingActive?: boolean;
  ocrActive?: boolean;
  onClose: () => void;
  onSetZoomScale: (scale: number) => void;
  onResetInteraction: () => void;
  onToggleShowInfo: () => void;
  onToggleFavorite: () => void;
  onEdit?: () => void;
  onTrash?: () => void;
  onRemoveFromAlbum?: () => void;
  onSetAsCover?: () => void;
  onStartSlideshow?: () => void;
  onToggleFaceTagging?: () => void;
  onToggleOcr?: () => void;
  onOpenShortcutsModal?: () => void;
  onCopyImageToClipboard?: () => void;
  onShare?: () => void;
}

/**
 * Top toolbar for the lightbox: close, file metadata, zoom controls,
 * quick actions (OCR, face tag, slideshow, favorite, info) and overflow menu.
 */
export const Toolbar: React.FC<ExtendedToolbarProps> = ({
  photo,
  metadata,
  highResStatus,
  zoomScale,
  showInfo,
  currentIndex,
  slideshowActive,
  canStartSlideshow,
  faceTaggingActive,
  ocrActive,
  onClose,
  onSetZoomScale,
  onResetInteraction,
  onToggleShowInfo,
  onToggleFavorite,
  onEdit,
  onTrash,
  onRemoveFromAlbum,
  onSetAsCover,
  onStartSlideshow,
  onToggleFaceTagging,
  onToggleOcr,
  onOpenShortcutsModal,
  onCopyImageToClipboard,
  onShare,
}) => {
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClick, { passive: true });
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMore]);

  /**
   * Formats a byte count into a human-readable size string.
   * @param bytes - File size in bytes.
   * @returns Formatted string (KB/MB/GB) or null if undefined/zero.
   */
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const dims = photo.width && photo.height ? `${photo.width} × ${photo.height}` : null;
  const size = formatFileSize(metadata?.file_size ?? photo.file_size);
  const ext = photo.filename?.split('.').pop()?.toUpperCase();

  return (
    <div className="h-14 flex items-center justify-between px-6 shrink-0 z-20 bg-[#151312]/95 backdrop-blur-xl border-b border-white/10 font-sans">
      {/* Left: Close + Metadata */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 cursor-pointer"
          title="Close (Esc)"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        <div className="h-4 w-[1px] bg-white/10" />

        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-zinc-200 font-mono truncate max-w-[220px]" title={photo.filename}>
            {photo.filename || `Photo ${currentIndex + 1}`}
          </span>
          {dims && (
            <span className="text-[10px] text-zinc-500 font-mono">{dims}</span>
          )}
          {size && (
            <span className="text-[10px] text-zinc-500 font-mono">{size}</span>
          )}
          {ext && (
            <span className="text-[9px] text-[#e5a93c] font-mono uppercase bg-[#e5a93c]/10 border border-[#e5a93c]/20 px-1.5 py-0.5 rounded-md">
              {ext}
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            highResStatus === 'loaded'
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : highResStatus === 'loading'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-zinc-600'
          }`} />
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
            {highResStatus === 'loaded' ? 'HD' : highResStatus === 'loading' ? 'Loading' : 'Preview'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Text Actions Toggle */}
        {onToggleOcr && (
          <button
            onClick={onToggleOcr}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              ocrActive ? 'text-blue-400 bg-blue-500/20 border border-blue-500/40' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Text Actions (OCR)"
          >
            <Type size={18} />
          </button>
        )}

        {/* Face Tagging Toggle */}
        {onToggleFaceTagging && (
          <button
            onClick={onToggleFaceTagging}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              faceTaggingActive ? 'text-[#e5a93c] bg-[#e5a93c]/20 border border-[#e5a93c]/40' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Tag People in Photo"
          >
            <UserCheck size={18} />
          </button>
        )}

        {/* Slideshow */}
        {canStartSlideshow && onStartSlideshow && (
          <button
            onClick={onStartSlideshow}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              slideshowActive
                ? 'text-[#e5a93c] bg-[#e5a93c]/15 border border-[#e5a93c]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Start slideshow (S)"
          >
            <Presentation size={18} />
          </button>
        )}

        {/* Favorite */}
        <button
          onClick={onToggleFavorite}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            photo.isFavorite
              ? 'text-rose-400 bg-rose-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title={photo.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Heart size={18} fill={photo.isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Share */}
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Share Photo"
          >
            <Share2 size={18} />
          </button>
        )}

        {/* Info toggle - Placed to the left immediately before More Options */}
        <button
          onClick={onToggleShowInfo}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            showInfo
              ? 'text-[#e5a93c] bg-[#e5a93c]/20 border border-[#e5a93c]/30'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Info Panel (I)"
        >
          <Info size={18} />
        </button>

        {/* More menu */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="More Actions"
          >
            <MoreHorizontal size={18} />
          </button>

          {showMore && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-[#1d1b1a] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-xl">
              {onEdit && (
                <button
                  onClick={() => { onEdit(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <Edit2 size={14} className="text-zinc-500" />
                  <span>Edit</span>
                </button>
              )}

              {onCopyImageToClipboard && (
                <button
                  onClick={() => { onCopyImageToClipboard(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy size={14} className="text-zinc-500" />
                  <span>Copy to Clipboard</span>
                </button>
              )}

              <button
                onClick={() => { navigator.clipboard.writeText(photo.path); setShowMore(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              >
                <Copy size={14} className="text-zinc-500" />
                <span>Copy File Path</span>
              </button>

              {onSetAsCover && (
                <button
                  onClick={() => { onSetAsCover(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <Image size={14} className="text-zinc-500" />
                  <span>Set as Album Cover</span>
                </button>
              )}
              {onRemoveFromAlbum && (
                <button
                  onClick={() => { onRemoveFromAlbum(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <FolderMinus size={14} />
                  <span>Remove from Album</span>
                </button>
              )}
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => { onTrash?.(); setShowMore(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Move to Trash</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

