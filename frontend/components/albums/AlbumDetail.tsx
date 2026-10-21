import React, { useRef, useCallback } from 'react';
import { ArrowLeft, CheckSquare, Share2 } from 'lucide-react';
import { Album, SmartAlbum, Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';
import { useTelemetry } from '../../hooks/useTelemetry';

interface AlbumDetailProps {
  album: Album | SmartAlbum;
  photos: Photo[];
  isLoading: boolean;
  onPhotoClick: (photo: Photo) => void;
  onBack: () => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  onShareAlbum?: (album: Album | SmartAlbum) => void;
}

/**
 * AlbumDetail - Renders album detail.
 */
export const AlbumDetail: React.FC<AlbumDetailProps> = ({ 
  album, 
  photos, 
  isLoading, 
  onPhotoClick, 
  onBack,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection,
  onShareAlbum,
}) => {
  const { logAction } = useTelemetry();
  const albumScrollRef = useRef<HTMLDivElement>(null);

  /**
   * allSelected - Performs all selected.
   */
  const allSelected = photos.length > 0 && photos.every(p => selectedIds.has(String(p.id)));

  /**
   * handleSelectAll - Handles select all.
   */
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

  const locationLabel = album.type === 'smart' && album.smart_type === 'places'
    ? [album.metadata?.city, album.metadata?.state, album.metadata?.country].filter(Boolean).join(', ')
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#151312]">
      <div className="flex items-center gap-4 py-4 px-6 sm:px-8 shrink-0 bg-[#151312]/90 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-20">
        <button 
          onClick={() => { logAction('AlbumDetail', 'back', { albumId: album.id, albumName: album.name }); onBack(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#a8a29e] hover:text-[#f5f5f4] bg-[#1d1b1a] hover:bg-[#2c2928] border border-white/[0.06] transition-colors cursor-pointer"
          title="Back to Collections"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl sm:text-3xl text-[#f5f5f4] tracking-tight leading-none truncate">
              {album.name}
            </h2>
            {album.type === 'smart' && (
              <span className="px-2 py-0.5 rounded-full bg-[#2c2928] text-[#c6c6c7] font-mono text-[9px] tracking-wider uppercase border border-white/[0.04]">
                Smart Hub
              </span>
            )}
          </div>
          <p className="font-sans text-xs text-[#a8a29e] mt-1">
            {photos.length} {photos.length === 1 ? 'asset' : 'assets'}
            {locationLabel ? ` · ${locationLabel}` : ''}
          </p>
        </div>
        {onShareAlbum && (
          <button
            onClick={() => {
              logAction('AlbumDetail', 'share_album', { albumId: album.id, albumName: album.name });
              onShareAlbum(album);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1d1b1a] text-[#e7e1df] hover:text-white hover:bg-[#2c2928] border border-white/[0.08] transition-colors cursor-pointer"
            title="Share Album"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        )}

        {photos.length > 0 && (
          <button
            onClick={() => { logAction('AlbumDetail', allSelected ? 'deselect_all' : 'select_all', { albumId: album.id, photoCount: photos.length }); handleSelectAll(); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              allSelected
                ? 'bg-[#e7e1df] text-[#151312] shadow-sm font-semibold'
                : 'bg-[#1d1b1a] text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#2c2928] border border-white/[0.08]'
            }`}
          >
            <CheckSquare size={13} />
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
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
