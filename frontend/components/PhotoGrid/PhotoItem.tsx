import React, { useState } from 'react';
import { Check, Heart, Film } from 'lucide-react';
import { PhotoItemProps } from './types';
import { LazyImage } from '../ui/LazyImage';
import { formatDuration } from '@/utils/formatDuration';
import { resolveUrl } from '@/constants';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

/**
 * PhotoItem - Renders photo item with Prism aesthetics.
 */
export const PhotoItem = React.memo<PhotoItemProps>(({
  photo,
  isSelected,
  isSelectionMode,
  isFullRow,
  rowHeight,
  rowPadding,
  onPhotoClick,
  onToggleSelection,
  isFocused = false,
  onFocus,
  isEditorialHero = false,
  layoutMode,
  onFavoriteToggle,
}) => {
  const aspectRatio = photo.aspect_ratio || (photo.height > 0 ? photo.width / photo.height : 1.0);
  const [isHovering, setIsHovering] = useState(false);
  const [animFailed, setAnimFailed] = useState(false);
  const isVideo = photo.type === 'video' || photo.file_type === 'video';
  const isFavorite = Boolean(photo.isFavorite ?? photo.is_favorite);

  const animSrc = photo.animated_url && !animFailed
    ? resolveUrl(photo.animated_url)
    : null;

  const { settings } = useGalleryLayout();
  const cornerRadius = settings.cornerRadius;
  const roundedClass = cornerRadius > 0 ? '' : 'rounded-xl';

  // Determine format badge label
  const formatBadge = (() => {
    const ext = photo.filename?.split('.').pop()?.toUpperCase();
    if (ext && ['RAW', 'DNG', 'CR2', 'NEF', 'ARW', 'ORF'].includes(ext)) {
      return 'RAW • 48MP';
    }
    if (photo.color_range === 'tv' || photo.codec?.includes('hevc')) {
      return 'HDR';
    }
    if (photo.fps && photo.fps >= 60) {
      return `${photo.fps}fps`;
    }
    if (isVideo) {
      return '4K';
    }
    return null;
  })();


  return (
    <div
      tabIndex={isFocused ? 0 : -1}
      data-photo-id={photo.id}
      role="button"
      aria-label={photo.caption || photo.filename || 'Photo'}
      aria-pressed={isSelected}
      onFocus={onFocus}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={(e) => {
        if (isSelectionMode || e.shiftKey) {
          e.preventDefault();
          onToggleSelection(String(photo.id));
        } else {
          onPhotoClick(photo);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          onToggleSelection(String(photo.id));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (isSelectionMode || e.shiftKey) {
            onToggleSelection(String(photo.id));
          } else {
            onPhotoClick(photo);
          }
        }
      }}
      className={`relative group cursor-pointer ${roundedClass} bg-[#151312] border border-[#292524]
        shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-[#474745] hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]
        transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5f5f4]
        ${isSelected ? 'ring-2 ring-white border-transparent' : 'active:scale-[0.98]'}
      `}
      style={{
        flex: isFullRow ? `${aspectRatio} 1 0%` : `0 0 auto`,
        width: isFullRow ? undefined : `calc(${rowHeight - rowPadding}px * ${aspectRatio})`,
        maxWidth: '100%',
        borderRadius: cornerRadius > 0 ? `${cornerRadius}px` : undefined,
      }}
    >
      <div
        className={`absolute inset-0 overflow-hidden ${roundedClass} bg-[#1c1917]`}
        style={{ borderRadius: cornerRadius > 0 ? `${cornerRadius}px` : undefined }}
      >
        <LazyImage
          src={photo.url || `local://${photo.path}`}
          fallbackSrc={`local://${photo.path}`}
          alt={photo.caption || 'Photo'}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />

        {/* Animated WebP hover preview for videos */}
        {isHovering && isVideo && animSrc && (
          <img
            src={animSrc}
            alt=""
            onError={() => setAnimFailed(true)}
            className="absolute inset-0 w-full h-full object-cover z-[1]"
          />
        )}

        {/* Subtle dark gradient overlay on hover */}
        <div className="absolute inset-0 bg-[#0c0a09]/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Top-Left Overlay Controls (Selection & Format Badge) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <div
            aria-label="Select photo"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection(String(photo.id));
            }}
            className={`w-6 h-6 rounded flex items-center justify-center shadow backdrop-blur-md transition-all active:scale-90 cursor-pointer ${
              isSelected
                ? 'bg-white text-black'
                : 'bg-[#0c0a09]/75 border border-white/10 text-white hover:bg-[#0c0a09]'
            } ${isSelected || isHovering || isSelectionMode ? 'opacity-100' : 'opacity-0'}`}
          >
            <Check size={13} strokeWidth={2.5} className={isSelected ? 'opacity-100' : 'opacity-0'} />
          </div>

          {formatBadge && (
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full bg-[#0c0a09]/80 backdrop-blur-md border border-white/10 text-[#f5f5f4] shadow pointer-events-none">
              {formatBadge}
            </span>
          )}

          {isVideo && (
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full bg-[#0c0a09]/80 backdrop-blur-md border border-white/10 text-[#34d399] flex items-center gap-1 shadow pointer-events-none">
              <Film size={10} />
              {photo.duration != null ? formatDuration(photo.duration) : 'Video'}
            </span>
          )}
        </div>

        {/* Top-Right Favorite Button */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
          <div
            aria-label="Favorite photo"
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle?.(photo.id, isFavorite);
            }}
            className={`w-7 h-7 rounded-full bg-[#0c0a09]/75 backdrop-blur-md border border-white/10 hover:bg-[#0c0a09] flex items-center justify-center shadow transition-colors cursor-pointer ${
              isFavorite ? 'text-[#f87171] opacity-100' : 'text-[#a8a29e] hover:text-[#f87171] opacity-0 group-hover:opacity-100'
            }`}
          >
            <Heart size={14} className={isFavorite ? 'fill-[#f87171]' : ''} />
          </div>
        </div>

      </div>
    </div>
  );
});

PhotoItem.displayName = 'PhotoItem';

