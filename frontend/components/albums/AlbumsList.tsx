import React from 'react';
import { FolderOpen, Camera, FileText } from 'lucide-react';
import { Album, SmartAlbum } from '../../types';
import { AlbumCard } from './AlbumCard';

interface AlbumsListProps {
  albums: (Album | SmartAlbum)[];
  onAlbumClick: (album: Album | SmartAlbum) => void;
  onRenameAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onCreateAlbum: () => void;
}

const SMART_ALBUM_ICONS: Record<string, React.ReactNode> = {
  screenshots: <Camera size={24} />,
  documents: <FileText size={24} />,
};

export const AlbumsList: React.FC<AlbumsListProps> = ({ 
  albums, 
  onAlbumClick, 
  onRenameAlbum,
  onDeleteAlbum,
  onCreateAlbum
}) => {
  const smartAlbums = albums.filter((a): a is SmartAlbum => a.type === 'smart');
  const customAlbums = albums.filter((a): a is Album => a.type !== 'smart');

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
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-md hover:scale-105 duration-200"
          >
            Create First Album
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Smart Albums Section */}
      {smartAlbums.length > 0 && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">Smart Albums</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {smartAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={onAlbumClick}
                onRename={() => {}}
                onDelete={() => {}}
                icon={SMART_ALBUM_ICONS[album.smart_type || '']}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Albums Section */}
      <div>
        {smartAlbums.length > 0 && (
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">Your Albums</h3>
        )}
        {customAlbums.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-500">
            <p className="text-xs font-mono uppercase tracking-widest opacity-40 mb-4">
              Create custom albums to organize your photos.
            </p>
            <button
              onClick={onCreateAlbum}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-md hover:scale-105 duration-200"
            >
              Create Album
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {customAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={onAlbumClick}
                onRename={onRenameAlbum}
                onDelete={onDeleteAlbum}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
