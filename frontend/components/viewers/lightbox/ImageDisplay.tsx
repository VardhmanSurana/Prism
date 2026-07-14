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
  kenBurns = false,
}) => {
  const useKenBurns = kenBurns && zoomScale === 1;

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
      // When Ken Burns is active, centering is applied on the outer wrapper;
      // the img itself only fills the wrapper so CSS animation can own transform.
      transform: useKenBurns
        ? undefined
        : `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoomScale / resMultiplier})`,
      transition: isDragging || useKenBurns ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
      touchAction: 'none',
      WebkitUserDrag: 'none',
      willChange: 'transform, width, height',
    };
  }, [zoomScale, offset.x, offset.y, isDragging, useKenBurns]);

  if (useKenBurns) {
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full animate-ken-burns origin-center">
          <img
            src={resolveUrl(photo.url || `local://${photo.path}`)}
            alt="Thumbnail"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className={`absolute inset-0 w-full h-full object-contain shadow-2xl select-none
              ${highResStatus === 'loaded' ? 'opacity-0' : 'opacity-100'}
            `}
          />
          {currentHighResUrl && (
            <img
              src={currentHighResUrl}
              alt="High Resolution"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-contain shadow-2xl select-none
                ${highResStatus === 'loaded' ? 'opacity-100' : 'opacity-0'}
              `}
            />
          )}
        </div>
      </div>
    );
  }

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
