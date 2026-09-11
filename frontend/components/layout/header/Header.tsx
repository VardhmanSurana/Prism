import React, { useState } from 'react';
import { SearchBar } from './SearchBar';
import { ActivityCenter } from '@/components/activity/ActivityCenter';
import { ServerConnectionPill } from '@/components/network/ServerConnectionModal';
import { HelpModal } from './HelpModal';
import type { ViewMode, Photo, SearchFilters, SortMode } from '@/types';
import { HelpCircle, Settings } from 'lucide-react';

export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChangeView?: (view: ViewMode) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: any) => void;
}

// ponytail: simplified Header, unified ServerConnectionPill and ActivityCenter
/**
 * Header - Renders header.
 */
export const Header: React.FC<HeaderProps> = ({
  onSearch,
  sortMode,
  onSortChange,
  onChangeView,
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  /**
   * handleSettingsClick - Handles settings click.
   */
  const handleSettingsClick = () => {
    if (onChangeView) {
      onChangeView('utilities');
    }
  };

  return (
    <header className="h-20 bg-background/80 flex items-center justify-between px-10 shrink-0 z-40 sticky top-0 border-b border-white/[0.03]">
      <div className="relative z-10 w-full flex items-center justify-between">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />

        <div className="flex items-center gap-3 ml-6">
          <ServerConnectionPill />
          <ActivityCenter />
          
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
