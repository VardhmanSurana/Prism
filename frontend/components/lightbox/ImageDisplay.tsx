import React, { useMemo } from 'react';
import { resolveUrl } from '../../constants';
import { ImageDisplayProps } from './types';

export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  photo,
  zoomScale,
  offset,
  isDragging,
  highResStatus,
  currentHighResUrl,
}) => {
  const imageStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`,
    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
    touchAction: 'none',
    WebkitUserDrag: 'none',
  }), [zoomScale, offset.x, offset.y, isDragging]);

  return (
    <>
      {/* Thumbnail / Low-res image */}
      <img
        src={resolveUrl(photo.url || `local://${photo.path}`)}
        alt="Thumbnail"
        style={imageStyles}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={`absolute object-contain shadow-2xl transition-all duration-700 select-none
          ${highResStatus === 'loaded' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}
          ${highResStatus === 'loading' ? 'blur-sm' : 'blur-0'}
        `}
      />

      {/* High Resolution clean image */}
      {currentHighResUrl && (
        <img
          src={currentHighResUrl}
          alt="High Resolution"
          style={imageStyles}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className={`absolute object-contain shadow-2xl transition-opacity duration-700 ease-out select-none
            ${highResStatus === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `}
        />
      )}
    </>
  );
};
