import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PhotoItemProps } from './types';
import { LazyImage } from '../LazyImage';

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

  return (
    <motion.div
      key={photo.id}
      onClick={(e) => {
        if (isSelectionMode || e.shiftKey) {
          e.preventDefault();
          onToggleSelection(String(photo.id));
        } else {
          onPhotoClick(photo);
        }
      }}
      style={{
        flex: isFullRow ? `${aspectRatio} 1 0%` : `0 0 auto`,
        width: isFullRow ? undefined : `calc(${rowHeight - rowPadding}px * ${aspectRatio})`,
        maxWidth: '100%',
      }}
      className={`relative group cursor-pointer overflow-hidden rounded-[1.5rem] bg-[#0c0c0c]
      transition-all duration-500 will-change-transform
      hover:z-10 hover:shadow-[0_10px_20px_-5px_rgba(0,0,0,0.8)]
      ${
        isSelected
          ? 'ring-4 ring-primary scale-[0.98] shadow-xl'
          : 'hover:ring-1 hover:ring-white/20 active:scale-[0.99]'
      }
  `}
    >
      <LazyImage
        src={photo.url || `local://${photo.path}`}
        fallbackSrc={`local://${photo.path}`}
        alt={photo.caption || 'Photo'}
        className="w-full h-full object-cover transition-transform duration-500"
      />
      <div
        className={`absolute inset-0 transition-colors duration-300 ${
          isSelected ? 'bg-primary/10' : 'bg-black/0 group-hover:bg-black/20'
        }`}
      />
      <div
        className={`absolute top-3 left-3 transition-all duration-300 z-10
        ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}
        `}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelection(String(photo.id));
        }}
      >
        <div
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all shadow-xl backdrop-blur-md
            ${
              isSelected
                ? 'bg-primary border-primary text-white'
                : 'bg-black/20 border-white/20 hover:bg-white/10 text-white'
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
    </motion.div>
  );
});
