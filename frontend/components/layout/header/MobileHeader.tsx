import React from 'react';
import { Settings, Upload } from 'lucide-react';
import type { ViewMode, SearchFilters, SortMode } from '@/types';
import { SearchBar } from './SearchBar';
import { ServerConnectionPill } from '../../network/ServerConnectionModal';

interface MobileHeaderProps {
  currentView?: ViewMode;
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChangeView: (view: ViewMode) => void;
  onUpload?: () => void;
  onOpenServerModal?: () => void;
}

/**
 * MobileHeader - Renders sticky mobile header with safe-area padding, search, upload, server status pill, and settings.
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentView,
  onSearch,
  sortMode,
  onSortChange,
  onChangeView,
  onUpload,
  onOpenServerModal,
}) => {
  return (
    <header className="min-h-16 pt-safe bg-[#12151e]/90 backdrop-blur-2xl px-3.5 py-2 flex items-center justify-between gap-2 shrink-0 z-40 sticky top-0 border-b border-white/10 select-none">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          <img src="/prism-logo.png" alt="Prism" className="w-full h-full object-cover" />
        </div>
        <span className="text-base font-serif italic text-white tracking-wide hidden xs:inline">Prism</span>
      </div>

      <div className="flex-1 min-w-0 max-w-xs mx-1">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div onClick={onOpenServerModal} className="flex items-center">
          <ServerConnectionPill />
        </div>

        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors active:scale-95"
            title="Upload Photos"
            aria-label="Upload Photos"
          >
            <Upload size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => onChangeView('utilities')}
          className={`p-2 rounded-full transition-colors active:scale-95 ${
            currentView === 'utilities'
              ? 'text-[#FCBC00] bg-[#FCBC00]/15'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
