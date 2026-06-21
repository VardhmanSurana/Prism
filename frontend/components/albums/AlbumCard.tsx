import React from 'react';
import { FolderOpen, Edit2, Trash2 } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Album } from '../../types';

interface AlbumCardProps {
  album: Album;
  onClick: (album: Album) => void;
  onRename?: (album: Album) => void;
  onDelete?: (album: Album) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick, onRename, onDelete }) => {
  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename) {
      onRename(album);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(album);
    }
  };

  return (
    <div 
      onClick={() => onClick(album)}
      className="group cursor-pointer space-y-3 transition-all duration-300"
    >
      <div className={`relative aspect-square overflow-hidden border transition-all duration-300 rounded-3xl
        border-white/5 bg-surfaceHover shadow-xl group-hover:shadow-2xl group-hover:-translate-y-1
      `}
      >
        {album.cover_url ? (
          <img 
            src={resolveUrl(album.cover_url)} 
            alt={album.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <FolderOpen size={40} />
          </div>
        )}
        
        {(onRename || onDelete) && (
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {onRename && (
              <button 
                onClick={handleRename}
                className="p-2 bg-black/60 backdrop-blur-md text-white rounded-full border border-white/10 hover:bg-primary hover:text-black transition-all shadow-lg"
                title="Rename"
              >
                <Edit2 size={12} />
              </button>
            )}
            {onDelete && (
              <button 
                onClick={handleDelete}
                className="p-2 bg-black/60 backdrop-blur-md text-white/80 hover:text-red-400 rounded-full border border-white/10 hover:bg-white/10 transition-all shadow-lg"
                title="Delete Album"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="text-center px-1">
        <h4 className="text-sm font-bold truncate transition-colors text-white group-hover:text-primary">
          {album.name}
        </h4>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{album.photo_count} photos</p>
      </div>
    </div>
  );
};
