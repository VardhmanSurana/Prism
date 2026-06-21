import React from 'react';
import { Photo } from '../../types';
import { useAlbums } from './hooks/useAlbums';
import { AlbumsList } from './AlbumsList';
import { AlbumDetail } from './AlbumDetail';

interface AlbumsViewProps {
  onPhotoClick: (photo: Photo) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ onPhotoClick }) => {
  const {
    albums,
    selectedAlbum,
    setSelectedAlbum,
    albumPhotos,
    isLoading,
    fetchAlbums,
    fetchAlbumPhotos,
    renameAlbum
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

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        photos={albumPhotos}
        isLoading={isLoading}
        onPhotoClick={onPhotoClick}
        onBack={() => setSelectedAlbum(null)}
      />
    );
  }

  return (
    <div className="p-4 sm:p-8 h-full flex flex-col">
      <AlbumsList
        albums={albums}
        onAlbumClick={handleAlbumClick}
        onRenameAlbum={handleRenameAlbum}
      />
    </div>
  );
};
