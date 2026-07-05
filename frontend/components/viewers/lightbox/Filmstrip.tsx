import React, { useRef, useEffect, useMemo } from 'react';
import { Play } from 'lucide-react';
import { FilmstripProps } from './types';
import { resolveUrl } from '@/constants';

export const Filmstrip: React.FC<FilmstripProps> = ({
  photos,
  currentPhotoId,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reversedPhotos = useMemo(() => [...photos].reverse(), [photos]);
  const currentIdx = useMemo(
    () => reversedPhotos.findIndex((p) => String(p.id) === String(currentPhotoId)),
    [reversedPhotos, currentPhotoId],
  );

  useEffect(() => {
    if (!containerRef.current || currentIdx < 0) return;
    const container = containerRef.current;
    const children = container.children;
    if (!children[currentIdx]) return;

    const child = children[currentIdx] as HTMLElement;
    const containerWidth = container.clientWidth;
    const childLeft = child.offsetLeft;
    const childWidth = child.clientWidth;
    const scrollTarget = childLeft - containerWidth / 2 + childWidth / 2;

    container.scrollTo({
      left: scrollTarget,
      behavior: 'smooth',
    });
  }, [currentIdx]);

  if (photos.length === 0) return null;

  return (
    <div className="shrink-0 bg-[#0D0F14] border-t border-white/5">
      <div
        ref={containerRef}
        className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {reversedPhotos.map((photo, idx) => {
          const isActive = String(photo.id) === String(currentPhotoId);
          const thumbUrl = photo.url || `local://${photo.path}`;

          return (
            <button
              key={photo.id}
              onClick={() => onSelect(photo)}
              className={`relative shrink-0 rounded-md overflow-hidden transition-all duration-200 ${
                isActive
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-[#0D0F14] scale-105'
                  : 'opacity-50 hover:opacity-80 hover:scale-105'
              }`}
              style={{ width: 48, height: 48, position: 'relative' }}
              title={photo.filename || `Photo ${idx + 1}`}
            >
              <img
                src={resolveUrl(thumbUrl)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {(photo.type === 'video' || photo.file_type === 'video') && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Play size={10} fill="white" className="text-white/80" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
