import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { Album } from '../../types';
import { AlbumCard } from './AlbumCard';

interface AlbumsListProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  onRenameAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onCreateAlbum: () => void;
}

export const AlbumsList: React.FC<AlbumsListProps> = ({ 
  albums, 
  onAlbumClick, 
  onRenameAlbum,
  onDeleteAlbum,
  onCreateAlbum
}) => {
  if (albums.length === 0) {
    return (
      <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 space-y-4">
        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-gray-600 border border-white/5">
          <FolderOpen size={32} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-white mb-1">No albums yet</h3>
          <p className="text-xs font-mono uppercase tracking-widest opacity-40 max-w-xs mx-auto mb-4">
            Your custom albums will appear here once created.
          </p>
          <button
            onClick={onCreateAlbum}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-md hover:scale-105 duration-200"
          >
            Create First Album
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {/* Create Album Card */}
      <button
        onClick={onCreateAlbum}
        className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-primary/50 bg-white/5 hover:bg-white/10 rounded-2xl p-4 text-gray-400 hover:text-white transition-all group gap-3"
      >
        <div className="p-3 bg-white/5 group-hover:bg-primary/10 rounded-xl transition-colors">
          <Plus size={24} className="text-gray-400 group-hover:text-primary transition-colors" />
        </div>
        <div className="text-center">
          <span className="block text-sm font-semibold">Create Album</span>
          <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-mono">New Custom</span>
        </div>
      </button>

      {albums.map((album) => (
        <AlbumCard 
          key={album.id}
          album={album}
          onClick={onAlbumClick}
          onRename={onRenameAlbum}
          onDelete={onDeleteAlbum}
        />
      ))}
    </div>
  );
};
