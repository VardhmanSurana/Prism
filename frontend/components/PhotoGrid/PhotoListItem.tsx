import React from 'react';
import { Photo } from '../../types';
import { LazyImage } from '../ui/LazyImage';
import { Heart, Lock, Trash2, Check } from 'lucide-react';

interface PhotoListItemProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  onPhotoClick: (photo: Photo) => void;
  onToggleSelection: (id: string) => void;
  onFavoriteToggle: (id: string | number, current: boolean) => void;
  onLockToggle: (id: string | number, current: boolean) => void;
  onDeleteToggle: (id: string | number) => void;
}

export const PhotoListItem: React.FC<PhotoListItemProps> = ({
  photo,
  isSelected,
  isSelectionMode,
  onPhotoClick,
  onToggleSelection,
  onFavoriteToggle,
  onLockToggle,
  onDeleteToggle,
}) => {
  const dateStr = new Date(photo.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sizeStr = photo.file_size
    ? `${(photo.file_size / (1024 * 1024)).toFixed(2)} MB`
    : 'Unknown size';

  const isFavorite = photo.isFavorite || photo.is_favorite;
  const isLocked = photo.isLocked || photo.is_locked;

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={photo.filename || photo.path.split('/').pop()}
      aria-pressed={isSelected}
      onClick={(e) => {
        if (isSelectionMode || e.shiftKey) {
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
      className={`flex items-center gap-6 p-4 rounded-3xl border transition-all duration-300 group cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
        active:scale-[0.98]
        ${
          isSelected
            ? 'bg-primary/5 border-primary/30 shadow-lg'
            : 'bg-surface/50 border-white/[0.03] hover:bg-surfaceHover/80 hover:border-white/10 hover:shadow-xl'
        }
      `}
      style={{ height: '110px' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelection(String(photo.id));
        }}
        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all select-none shrink-0
          ${
            isSelected
              ? 'bg-primary border-primary text-black'
              : 'border-white/20 hover:border-white/50 bg-black/20 text-transparent'
          }
        `}
      >
        <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
      </div>

      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-white/5 bg-black/40 relative">
        <LazyImage
          src={photo.url || `local://${photo.path}`}
          fallbackSrc={`local://${photo.path}`}
          alt={photo.caption || 'Thumbnail'}
          className="w-full h-full object-cover transition-transform duration-500"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white truncate font-mono tracking-tight max-w-[250px]">
            {photo.filename || photo.path.split('/').pop()}
          </span>
          {photo.location && (
            <span className="text-[10px] font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 tracking-wide">
              {photo.location}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
          <span>{dateStr}</span>
          <span>•</span>
          <span>{photo.width} × {photo.height}</span>
          <span>•</span>
          <span>{sizeStr}</span>
        </div>

        {(photo.ai_summary || photo.caption) && (
          <p className="text-[11px] text-gray-400 font-medium italic mt-1.5 truncate max-w-[550px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
            "{photo.ai_summary || photo.caption}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(photo.id, isFavorite);
          }}
          className={`p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95
            ${
              isFavorite
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20'
                : 'bg-white/5 border-white/5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/5'
            }
          `}
          title="Favorite"
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onLockToggle(photo.id, isLocked);
          }}
          className={`p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95
            ${
              isLocked
                ? 'bg-purple-500/10 border-purple-500/20 text-purple-500 hover:bg-purple-500/20'
                : 'bg-white/5 border-white/5 text-gray-400 hover:text-purple-500 hover:bg-purple-500/5'
            }
          `}
          title="Move to Locked Folder"
        >
          <Lock size={16} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteToggle(photo.id);
          }}
          className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all hover:scale-105 active:scale-95"
          title="Trash"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
