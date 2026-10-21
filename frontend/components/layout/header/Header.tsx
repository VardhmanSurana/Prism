import React, { useState, useRef, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { WebImportModal } from '@/components/import/WebImportModal';
import type { ViewMode, Photo, SearchFilters, SortMode } from '@/types';
import {
  Plus,
  ChevronDown,
  Upload,
  FolderUp,
  Globe,
  LayoutTemplate,
  LayoutGrid,
  Grid3x3,
  BookOpen,
} from 'lucide-react';
import { useImport } from '@/hooks/import';
import { useGalleryLayoutStore } from '@/store/galleryLayoutStore';

export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChangeView?: (view: ViewMode) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: any) => void;
  onMonographClick?: () => void;
}

/**
 * Header - Minimalist header with deep search, layout switcher, monograph launcher, and integrated import dropdown.
 */
export const Header: React.FC<HeaderProps> = ({
  onSearch,
  sortMode,
  onSortChange,
  onUpload,
  onImportProgress,
  onMonographClick,
}) => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isWebImportOpen, setIsWebImportOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  const layoutMode = useGalleryLayoutStore((state) => state.settings.layoutMode);
  const setLayoutMode = useGalleryLayoutStore((state) => state.setLayoutMode);

  const handleMonographOpen = () => {
    if (onMonographClick) {
      onMonographClick();
    }
    window.dispatchEvent(new CustomEvent('prism:open-monograph'));
  };

  const { handleFileUpload, handleFolderImport, importFromUrl } = useImport({
    onUpload: onUpload || (() => {}),
    onImportProgress: onImportProgress || (() => {}),
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setIsImportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportFiles = () => {
    setIsImportOpen(false);
    handleFileUpload();
  };

  const handleImportFolder = () => {
    setIsImportOpen(false);
    handleFolderImport();
  };

  const handleImportFromWeb = () => {
    setIsImportOpen(false);
    setIsWebImportOpen(true);
  };

  return (
    <header className="h-16 bg-[#0c0a09]/90 backdrop-blur-xl border-b border-[#292524] px-4 sm:px-8 z-40 sticky top-0 flex items-center justify-between gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />
      </div>

      {/* Right Controls & Import Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Layout View Mode Switcher */}
        <div className="flex items-center bg-[#151312] border border-[#292524] p-0.5 rounded-full shadow-inner">
          <button
            type="button"
            onClick={() => setLayoutMode('editorial')}
            title="Editorial Layout (Asymmetric Bento)"
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
              layoutMode === 'editorial'
                ? 'bg-[#292524] text-[#f5f5f4] shadow-sm font-semibold'
                : 'text-[#a8a29e] hover:text-[#f5f5f4]'
            }`}
          >
            <LayoutTemplate size={13} className={layoutMode === 'editorial' ? 'text-[#e5a93c]' : ''} />
            <span className="hidden md:inline">Editorial</span>
          </button>

          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            title="Justified Aspect Grid"
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
              layoutMode === 'grid'
                ? 'bg-[#292524] text-[#f5f5f4] shadow-sm font-semibold'
                : 'text-[#a8a29e] hover:text-[#f5f5f4]'
            }`}
          >
            <LayoutGrid size={13} className={layoutMode === 'grid' ? 'text-[#e5a93c]' : ''} />
            <span className="hidden md:inline">Grid</span>
          </button>

          <button
            type="button"
            onClick={() => setLayoutMode('dense')}
            title="Dense Compact Mosaic"
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
              layoutMode === 'dense'
                ? 'bg-[#292524] text-[#f5f5f4] shadow-sm font-semibold'
                : 'text-[#a8a29e] hover:text-[#f5f5f4]'
            }`}
          >
            <Grid3x3 size={13} className={layoutMode === 'dense' ? 'text-[#e5a93c]' : ''} />
            <span className="hidden md:inline">Dense</span>
          </button>
        </div>

        {/* Monograph View Launcher */}
        <button
          type="button"
          onClick={handleMonographOpen}
          className="h-9 px-3 rounded-full bg-[#181514] border border-[#292524] hover:bg-[#23201e] hover:border-[#3a3533] text-[#f5f5f4] text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
          title="Open Monograph Curation View"
        >
          <BookOpen size={14} className="text-[#e5a93c]" />
          <span className="hidden sm:inline">Monograph View</span>
        </button>

        {/* Import Action with Dropdown */}
        <div className="relative" ref={importMenuRef}>
          <button
            type="button"
            onClick={() => setIsImportOpen(!isImportOpen)}
            className="h-9 px-3.5 sm:px-4 rounded-full bg-[#f5f5f4] text-[#151312] text-xs font-semibold flex items-center gap-1.5 hover:bg-white shadow-[0_0_20px_rgba(255,255,255,0.12)] transition-all cursor-pointer active:scale-95"
            title="Import media into archive"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Import</span>
            <ChevronDown
              size={13}
              className={`text-[#78716c] transition-transform duration-200 ${isImportOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isImportOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 py-1.5 bg-[#181514] border border-[#292524] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleImportFiles}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-[#f5f5f4] hover:bg-[#23201e] transition-colors text-left cursor-pointer"
              >
                <Upload size={16} className="text-[#a8a29e]" />
                <div>
                  <div className="font-medium text-[#f5f5f4]">Import files</div>
                  <div className="text-[10px] text-[#78716c]">Single or batch photos & videos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleImportFolder}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-[#f5f5f4] hover:bg-[#23201e] transition-colors text-left cursor-pointer"
              >
                <FolderUp size={16} className="text-[#a8a29e]" />
                <div>
                  <div className="font-medium text-[#f5f5f4]">Import folder</div>
                  <div className="text-[10px] text-[#78716c]">Scan local directories recursively</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleImportFromWeb}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-[#f5f5f4] hover:bg-[#23201e] transition-colors text-left cursor-pointer"
              >
                <Globe size={16} className="text-[#a8a29e]" />
                <div>
                  <div className="font-medium text-[#f5f5f4]">Import from web</div>
                  <div className="text-[10px] text-[#78716c]">Download media from direct URL</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <WebImportModal
        isOpen={isWebImportOpen}
        onClose={() => setIsWebImportOpen(false)}
        onImport={importFromUrl}
      />
    </header>
  );
};

