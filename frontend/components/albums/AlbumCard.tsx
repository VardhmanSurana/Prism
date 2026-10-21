import React from 'react';
import { 
  Folder, Video, CheckCircle2, Clock, Sparkles, 
  Camera, MoreHorizontal
} from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Album, SmartAlbum } from '../../types';

interface AlbumCardProps {
  album: Album | SmartAlbum;
  onClick: (album: Album | SmartAlbum) => void;
  onRename?: (album: Album) => void;
  onDelete?: (album: Album) => void;
  onOpenMenu?: (album: Album | SmartAlbum, e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  viewMode?: 'comfortable' | 'compact' | 'detailed';
}

/**
 * AlbumCard - Renders an album card with Prism stacked sheet aesthetic and metadata.
 */
export const AlbumCard: React.FC<AlbumCardProps> = ({ 
  album, 
  onClick, 
  onRename, 
  onDelete, 
  onOpenMenu,
  icon,
  viewMode = 'comfortable'
}) => {
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenMenu) {
      onOpenMenu(album, e);
    } else if (onRename && album.type !== 'smart') {
      onRename(album as Album);
    }
  };

  const isCompact = viewMode === 'compact';
  const isDetailed = viewMode === 'detailed';

  // Format subtitle
  const videoCount = (album as Album).video_count;
  const photoCount = album.photo_count ?? 0;
  const subtitle = videoCount 
    ? `${photoCount.toLocaleString()} Photos · ${videoCount} Videos`
    : `${photoCount.toLocaleString()} ${photoCount === 1 ? 'Asset' : 'Assets'}`;

  // Date and location string
  const customAlbum = album as Album;
  const dateLabel = customAlbum.date_label || '';
  const locationLabel = customAlbum.location_label || '';
  const metaLine = [dateLabel, locationLabel].filter(Boolean).join(' · ');

  // Quick badge
  const badgeLabel = customAlbum.badge_label;
  const badgeIconName = customAlbum.badge_icon;

  const renderBadgeIcon = () => {
    switch (badgeIconName) {
      case 'video':
        return <Video size={12} className="text-[#c6c6c7]" />;
      case 'verified':
        return <CheckCircle2 size={12} className="text-amber-300" />;
      case 'timelapse':
        return <Clock size={12} className="text-[#c6c6c7]" />;
      case 'hdr':
        return <Sparkles size={12} className="text-rose-300" />;
      case 'camera':
        return <Camera size={12} className="text-[#c6c6c7]" />;
      default:
        return videoCount ? <Video size={12} className="text-[#c6c6c7]" /> : null;
    }
  };

  return (
    <div 
      onClick={() => onClick(album)}
      className="album-card group flex flex-col cursor-pointer transition-all duration-300 select-none"
      data-category={customAlbum.category || 'all'}
      data-count={photoCount}
      data-title={album.name}
    >
      {/* Visual Stack Representation */}
      <div className={`relative ${isCompact ? 'mb-2' : 'mb-3'}`}>
        {/* Stack Sheet Backgrounds (only on non-compact) */}
        {!isCompact && (
          <>
            <div className="absolute -top-1.5 inset-x-2.5 h-6 rounded-2xl bg-[#2c2928] -z-10 transform scale-[0.98] transition-transform duration-300 group-hover:-translate-y-1 shadow-sm" />
            <div className="absolute -top-3 inset-x-5 h-6 rounded-2xl bg-[#373433] -z-20 transform scale-[0.95] opacity-50 transition-transform duration-300 group-hover:-translate-y-1.5 shadow-sm" />
          </>
        )}

        {/* Primary Cover Frame */}
        <div 
          className={`relative ${
            isCompact ? 'aspect-square' : isDetailed ? 'aspect-[16/10]' : 'aspect-[4/3]'
          } rounded-2xl bg-[#1d1b1a] overflow-hidden shadow-lg border border-white/[0.05]`}
        >
          {album.cover_url ? (
            <img 
              src={resolveUrl(album.cover_url)} 
              alt={album.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 brightness-[0.92] group-hover:brightness-100"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#78716c] bg-[#1a1817]">
              {icon || <Folder size={isCompact ? 28 : 42} className="opacity-40" />}
            </div>
          )}

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d]/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Quick Badges */}
          {(badgeLabel || videoCount) && !isCompact && (
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#100e0d]/80 backdrop-blur-md text-[10px] font-mono text-[#e7e1df] flex items-center gap-1.5 border border-white/[0.08] shadow-sm">
              {renderBadgeIcon()}
              <span>{badgeLabel || `${videoCount} 4K Clips`}</span>
            </div>
          )}

          {/* Context Menu Button */}
          <button 
            type="button"
            onClick={handleMenuClick}
            className="context-btn absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-[#100e0d]/80 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#e7e1df] hover:text-white hover:bg-[#373433] transition-all shadow-md cursor-pointer border border-white/[0.08]"
            title="Album options"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Typography & Meta */}
      <div className="flex flex-col min-w-0">
        <h3 className={`font-serif text-[#f5f5f4] group-hover:text-white transition-colors truncate font-normal leading-snug ${
          isCompact ? 'text-sm' : 'text-base sm:text-lg'
        }`}>
          {album.name}
        </h3>
        <p className={`font-sans text-[#a8a29e] mt-0.5 truncate ${
          isCompact ? 'text-[11px]' : 'text-xs'
        }`}>
          {subtitle}
        </p>
        {!isCompact && metaLine && (
          <p className="text-[10px] font-mono text-[#78716c] uppercase tracking-wider mt-1 truncate">
            {metaLine}
          </p>
        )}
      </div>
    </div>
  );
};
