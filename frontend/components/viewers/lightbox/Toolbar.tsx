import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Heart,
  Info,
  ZoomIn,
  ZoomOut,
  Edit2,
  Trash2,
  FolderMinus,
  Image,
  MoreHorizontal,
  Copy,
  Presentation,
  UserCheck,
  HelpCircle,
  Type,
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
    <div className="h-14 flex items-center justify-between px-6 shrink-0 z-20 bg-[#0D0F14] border-b border-white/5 font-sans">
      {/* Left: Close + Metadata */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          title="Close (Esc)"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        <div className="h-5 w-[1px] bg-white/10" />

        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-white/80 font-mono truncate max-w-[200px]" title={photo.filename}>
            {photo.filename || `Photo ${currentIndex + 1}`}
          </span>
          {dims && (
            <span className="text-[10px] text-white/30 font-mono">{dims}</span>
          )}
          {size && (
            <span className="text-[10px] text-white/30 font-mono">{size}</span>
          )}
          {ext && (
            <span className="text-[9px] text-white/20 font-mono uppercase bg-white/5 px-1.5 py-0.5 rounded">{ext}</span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            highResStatus === 'loaded'
              ? 'bg-green-500'
              : highResStatus === 'loading'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-gray-600'
          }`} />
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">
            {highResStatus === 'loaded' ? 'HD' : highResStatus === 'loading' ? 'Loading' : 'Preview'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Zoom controls */}
        <div className="hidden sm:flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 mr-2 border border-white/5">
          <button
            onClick={() => onSetZoomScale(Math.max(0.1, zoomScale - 0.5))}
            className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14}/>
          </button>
          <span className="text-[10px] font-mono text-white/40 w-10 text-center tabular-nums">
            {zoomScale === 1 ? 'Fit' : `${Math.round(zoomScale * 100)}%`}
          </span>
          <button
            onClick={() => onSetZoomScale(Math.min(10, zoomScale + 0.5))}
            className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14}/>
          </button>
          {zoomScale > 1 && (
            <button
              onClick={onResetInteraction}
              className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors text-[9px] font-mono"
              title="Reset Zoom"
            >
              Reset
            </button>
          )}
        </div>

        {/* Text Actions Toggle */}
        {onToggleOcr && (
          <button
            onClick={onToggleOcr}
            className={`p-2 rounded-lg transition-colors ${
              ocrActive ? 'text-blue-400 bg-blue-500/20 border border-blue-500/40' : 'text-white/50 hover:text-white hover:bg-white/5'
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
            className={`p-2 rounded-lg transition-colors ${
              faceTaggingActive ? 'text-primary bg-primary/20 border border-primary/40' : 'text-white/50 hover:text-white hover:bg-white/5'
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
            className={`p-2 rounded-lg transition-colors ${
              slideshowActive
                ? 'text-primary bg-primary/10'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
            title="Start slideshow (S)"
          >
            <Presentation size={18} />
          </button>
        )}

        {/* Favorite */}
        <button
          onClick={onToggleFavorite}
          className={`p-2 rounded-lg transition-colors ${
            photo.isFavorite
              ? 'text-red-500 bg-red-500/10'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
          title={photo.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Heart size={18} fill={photo.isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Info toggle */}
        <button
          onClick={onToggleShowInfo}
          className={`p-2 rounded-lg transition-colors ${
            showInfo
              ? 'text-primary bg-primary/10'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
          title="Info Panel (I)"
        >
          <Info size={18} />
        </button>

        {/* Keyboard Shortcuts (?) */}
        {onOpenShortcutsModal && (
          <button
            onClick={onOpenShortcutsModal}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={18} />
          </button>
        )}

        {/* More menu */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="More Actions"
          >
            <MoreHorizontal size={18} />
          </button>

          {showMore && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {onEdit && (
                <button
                  onClick={() => { onEdit(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Edit2 size={15} className="text-gray-500" />
                  <span>Edit</span>
                </button>
              )}

              {onCopyImageToClipboard && (
                <button
                  onClick={() => { onCopyImageToClipboard(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Copy size={15} className="text-gray-500" />
                  <span>Copy Image to Clipboard</span>
                </button>
              )}

              <button
                onClick={() => { navigator.clipboard.writeText(photo.path); setShowMore(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Copy size={15} className="text-gray-500" />
                <span>Copy File Path</span>
              </button>

              {onSetAsCover && (
                <button
                  onClick={() => { onSetAsCover(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Image size={15} className="text-gray-500" />
                  <span>Set as Album Cover</span>
                </button>
              )}
              {onRemoveFromAlbum && (
                <button
                  onClick={() => { onRemoveFromAlbum(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <FolderMinus size={15} />
                  <span>Remove from Album</span>
                </button>
              )}
              <div className="h-px bg-white/5 my-1" />
              <button
                onClick={() => { onTrash?.(); setShowMore(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={15} />
                <span>Move to Trash</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
