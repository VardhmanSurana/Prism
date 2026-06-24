import React, { useMemo } from 'react';
import { resolveUrl } from '@/constants';
import { ImageDisplayProps } from './types';

export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  photo,
  zoomScale,
  offset,
  isDragging,
  highResStatus,
  currentHighResUrl,
}) => {
  const imageStyles = useMemo<React.CSSProperties>(() => {
    const resMultiplier = Math.min(3.0, Math.max(1, zoomScale));

    return {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: `${100 * resMultiplier}%`,
      height: `${100 * resMultiplier}%`,
      maxWidth: 'none',
      maxHeight: 'none',
      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoomScale / resMultiplier})`,
      transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
      touchAction: 'none',
      WebkitUserDrag: 'none',
      willChange: 'transform, width, height',
    };
  }, [zoomScale, offset.x, offset.y, isDragging]);

  return (
    <>
      <img
        src={resolveUrl(photo.url || `local://${photo.path}`)}
        alt="Thumbnail"
        style={imageStyles}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={`absolute object-contain shadow-2xl select-none
          ${highResStatus === 'loaded' ? 'opacity-0' : 'opacity-100'}
        `}
      />

      {currentHighResUrl && (
        <img
          src={currentHighResUrl}
          alt="High Resolution"
          style={imageStyles}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className={`absolute object-contain shadow-2xl select-none
            ${highResStatus === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `}
        />
      )}
    </>
  );
};
