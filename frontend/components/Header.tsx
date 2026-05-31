import React from 'react';
import { Photo, SearchFilters, SortMode } from '../types';
import { useImport } from '../hooks/import';

// Sub-components
import { SearchBar } from './header/SearchBar';
import { ImportButton } from './header/ImportButton';
import { NotificationsButton } from './header/NotificationsButton';
import { UserProfile } from './header/UserProfile';

interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: {
    is_scanning: boolean;
    total_files: number;
    processed_files: number;
    progress: number;
  }) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onSearch, 
  onUpload, 
  onImportProgress, 
  sortMode, 
  onSortChange 
}) => {
  const { handleFileUpload, handleFolderImport } = useImport({ onUpload, onImportProgress });

  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-10 shrink-0 z-40 sticky top-0">
      <SearchBar 
        onSearch={onSearch}
        sortMode={sortMode}
        onSortChange={onSortChange}
      />

      <div className="flex items-center gap-6 ml-6">
        <ImportButton 
          onFileUpload={handleFileUpload}
          onFolderImport={handleFolderImport}
        />
        <NotificationsButton />
        <UserProfile />
      </div>
    </header>
  );
};
