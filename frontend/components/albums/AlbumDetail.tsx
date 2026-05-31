import React, { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Album, Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';

interface AlbumDetailProps {
  album: Album;
  photos: Photo[];
  isLoading: boolean;
  onPhotoClick: (photo: Photo) => void;
  onBack: () => void;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({ 
  album, 
  photos, 
  isLoading, 
  onPhotoClick, 
  onBack 
}) => {
  const albumScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 p-6 sm:px-8 shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{album.name}</h2>
          <p className="text-sm text-gray-400">{photos.length} photos</p>
        </div>
      </div>
      <div ref={albumScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <PhotoGrid 
            photos={photos} 
            onPhotoClick={onPhotoClick} 
            selectedIds={new Set()} 
            onToggleSelection={() => {}} 
            onToggleGroupSelection={() => {}} 
            scrollParentRef={albumScrollRef} 
          />
        )}
      </div>
    </div>
  );
};
