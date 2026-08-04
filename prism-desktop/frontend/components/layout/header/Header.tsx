import React, { useState, useRef, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { NotificationsButton } from './NotificationsButton';
import { HelpModal } from './HelpModal';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';
import { useImport } from '@/hooks/import';
import type { ViewMode, Photo, SearchFilters, SortMode } from '@/types';
import { Plus, HelpCircle, Settings, Image as ImageIcon, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChangeView?: (view: ViewMode) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  sortMode,
  onSortChange,
  onChangeView,
  onUpload = () => {},
  onImportProgress = () => {},
}) => {
  const { galleryStyle } = useGalleryLayout();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  const { handleFileUpload, handleFolderImport } = useImport({
    onUpload,
    onImportProgress,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = () => {
    if (onChangeView) {
      onChangeView('utilities');
    }
  };

  if (galleryStyle === 'google') {
    return (
      <header className="h-16 bg-[#131314] flex items-center justify-between px-6 shrink-0 z-40 sticky top-0 border-b border-white/5 font-sans select-none">
        <div className="flex-1 max-w-xl">
          <SearchBar
            onSearch={onSearch}
            sortMode={sortMode}
            onSortChange={onSortChange}
          />
        </div>

        {/* Right side Action Controls using Google Material Symbols */}
        <div className="flex items-center gap-2 ml-6">
          
          {/* Functional Import / Upload Button with Material Symbol */}
          <div className="relative" ref={uploadMenuRef}>
            <button 
              onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center cursor-pointer" 
              title="Import photos or directories"
            >
              <span className="material-symbols-outlined text-[24px] leading-none">add</span>
            </button>

            <AnimatePresence>
              {isUploadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 bg-[#19191c] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 text-xs font-sans text-gray-200"
                >
                  <button
                    onClick={() => {
                      setIsUploadMenuOpen(false);
                      handleFileUpload();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#A8C7FA]">photo_library</span>
                    <span>Import Files</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUploadMenuOpen(false);
                      handleFolderImport();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#81C995]">folder</span>
                    <span>Import Directory</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Functional Help Button with Material Symbol */}
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer" 
            title="Help & Shortcuts"
          >
            <span className="material-symbols-outlined text-[24px] leading-none">help_outline</span>
          </button>

          {/* Functional Settings Button with Material Symbol */}
          <button 
            onClick={handleSettingsClick}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer" 
            title="Settings & System Diagnostics"
          >
            <span className="material-symbols-outlined text-[24px] leading-none">settings</span>
          </button>

        </div>

        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </header>
    );
  }

  return (
    <header className="h-20 bg-background/80 flex items-center justify-between px-10 shrink-0 z-40 sticky top-0 border-b border-white/[0.03]">
      <div className="relative z-10 w-full flex items-center justify-between">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />

        <div className="flex items-center gap-4 ml-6">
          <NotificationsButton />
          
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer" 
            title="Help & Shortcuts"
          >
            <HelpCircle size={18} />
          </button>

          <button 
            onClick={handleSettingsClick}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer" 
            title="Settings & System Diagnostics"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </header>
  );
};
