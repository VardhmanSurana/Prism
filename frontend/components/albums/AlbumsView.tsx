import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, ArrowUpDown, ChevronDown, Check, 
  LayoutGrid, Grid3X3, List, Plus 
} from 'lucide-react';
import { Photo, Album, SmartAlbum } from '../../types';
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
  onShareAlbum?: (album: Album | SmartAlbum) => void;
}

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'rename'; album: Album }
  | { type: 'delete'; album: Album };

export type SortKey = 'Date Created' | 'Album Name' | 'Asset Count' | 'Recent Activity';
export type ViewMode = 'comfortable' | 'compact' | 'detailed';

/**
 * AlbumsView - Prism master controller for albums with sticky control bar,
 * live search, sorting, view density toggle, and high-fidelity modals.
 */
export const AlbumsView: React.FC<AlbumsViewProps> = ({
  onPhotoClick,
  selectedIds,
  onToggleSelection,
  onToggleGroupSelection,
  onShareAlbum,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('Date Created');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+F or Ctrl+F focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close sort menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortContainerRef.current && !sortContainerRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleAlbumClick = async (album: Album | SmartAlbum) => {
    setSelectedAlbum(album);
    await fetchAlbumPhotos(album);
  };

  const handleRenameAlbum = (album: Album) => setDialog({ type: 'rename', album });
  const handleDeleteAlbum = (album: Album) => setDialog({ type: 'delete', album });
  const closeDialog = () => setDialog({ type: 'none' });

  const handleConfirmCreate = async (name: string, category?: string) => {
    const newAlbum = await createAlbum(name);
    if (newAlbum && category) {
      newAlbum.category = category;
    }
  };

  const handleConfirmRename = async (name: string) => {
    if (dialog.type !== 'rename') return;
    await renameAlbum(dialog.album, name);
  };

  const handleConfirmDelete = async () => {
    if (dialog.type !== 'delete') return;
    await deleteAlbum(Number(dialog.album.id));
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
        onShareAlbum={onShareAlbum}
      />
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[#151312] text-[#e7e1df] px-6 sm:px-10 relative">
      {/* ── Atmospheric ambient glow orbs ── */}
      <div className="relative w-full pointer-events-none overflow-hidden h-0 -z-10">
        <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#c6c6c7] opacity-[0.035] blur-[140px]" />
        <div className="absolute -top-24 right-1/4 w-[420px] h-[420px] rounded-full bg-[#c9c6c4] opacity-[0.025] blur-[120px]" />
      </div>

      {/* ── Sticky Top Control Bar ── */}
      <header className="sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-6 md:px-8 bg-[#151312]/90 backdrop-blur-md border-b border-white/[0.08] -mx-6 sm:-mx-10 mb-8 transition-all">
        {/* Title & Status Beacon */}
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#f5f5f4] tracking-tight leading-none font-normal">
            Albums
          </h1>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#a8a29e] font-medium">
              Local Sandbox
            </span>
          </div>
        </div>

        {/* Actions & Controls Hub */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Search within Albums */}
          <div className="flex items-center bg-[#1d1b1a] border border-white/[0.1] rounded-full pl-3.5 pr-2 py-1.5 gap-2 focus-within:border-white/25 focus-within:bg-[#211f1e] transition-all">
            <Search size={15} className="text-[#78716c]" />
            <input
              ref={searchInputRef}
              type="text"
              id="album-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter albums..."
              className="bg-transparent border-0 outline-none text-xs text-[#e7e1df] placeholder-[#78716c] w-28 sm:w-36 focus:w-44 transition-all duration-300"
            />
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-[#78716c] bg-white/[0.05] border border-white/[0.08] rounded tracking-wide">
              ⌘F
            </kbd>
          </div>

          {/* Dropdown Sort Selector */}
          <div className="relative" ref={sortContainerRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1d1b1a] border border-white/[0.08] hover:border-white/20 hover:bg-[#211f1e] text-[#d6d3d1] transition-all cursor-pointer text-xs"
            >
              <ArrowUpDown size={14} className="text-[#a8a29e]" />
              <span className="font-medium tracking-wide">Sort: {sortBy}</span>
              <ChevronDown size={13} className="opacity-60" />
            </button>

            {/* Dropdown Menu */}
            {isSortOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#211f1e] border border-white/[0.1] shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in duration-100">
                {(['Date Created', 'Album Name', 'Asset Count', 'Recent Activity'] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortBy(key);
                      setIsSortOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      sortBy === key
                        ? 'bg-[#2c2928] text-white font-semibold'
                        : 'text-[#a8a29e] hover:bg-[#2c2928] hover:text-[#f5f5f4]'
                    }`}
                  >
                    <span>{key}</span>
                    {sortBy === key && <Check size={14} className="text-[#c6c6c7]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Switcher */}
          <div className="flex items-center bg-[#1d1b1a] border border-white/[0.08] p-0.5 rounded-full">
            <button
              type="button"
              onClick={() => setViewMode('comfortable')}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'comfortable'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
              title="Comfortable 4-Col Grid"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
              title="Compact 6-Col Grid"
            >
              <Grid3X3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'detailed'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-[#78716c] hover:text-[#f5f5f4]'
              }`}
              title="Detailed View"
            >
              <List size={15} />
            </button>
          </div>

          {/* Primary Action: + New Album */}
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className="flex items-center gap-1.5 bg-[#f5f5f4] text-[#1c1917] rounded-full px-4 py-1.5 hover:bg-white transition-all shadow-[0_0_24px_rgba(255,255,255,0.12)] hover:shadow-[0_0_28px_rgba(255,255,255,0.2)] group cursor-pointer font-medium text-xs"
            id="btn-create-album"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>New Album</span>
          </button>
        </div>
      </header>

      {/* ── Main Albums List (Smart Carousel + Custom Collections Grid) ── */}
      <AlbumsList
        albums={albums}
        onAlbumClick={handleAlbumClick}
        onRenameAlbum={handleRenameAlbum}
        onDeleteAlbum={handleDeleteAlbum}
        onCreateAlbum={() => setDialog({ type: 'create' })}
        searchQuery={searchQuery}
        sortBy={sortBy}
        viewMode={viewMode}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* ── Create Dialog ── */}
      <AlbumNameDialog
        isOpen={dialog.type === 'create'}
        mode="create"
        onConfirm={handleConfirmCreate}
        onClose={closeDialog}
      />

      {/* ── Rename Dialog ── */}
      <AlbumNameDialog
        isOpen={dialog.type === 'rename'}
        mode="rename"
        initialValue={dialog.type === 'rename' ? dialog.album.name : ''}
        onConfirm={handleConfirmRename}
        onClose={closeDialog}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={dialog.type === 'delete'}
        albumName={dialog.type === 'delete' ? dialog.album.name : ''}
        onConfirm={handleConfirmDelete}
        onClose={closeDialog}
      />
    </div>
  );
};

