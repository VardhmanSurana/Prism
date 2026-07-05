import React from 'react';
import { Photo } from '../../types';
import { InlinePhotoGridProps } from './types';
import { resolveUrl } from '../../constants';

export const InlinePhotoGrid: React.FC<InlinePhotoGridProps> = ({
  photos,
  onPhotoClick,
  onShowMore
}) => {
  if (!photos || photos.length === 0) return null;

  const displayPhotos = photos.slice(0, 5);
  const hasMore = photos.length > 5;
  const moreCount = photos.length - 4;

  const renderGrid = () => {
    const count = displayPhotos.length;

    if (count === 1) {
      return (
        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-white/10 shadow-md">
          <img
            src={resolveUrl(displayPhotos[0].url)}
            alt="Result photo"
            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
            onClick={() => onPhotoClick(displayPhotos[0])}
          />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-2 aspect-[16/10]">
          {displayPhotos.map((photo) => (
            <div key={photo.id} className="rounded-xl overflow-hidden border border-white/10 shadow-sm h-full">
              <img
                src={resolveUrl(photo.url)}
                alt="Result photo"
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                onClick={() => onPhotoClick(photo)}
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-3 gap-2 aspect-[16/10]">
          <div className="col-span-2 rounded-xl overflow-hidden border border-white/10 shadow-sm h-full">
            <img
              src={resolveUrl(displayPhotos[0].url)}
              alt="Result photo"
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
              onClick={() => onPhotoClick(displayPhotos[0])}
            />
          </div>
          <div className="grid grid-rows-2 gap-2 h-full">
            {displayPhotos.slice(1, 3).map((photo) => (
              <div key={photo.id} className="rounded-xl overflow-hidden border border-white/10 shadow-sm h-full">
                <img
                  src={resolveUrl(photo.url)}
                  alt="Result photo"
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={() => onPhotoClick(photo)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4 or more photos
    return (
      <div className="grid grid-cols-2 gap-2 aspect-square">
        {displayPhotos.slice(0, 3).map((photo) => (
          <div key={photo.id} className="rounded-xl overflow-hidden border border-white/10 shadow-sm h-full">
            <img
              src={resolveUrl(photo.url)}
              alt="Result photo"
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
              onClick={() => onPhotoClick(photo)}
            />
          </div>
        ))}
        {/* 4th slot, shows photo, or overlay if 5+ photos */}
        <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-sm h-full cursor-pointer" onClick={onShowMore}>
          <img
            src={resolveUrl(displayPhotos[3].url)}
            alt="Result photo"
            className="w-full h-full object-cover"
          />
          {hasMore && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white hover:bg-black/60 transition-colors duration-300">
              <span className="text-xl font-extrabold tracking-wide">+{moreCount}</span>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-1">Photos</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-2 w-full max-w-sm">
      {renderGrid()}
      <button
        onClick={onShowMore}
        className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 transition-all text-gray-300 hover:text-white mt-2 shadow-sm"
      >
        Show all results ({photos.length})
      </button>
    </div>
  );
};
