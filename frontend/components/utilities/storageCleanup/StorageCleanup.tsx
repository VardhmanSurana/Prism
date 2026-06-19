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
    storageStats,
    cacheActionStatus,
    isClearingCache,
    isVacuuming,
    handleClearCache,
    handleVacuumDatabase,
    handleDeletePhoto,
    formatBytes
  } = useStorageCleanup();

  return (
    <div className="space-y-5">
      <Header />

      {storageStats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Database', value: formatBytes(storageStats.database_size_bytes), sub: storageStats.database_path.replace(/\/home\/[^/]+/, '~') },
            { label: 'Thumbnails', value: formatBytes(storageStats.thumbnail_cache_size_bytes), sub: 'Generated preview cache' },
            { label: 'Total', value: formatBytes(storageStats.database_size_bytes + storageStats.thumbnail_cache_size_bytes), sub: 'Indexed library data' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-2">
                {stat.label}
              </p>
              <p className="text-lg font-serif italic text-[#f7f8f8]">{stat.value}</p>
              <p className="text-[10px] font-mono text-[#8a8f98] mt-1 truncate" title={stat.sub}>{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Database Maintenance */}
      <div className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d]">
              Database Maintenance
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              title="Delete all cached thumbnails to free disk space"
              className="px-4 py-2 bg-[#050505] border border-[#23252a] text-[#d0d6e0] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#141516] disabled:opacity-40 transition-colors"
            >
              {isClearingCache ? 'Clearing...' : 'Clear Thumbnail Cache'}
            </button>

            <button
              onClick={handleVacuumDatabase}
              disabled={isVacuuming}
              title="Optimize the SQLite database to reclaim disk space"
              className="px-4 py-2 bg-[#050505] border border-[#23252a] text-[#d0d6e0] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#141516] disabled:opacity-40 transition-colors"
            >
              {isVacuuming ? 'Vacuuming...' : 'Vacuum Database'}
            </button>
          </div>
        </div>

        {cacheActionStatus && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-mono ${
            cacheActionStatus.type === 'success' ? 'bg-[#27a644]/10 text-[#27a644]' :
            cacheActionStatus.type === 'error' ? 'bg-[#e5484d]/10 text-[#e5484d]' :
            'bg-[#5e6ad2]/10 text-[#5e6ad2]'
          }`}>
            {cacheActionStatus.message}
          </div>
        )}
      </div>

      <TabSwitcher activeTab={activeSubTab} onTabChange={setActiveSubTab} />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-5">
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
