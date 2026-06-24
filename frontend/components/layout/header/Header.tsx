import React from 'react';
import { SearchBar } from './SearchBar';
import { ImportButton } from './ImportButton';
import { NotificationsButton } from './NotificationsButton';
import { UserProfile } from './UserProfile';
import type { HeaderProps } from '../types/header';
import { useImport } from '@/hooks/import';
import { GlassMaterial } from '@/components/GlassMaterial';

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  onUpload,
  onImportProgress,
  sortMode,
  onSortChange,
  syncStatus,
}) => {
  const { handleFileUpload, handleFolderImport } = useImport({ onUpload, onImportProgress });

  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-10 shrink-0 z-40 sticky top-0">
      <GlassMaterial intensity="regular" borderRadius="0" className="absolute inset-0 border-b border-white/[0.03] shadow-lg" />

      <div className="relative z-10 w-full flex items-center justify-between">
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
          <NotificationsButton syncStatus={syncStatus} />
          <UserProfile />
        </div>
      </div>
    </header>
  );
};
