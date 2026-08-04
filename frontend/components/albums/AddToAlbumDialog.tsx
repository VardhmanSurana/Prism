import React, { useState, useMemo } from 'react';
import { X, Plus, Search, ArrowUpDown, Folder } from 'lucide-react';
import { Album } from '../../types';

interface AddToAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  albums: Album[];
  onSelectAlbum: (albumId: number) => void;
  onCreateAlbum: (name: string) => void;
  selectedCount: number;
}

type FilterTab = 'all' | 'mine' | 'shared';

export const AddToAlbumDialog: React.FC<AddToAlbumDialogProps> = ({
  isOpen,
  onClose,
  albums,
  onSelectAlbum,
  onCreateAlbum,
  selectedCount
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  const filteredAlbums = useMemo(() => {
    let filtered = albums;

    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [albums, searchQuery]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAlbumName.trim()) {
      onCreateAlbum(newAlbumName.trim());
      setNewAlbumName('');
      setShowNewAlbumInput(false);
    }
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'My albums' },
    { id: 'shared', label: 'Shared with me' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-white">Add to album</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search albums"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pb-3 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {activeTab === tab.id && <span className="mr-1">✓</span>}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="px-5 pb-3">
          <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowUpDown size={14} />
            <span>Last modified</span>
          </button>
        </div>

        {/* Album List */}
        <div className="px-5 pb-5 max-h-[320px] overflow-y-auto custom-scrollbar">
          {/* New Album Button */}
          {showNewAlbumInput ? (
            <form onSubmit={handleCreate} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Album name"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 text-sm"
              />
              <button
                type="submit"
                disabled={!newAlbumName.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewAlbumInput(false);
                  setNewAlbumName('');
                }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 text-sm transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewAlbumInput(true)}
              className="w-full flex items-center gap-3 p-3 mb-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-left transition-all"
            >
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                <Plus size={20} className="text-white" />
              </div>
              <span className="text-sm font-medium text-white">New album</span>
            </button>
          )}

          {/* Albums */}
          {filteredAlbums.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No albums found
            </div>
          ) : (
            filteredAlbums.map((album) => (
              <button
                key={album.id}
                onClick={() => onSelectAlbum(Number(album.id))}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-left transition-all"
              >
                <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center text-gray-400 shrink-0">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Folder size={20} />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">{album.name}</h4>
                  <p className="text-xs text-gray-500">{album.photo_count || 0} items</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
