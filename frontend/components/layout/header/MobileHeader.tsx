import React from 'react';
import { Settings } from 'lucide-react';
import type { ViewMode, SearchFilters, SortMode } from '@/types';
import { SearchBar } from './SearchBar';

interface MobileHeaderProps {
  currentView: ViewMode;
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChangeView: (view: ViewMode) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentView,
  onSearch,
  sortMode,
  onSortChange,
  onChangeView,
}) => {
  return (
    <header className="h-16 bg-[#12151e]/90 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 z-40 sticky top-0 border-b border-white/10 select-none">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          <img src="/prism-logo.png" alt="Prism" className="w-full h-full object-cover" />
        </div>
        <span className="text-lg font-serif italic text-white tracking-wide">Prism</span>
      </div>

      <div className="flex-1 max-w-xs mx-3">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />
      </div>

      <button
        onClick={() => onChangeView('utilities')}
        className="p-2 text-gray-400 hover:text-white rounded-full transition-colors"
        title="Settings"
      >
        <Settings size={18} />
      </button>
    </header>
  );
};
