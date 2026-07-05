import React, { useRef, useCallback } from 'react';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Album, SmartAlbum, Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';

interface AlbumDetailProps {
  album: Album | SmartAlbum;
  photos: Photo[];
  isLoading: boolean;
  onPhotoClick: (photo: Photo) => void;
  onBack: () => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({ 
  album, 
  photos, 
  isLoading, 
  onPhotoClick, 
  onBack,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection
}) => {
  const albumScrollRef = useRef<HTMLDivElement>(null);

  const allSelected = photos.length > 0 && photos.every(p => selectedIds.has(String(p.id)));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onToggleGroupSelection(photos.map(p => String(p.id)));
    } else {
      const idsToSelect = photos
        .filter(p => !selectedIds.has(String(p.id)))
        .map(p => String(p.id));
      if (idsToSelect.length > 0) {
        onToggleGroupSelection(idsToSelect);
      }
    }
  }, [photos, selectedIds, allSelected, onToggleGroupSelection]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 p-6 sm:px-8 shrink-0 bg-background sticky top-0 z-20">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white">{album.name}</h2>
          <p className="text-sm text-gray-400">{photos.length} photos</p>
        </div>
        {photos.length > 0 && (
          <button
            onClick={handleSelectAll}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              allSelected
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <CheckSquare size={14} />
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
      <div ref={albumScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <PhotoGrid 
            photos={photos} 
            compact
            onPhotoClick={onPhotoClick} 
            selectedIds={selectedIds} 
            onToggleSelection={onToggleSelection} 
            onToggleGroupSelection={onToggleGroupSelection} 
            scrollParentRef={albumScrollRef} 
          />
        )}
      </div>
    </div>
  );
};
