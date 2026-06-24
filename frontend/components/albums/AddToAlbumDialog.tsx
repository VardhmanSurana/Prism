import React, { useState } from 'react';
import { X, Plus, Folder } from 'lucide-react';
import { Album } from '../../types';

interface AddToAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  albums: Album[];
  onSelectAlbum: (albumId: number) => void;
  onCreateAlbum: (name: string) => void;
  selectedCount: number;
}

export const AddToAlbumDialog: React.FC<AddToAlbumDialogProps> = ({
  isOpen,
  onClose,
  albums,
  onSelectAlbum,
  onCreateAlbum,
  selectedCount
}) => {
  const [newAlbumName, setNewAlbumName] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAlbumName.trim()) {
      onCreateAlbum(newAlbumName.trim());
      setNewAlbumName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1.5 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
        
        <h3 className="text-xl font-bold text-white mb-1">Add to Album</h3>
        <p className="text-sm text-gray-400 mb-6">Select or create an album for {selectedCount} items.</p>

        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="New album name..."
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 text-sm"
          />
          <button
            type="submit"
            disabled={!newAlbumName.trim()}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/30 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} />
            Create
          </button>
        </form>

        <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
          {albums.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm font-mono uppercase tracking-widest opacity-60">
              No albums yet
            </div>
          ) : (
            albums.map((album) => (
              <button
                key={album.id}
                onClick={() => onSelectAlbum(album.id)}
                className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-left transition-all"
              >
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg overflow-hidden flex items-center justify-center text-gray-400 shrink-0">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Folder size={18} />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{album.name}</h4>
                  <p className="text-xs text-gray-400">{album.photo_count || 0} photos</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
