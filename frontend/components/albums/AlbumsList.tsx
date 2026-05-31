import React from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { Album } from '../../types';
import { AlbumType } from './hooks/useAlbums';
import { AlbumCard } from './AlbumCard';

interface AlbumsListProps {
  albums: Album[];
  activeTab: AlbumType;
  onAlbumClick: (album: Album) => void;
  onRenameAlbum: (album: Album) => void;
}

export const AlbumsList: React.FC<AlbumsListProps> = ({ 
  albums, 
  activeTab, 
  onAlbumClick, 
  onRenameAlbum 
}) => {
  if (albums.length === 0) {
    return (
      <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 space-y-4">
        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-gray-600 border border-white/5">
          {activeTab === 'places' ? <MapPin size={32} /> : <Calendar size={32} />}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-white mb-1">No {activeTab} yet</h3>
          <p className="text-xs font-mono uppercase tracking-widest opacity-40 max-w-xs mx-auto">
            Keep taking photos and we'll automatically organize them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {albums.map((album) => (
        <AlbumCard 
          key={album.id}
          album={album}
          activeTab={activeTab}
          onClick={onAlbumClick}
          onRename={activeTab === 'places' ? onRenameAlbum : undefined}
        />
      ))}
    </div>
  );
};
