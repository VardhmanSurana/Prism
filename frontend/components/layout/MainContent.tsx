import React, { Dispatch, SetStateAction } from 'react';
import { PhotoGrid } from '../PhotoGrid';
import { Photo, ViewMode, SearchFilters, SortMode } from '../../types';
import { ImportProgressStatus } from '../PhotoGrid/types';

const ExploreView = React.lazy(() => import('../explore/ExploreView').then(m => ({ default: m.ExploreView })));
const AlbumsView = React.lazy(() => import('../albums').then(m => ({ default: m.AlbumsView })));
const PeopleView = React.lazy(() => import('../PeopleView/index').then(m => ({ default: m.PeopleView })));
const UtilitiesView = React.lazy(() => import('../utilities/UtilitiesView').then(m => ({ default: m.UtilitiesView })));
const MapView = React.lazy(() => import('../MapView').then(m => ({ default: m.MapView })));
const LockedViewAuth = React.lazy(() => import('../LockedViewAuth/index').then(m => ({ default: m.LockedViewAuth })));
const LockedFolderView = React.lazy(() => import('../LockedViewAuth/LockedFolderView').then(m => ({ default: m.LockedFolderView })));
const AgentView = React.lazy(() => import('../AgentView/AgentView').then(m => ({ default: m.AgentView })));
const ProjectsDashboard = React.lazy(() => import('../projects/ProjectsDashboard').then(m => ({ default: m.ProjectsDashboard })));
const Appearance = React.lazy(() => import('../utilities/Appearance').then(m => ({ default: m.Appearance })));
const TrashView = React.lazy(() => import('../TrashView/TrashView').then(m => ({ default: m.TrashView })));
const ImageToolboxView = React.lazy(() => import('../ImageToolbox/ImageToolboxView').then(m => ({ default: m.ImageToolboxView })));

interface MainContentProps {
  currentView: ViewMode;
  photos: Photo[];
  isLoading?: boolean;
  isStatusLoading?: boolean;
  selectedIds: Set<string>;
  isLockedAuthenticated: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>;
  onPhotoClick: (photo: Photo | null) => void;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  onAuthenticate: () => void;
  onLockSession: () => void;
  onPhotosLoaded: (photos: Photo[] | null) => void;
  onScroll: () => void;
  onSearch?: (filters: SearchFilters | null) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: ImportProgressStatus) => void;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  onUpdatePhotos?: Dispatch<SetStateAction<Photo[]>>;
  onPhotoLocationUpdate?: (photoId: string | number, next: Partial<Photo>) => void;
  onBulkFavorite?: (selectedIds: Set<string>) => Promise<void>;
  onBulkDelete?: (selectedIds: Set<string>) => Promise<void>;
  onBulkLockToggle?: (selectedIds: Set<string>) => Promise<void>;
  onResetSuccess?: () => void;
}

export const MainContent = React.memo(function MainContent({
  currentView,
  photos,
  isLoading,
  isStatusLoading,
  selectedIds,
  isLockedAuthenticated,
  scrollRef,
  onPhotoClick,
  onToggleSelection,
  onToggleGroupSelection,
  onAuthenticate,
  onLockSession,
  onPhotosLoaded,
  onScroll,
  onSearch,
  onUpload,
  onImportProgress,
  sortMode,
  onSortChange,
  onUpdatePhotos,
  onPhotoLocationUpdate,
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
        return (
          <AlbumsView 
            onPhotoClick={onPhotoClick} 
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={onToggleGroupSelection}
          />
        );
      case 'people':
        return <PeopleView onPhotoClick={onPhotoClick} onPhotosLoaded={onPhotosLoaded} />;
      case 'projects':
        return <ProjectsDashboard />;
      case 'map':
        return (
          <MapView
            photos={photos}
            onPhotoClick={onPhotoClick}
            onPhotoLocationUpdate={onPhotoLocationUpdate}
          />
        );
      case 'utilities':
        return (
          <UtilitiesView 
            onResetSuccess={onResetSuccess}
          />
        );
      case 'appearance':
        return (
          <div className="p-4 md:p-7 max-w-5xl mx-auto flex-1">
            <Appearance />
          </div>
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
      case 'trash':
        return (
          <TrashView
            photos={photos}
            selectedIds={selectedIds}
            onPhotoClick={onPhotoClick}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={onToggleGroupSelection}
            onUpdatePhotos={onUpdatePhotos}
          />
        );
      case 'toolbox':
        return (
          <ImageToolboxView
            photos={photos}
            onPhotoClick={onPhotoClick}
          />
        );
      default:
        return (
          <PhotoGrid
            photos={photos}
            isLoading={isLoading || isStatusLoading}
            currentView={currentView}
            onPhotoClick={onPhotoClick}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            onToggleGroupSelection={onToggleGroupSelection}
            scrollParentRef={scrollRef}
            onSearch={onSearch}
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
      ref={scrollRef as React.LegacyRef<HTMLDivElement>}
      onScroll={onScroll}
      className={`flex-1 scroll-smooth custom-scrollbar relative ${
        currentView === 'agent' ? 'overflow-hidden h-full' : 'overflow-y-auto'
      }`}
    >
      <React.Suspense fallback={null}>
        {renderContent()}
      </React.Suspense>
    </div>
  );
});
