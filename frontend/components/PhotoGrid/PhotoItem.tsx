import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PhotoItemProps } from './types';
import { LazyImage } from '../ui/LazyImage';
import { formatDuration } from '@/utils/formatDuration';
import { resolveUrl } from '@/constants';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

export const PhotoItem = React.memo<PhotoItemProps>(({
  photo,
  isSelected,
  isSelectionMode,
  isFullRow,
  rowHeight,
  rowPadding,
  onPhotoClick,
  onToggleSelection,
}) => {
  const aspectRatio = photo.aspect_ratio || (photo.height > 0 ? photo.width / photo.height : 1.0);
  const [isHovering, setIsHovering] = useState(false);
  const [animFailed, setAnimFailed] = useState(false);
  const isVideo = photo.type === 'video' || photo.file_type === 'video';

  const animSrc = photo.animated_url && !animFailed
    ? resolveUrl(photo.animated_url)
    : null;

  const { settings, galleryStyle } = useGalleryLayout();
  const isGoogle = galleryStyle === 'google';
  const cornerRadius = isGoogle ? 0 : settings.cornerRadius;
  const roundedClass = cornerRadius > 0 ? '' : 'rounded-none';

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={photo.caption || 'Photo'}
      aria-pressed={isSelected}
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
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isSelectionMode || e.shiftKey) {
            onToggleSelection(String(photo.id));
          } else {
            onPhotoClick(photo);
          }
        }
      }}
      className={`relative group cursor-pointer ${roundedClass} bg-[#0c0c0c]
      transition-transform 200ms cubic-bezier(0.23, 1, 0.32, 1), transition-shadow 200ms ease-out photo-item-hover
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
      ${isSelected
          ? 'photo-item-selected shadow-xl'
          : 'active:scale-[0.97]'
        }
  `}
      style={{
        flex: isFullRow ? `${aspectRatio} 1 0%` : `0 0 auto`,
        width: isFullRow ? undefined : `calc(${rowHeight - rowPadding}px * ${aspectRatio})`,
        maxWidth: '100%',
        borderRadius: cornerRadius > 0 ? `${cornerRadius}px` : undefined,
      }}
    >
      <div
        className={`absolute inset-0 overflow-hidden ${roundedClass} transition-border-color 200ms ease ${isSelected ? 'border-4 border-primary' : ''}`}
        style={{ borderRadius: cornerRadius > 0 ? `${cornerRadius}px` : undefined }}
      >
        <LazyImage
          src={photo.url || `local://${photo.path}`}
          fallbackSrc={`local://${photo.path}`}
          alt={photo.caption || 'Photo'}
          className="w-full h-full object-cover"
        />
        {/* Animated WebP hover preview for videos — zero GStreamer pipeline cost */}
        {isHovering && isVideo && animSrc && (
          <img
            src={animSrc}
            alt=""
            onError={() => setAnimFailed(true)}
            className="absolute inset-0 w-full h-full object-cover z-[1]"
          />
        )}

        {/* Video duration badge */}
        {isVideo && photo.duration != null && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
            <span className="bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
              {formatDuration(photo.duration)}
            </span>
          </div>
        )}

        <div
          className={`absolute inset-0 transition-colors duration-150 ${isSelected ? 'bg-primary/10' : 'bg-black/0'
            }`}
        />
        <div
          className={`absolute top-3 left-3 transition-opacity duration-150 z-10
        ${isSelected || isHovering ? 'opacity-100' : 'opacity-0'}
        `}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(String(photo.id));
          }}
        >
          <div
            className={`w-7 h-7 rounded-full border flex items-center justify-center shadow-xl
            ${isSelected
                ? 'bg-primary border-primary text-black'
                : 'bg-black/60 border-white/20 hover:bg-white/10 text-white'
              }
        `}
          >
            {isSelected ? (
              <Check size={16} strokeWidth={3} />
            ) : (
              <div className="w-1 h-1 rounded-full bg-white" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
