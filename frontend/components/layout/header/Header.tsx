import React from 'react';
import { SearchBar } from './SearchBar';
import { NotificationsButton } from './NotificationsButton';
import { UserProfile } from './UserProfile';
import type { HeaderProps } from '../types/header';

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  sortMode,
  onSortChange,
}) => {
  return (
    <header className="h-20 bg-background/80 flex items-center justify-between px-10 shrink-0 z-40 sticky top-0 border-b border-white/[0.03]">
      <div className="relative z-10 w-full flex items-center justify-between">
        <SearchBar
          onSearch={onSearch}
          sortMode={sortMode}
          onSortChange={onSortChange}
        />

        <div className="flex items-center gap-6 ml-6">
          <NotificationsButton />
          <UserProfile />
        </div>
      </div>
    </header>
  );
};
