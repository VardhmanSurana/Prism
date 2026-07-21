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

  const dbBytes = storageStats?.database_size_bytes || 0;
  const thumbBytes = storageStats?.thumbnail_cache_size_bytes || 0;
  const totalBytes = dbBytes + thumbBytes;
  const dbPercent = totalBytes > 0 ? (dbBytes / totalBytes) * 100 : 0;
  const thumbPercent = totalBytes > 0 ? (thumbBytes / totalBytes) * 100 : 0;

  return (
    <div className="space-y-6">
      <Header />

      {storageStats && (
        <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
                Disk Space Allocation
              </span>
              <h4 className="text-sm font-semibold text-white mt-1">Application Catalog Storage</h4>
            </div>
            <div className="text-right sm:text-right">
              <span className="text-[10px] font-mono text-gray-500 block">Total Used</span>
              <span className="text-lg font-serif italic text-white font-semibold">{formatBytes(totalBytes)}</span>
            </div>
          </div>
          
          {/* Progress Bar Visual */}
          <div className="h-3 w-full bg-white/[0.04] rounded-full overflow-hidden flex p-0.5 border border-white/[0.02]">
            <div 
              style={{ width: `${dbPercent}%` }} 
              className="h-full bg-[#5e6ad2] rounded-full transition-all duration-500 ease-out" 
              title={`Database Records: ${dbPercent.toFixed(1)}%`}
            />
            <div 
              style={{ width: `${thumbPercent}%` }} 
              className="h-full bg-[#828fff] rounded-full transition-all duration-500 ease-out -ml-1" 
              title={`Thumbnail Cache: ${thumbPercent.toFixed(1)}%`}
            />
          </div>

          {/* Legend and stats details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs border-t border-white/[0.03]">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-md bg-[#5e6ad2] shrink-0 mt-0.5 shadow-[0_0_8px_rgba(94,106,210,0.4)]" />
              <div>
                <p className="font-semibold text-[#f7f8f8]">Database Records</p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">{formatBytes(dbBytes)}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">Search index, labels, face metadata, and image vectors.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-md bg-[#828fff] shrink-0 mt-0.5 shadow-[0_0_8px_rgba(130,143,255,0.4)]" />
              <div>
                <p className="font-semibold text-[#f7f8f8]">Thumbnail Cache</p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">{formatBytes(thumbBytes)}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">Generated preview masks and compressed quality-compressed JPEG assets.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-md bg-white/10 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-[#f7f8f8]">Database Path</p>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate" title={storageStats.database_path}>
                  {storageStats.database_path.replace(/\/home\/[^/]+/, '~')}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">Physical location of the SQLite index file on your machine.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Maintenance */}
      <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-md">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
              Maintenance Utility Actions
            </span>
            <h4 className="text-sm font-semibold text-[#f7f8f8] mt-1">Optimize and Clean Cache</h4>
            <p className="text-xs text-[#8a8f98] mt-1 leading-relaxed">
              Purge temporary thumbnail files or trigger vacuum commands to reclaim space and shrink the index size.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              title="Delete all cached thumbnails to free disk space"
              className="px-4 py-2.5 bg-transparent border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02] text-[#d0d6e0] hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
            >
              {isClearingCache ? 'Clearing...' : 'Clear Thumbnail Cache'}
            </button>

            <button
              onClick={handleVacuumDatabase}
              disabled={isVacuuming}
              title="Optimize the SQLite database to reclaim disk space"
              className="px-4 py-2.5 bg-transparent border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02] text-[#d0d6e0] hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
            >
              {isVacuuming ? 'Vacuuming...' : 'Vacuum Database'}
            </button>
          </div>
        </div>

        {cacheActionStatus && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-xs font-mono border ${
            cacheActionStatus.type === 'success' ? 'bg-[#27a644]/10 border-[#27a644]/20 text-[#27a644]' :
            cacheActionStatus.type === 'error' ? 'bg-[#e5484d]/10 border-[#e5484d]/20 text-[#e5484d]' :
            'bg-[#5e6ad2]/10 border-[#5e6ad2]/20 text-[#5e6ad2]'
          }`}>
            {cacheActionStatus.message}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <TabSwitcher activeTab={activeSubTab} onTabChange={setActiveSubTab} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl">
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
