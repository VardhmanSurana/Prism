import React, { useState } from 'react';
import { Photo, Album } from '../../types';
import { useAlbums } from './hooks/useAlbums';
import { AlbumsList } from './AlbumsList';
import { AlbumDetail } from './AlbumDetail';
import { AlbumNameDialog } from './AlbumNameDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface AlbumsViewProps {
  onPhotoClick: (photo: Photo) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
}

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'rename'; album: Album }
  | { type: 'delete'; album: Album };

export const AlbumsView: React.FC<AlbumsViewProps> = ({
  onPhotoClick,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection,
}) => {
  const {
    albums,
    selectedAlbum,
    setSelectedAlbum,
    albumPhotos,
    isLoading,
    fetchAlbumPhotos,
    renameAlbum,
    createAlbum,
    deleteAlbum,
  } = useAlbums();

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const handleAlbumClick = async (album: Album) => {
    setSelectedAlbum(album);
    await fetchAlbumPhotos(album);
  };

  const handleRenameAlbum = (album: Album) => setDialog({ type: 'rename', album });
  const handleDeleteAlbum = (album: Album) => setDialog({ type: 'delete', album });
  const closeDialog = () => setDialog({ type: 'none' });

  const handleConfirmCreate = async (name: string) => {
    await createAlbum(name);
  };

  const handleConfirmRename = async (name: string) => {
    if (dialog.type !== 'rename') return;
    await renameAlbum(dialog.album, name);
  };

  const handleConfirmDelete = async () => {
    if (dialog.type !== 'delete') return;
    await deleteAlbum(dialog.album.id);
    closeDialog();
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
          onClick={() => setDialog({ type: 'create' })}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-white text-sm font-semibold transition-colors shadow-md flex items-center gap-2"
        >
          <span>+</span> Create Album
        </button>
      </div>

      <AlbumsList
        albums={albums}
        onAlbumClick={handleAlbumClick}
        onRenameAlbum={handleRenameAlbum}
        onDeleteAlbum={handleDeleteAlbum}
        onCreateAlbum={() => setDialog({ type: 'create' })}
      />

      {/* Create dialog */}
      <AlbumNameDialog
        isOpen={dialog.type === 'create'}
        mode="create"
        onConfirm={handleConfirmCreate}
        onClose={closeDialog}
      />

      {/* Rename dialog */}
      <AlbumNameDialog
        isOpen={dialog.type === 'rename'}
        mode="rename"
        initialValue={dialog.type === 'rename' ? dialog.album.name : ''}
        onConfirm={handleConfirmRename}
        onClose={closeDialog}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        isOpen={dialog.type === 'delete'}
        albumName={dialog.type === 'delete' ? dialog.album.name : ''}
        onConfirm={handleConfirmDelete}
        onClose={closeDialog}
      />
    </div>
  );
};
