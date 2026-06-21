import React from 'react';
import { Photo } from '../../types';
import { useAlbums } from './hooks/useAlbums';
import { AlbumsList } from './AlbumsList';
import { AlbumDetail } from './AlbumDetail';

interface AlbumsViewProps {
  onPhotoClick: (photo: Photo) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ 
  onPhotoClick,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection
}) => {
  const {
    albums,
    selectedAlbum,
    setSelectedAlbum,
    albumPhotos,
    isLoading,
    fetchAlbums,
    fetchAlbumPhotos,
    renameAlbum,
    createAlbum,
    deleteAlbum
  } = useAlbums();

  const handleAlbumClick = async (album: typeof albums[0]) => {
    setSelectedAlbum(album);
    await fetchAlbumPhotos(album);
  };

  const handleRenameAlbum = async (album: typeof albums[0]) => {
    const newName = window.prompt(`Enter name for this album:`, album.name);
    if (newName && newName !== album.name) {
      await renameAlbum(album, newName);
    }
  };

  const handleCreateAlbum = async () => {
    const name = window.prompt('Enter name for the new album:');
    if (name && name.trim()) {
      await createAlbum(name.trim());
    }
  };

  const handleDeleteAlbum = async (album: typeof albums[0]) => {
    if (window.confirm(`Are you sure you want to delete "${album.name}"?`)) {
      await deleteAlbum(album.id);
    }
  };

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        photos={albumPhotos}
        isLoading={isLoading}
        onPhotoClick={onPhotoClick}
        onBack={() => setSelectedAlbum(null)}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        onToggleGroupSelection={onToggleGroupSelection}
      />
    );
  }

  return (
    <div className="p-4 sm:p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Albums</h2>
        <button
          onClick={handleCreateAlbum}
          className="px-4 py-2 bg-primary hover:bg-primary/95 rounded-xl text-white text-sm font-semibold transition-colors shadow-md"
        >
          Create Album
        </button>
      </div>
      <AlbumsList
        albums={albums}
        onAlbumClick={handleAlbumClick}
        onRenameAlbum={handleRenameAlbum}
        onDeleteAlbum={handleDeleteAlbum}
        onCreateAlbum={handleCreateAlbum}
      />
    </div>
  );
};
