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
  const imageStyles = useMemo<React.CSSProperties>(() => {
    // Determine a resolution multiplier based on zoom level to force higher-res rasterization.
    // Capping at 3.0 to balance sharp detail with browser memory limits.
    const resMultiplier = Math.min(3.0, Math.max(1, zoomScale));
    
    return {
      position: 'absolute',
      top: '50%',
      left: '50%',
      // Increase CSS dimensions by the multiplier to force higher resolution rendering.
      width: `${100 * resMultiplier}%`,
      height: `${100 * resMultiplier}%`,
      maxWidth: 'none',
      maxHeight: 'none',
      // We compensate for the increased width/height by scaling down the transform.
      // Final scale = (zoomScale / resMultiplier) * 100% of container.
      // translate(-50%, -50%) centers the larger element.
      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoomScale / resMultiplier})`,
      // Smoothly transition the transform and size changes.
      transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s ease-out, height 0.4s ease-out',
      cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
      touchAction: 'none',
      WebkitUserDrag: 'none',
      willChange: 'transform, width, height',
    };
  }, [zoomScale, offset.x, offset.y, isDragging]);

  return (
    <>
      {/* Thumbnail / Low-res fallback — always shown sharp as the base layer.
          Fades to invisible once the high-res layer is fully loaded. */}
      <img
        src={resolveUrl(photo.url || `local://${photo.path}`)}
        alt="Thumbnail"
        style={imageStyles}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={`absolute object-contain shadow-2xl transition-all duration-700 select-none
          ${highResStatus === 'loaded' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}
        `}
      />

      {/* High Resolution clean image — cross-fades in over the thumbnail */}
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
