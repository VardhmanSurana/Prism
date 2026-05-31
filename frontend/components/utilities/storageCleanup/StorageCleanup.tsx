import React from 'react';
import { useStorageCleanup } from './useStorageCleanup';
import { Header } from './Header';
import { TabSwitcher } from './TabSwitcher';
import { LoadingState } from './LoadingState';
import { BlurryPhotosTab } from './BlurryPhotosTab';
import { DuplicatesTab } from './DuplicatesTab';
import { DocumentsTab } from './DocumentsTab';

export const StorageCleanup: React.FC = () => {
  const {
    activeSubTab,
    setActiveSubTab,
    blurryPhotos,
    duplicateClusters,
    documentPhotos,
    isLoading,
    handleDeletePhoto
  } = useStorageCleanup();

  return (
    <div className="bg-[#111]/40 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
      <Header />
      <TabSwitcher activeTab={activeSubTab} onTabChange={setActiveSubTab} />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="pt-2">
          {activeSubTab === 'blurry' && (
            <BlurryPhotosTab photos={blurryPhotos} onDelete={handleDeletePhoto} />
          )}
          {activeSubTab === 'duplicates' && (
            <DuplicatesTab clusters={duplicateClusters} onDelete={handleDeletePhoto} />
          )}
          {activeSubTab === 'documents' && (
            <DocumentsTab photos={documentPhotos} onDelete={handleDeletePhoto} />
          )}
        </div>
      )}
    </div>
  );
};
