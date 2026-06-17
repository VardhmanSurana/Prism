import React, { Dispatch, SetStateAction } from 'react';
import { ExploreView } from './ExploreView';
import { AlbumsView } from './albums';
import { PeopleView } from './PeopleView/index';
import { UtilitiesView } from './UtilitiesView';
import { MapView } from './MapView';
import { PhotoGrid } from './PhotoGrid';
import { LockedViewAuth } from './LockedViewAuth/index';
import { LockedFolderView } from './LockedFolderView';
import { AgentView } from './AgentView';
import { Photo, ViewMode, SearchFilters, SortMode } from '../types';
import { ImportProgressStatus } from './PhotoGrid/types';

interface MainContentProps {
  currentView: ViewMode;
  photos: Photo[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  isLockedAuthenticated: boolean;
  theme: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onPhotoClick: (photo: Photo | null) => void;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  onAuthenticate: () => void;
  onLockSession: () => void;
  onThemeChange: (theme: string) => void;
  onPhotosLoaded: (photos: Photo[] | null) => void;
  onScroll: () => void;
  onSearch?: (filters: SearchFilters | null) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: ImportProgressStatus) => void;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  onUpdatePhotos?: Dispatch<SetStateAction<Photo[]>>;
  onBulkFavorite?: (selectedIds: Set<string>) => Promise<void>;
  onBulkDelete?: (selectedIds: Set<string>) => Promise<void>;
  onBulkLockToggle?: (selectedIds: Set<string>) => Promise<void>;
  onResetSuccess?: () => void;
}

export function MainContent({
  currentView,
  photos,
  isLoading,
  selectedIds,
  isLockedAuthenticated,
  theme,
  scrollRef,
  onPhotoClick,
  onToggleSelection,
  onToggleGroupSelection,
  onAuthenticate,
  onLockSession,
  onThemeChange,
  onPhotosLoaded,
  onScroll,
  onSearch,
  onUpload,
  onImportProgress,
  sortMode,
  onSortChange,
  onUpdatePhotos,
  onBulkFavorite,
  onBulkDelete,
  onBulkLockToggle,
  onResetSuccess
}: MainContentProps) {
  const renderContent = () => {
    switch (currentView) {
      case 'explore':
        return <ExploreView />;
      case 'agent':
        return <AgentView onPhotoClick={onPhotoClick} />;
      case 'albums':
        return <AlbumsView onPhotoClick={onPhotoClick} />;
      case 'people':
        return <PeopleView onPhotoClick={onPhotoClick} onPhotosLoaded={onPhotosLoaded} />;
      case 'map':
        return <MapView photos={photos} onPhotoClick={onPhotoClick} />;
      case 'utilities':
        return (
          <UtilitiesView 
            currentTheme={theme} 
            onThemeChange={onThemeChange} 
            onResetSuccess={onResetSuccess}
          />
        );
      case 'locked':
        if (!isLockedAuthenticated) {
          return <LockedViewAuth onAuthenticate={onAuthenticate} />;
        }
        return (
          <LockedFolderView
            photos={photos}
            selectedIds={selectedIds}
            onPhotoClick={onPhotoClick}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={onToggleGroupSelection}
            onLockSession={onLockSession}
            scrollParentRef={scrollRef}
          />
        );
      default:
        return (
          <PhotoGrid
            photos={photos}
            isLoading={isLoading}
            currentView={currentView}
            onPhotoClick={onPhotoClick}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={onToggleGroupSelection}
            scrollParentRef={scrollRef}
            onSearch={onSearch}
            onUpload={onUpload}
            onImportProgress={onImportProgress}
            sortMode={sortMode}
            onSortChange={onSortChange}
            onUpdatePhotos={onUpdatePhotos}
            onBulkFavorite={onBulkFavorite}
            onBulkDelete={onBulkDelete}
            onBulkLockToggle={onBulkLockToggle}
          />
        );
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative"
    >
      {renderContent()}
    </div>
  );
}
