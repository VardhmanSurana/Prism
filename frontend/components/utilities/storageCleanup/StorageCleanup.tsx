import React from 'react';
import { useStorageCleanup } from './useStorageCleanup';
import { Header } from './Header';
import { TabSwitcher } from './TabSwitcher';
import { LoadingState } from './LoadingState';
import { BlurryPhotosTab } from './BlurryPhotosTab';
import { DuplicatesTab } from './DuplicatesTab';
import { DocumentsTab } from './DocumentsTab';

/**
 * Storage cleanup overview: storage stats, cache actions, and tabbed cleanup results.
 */
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
    <div className="space-y-4">
      {storageStats && (
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3 mb-3">
            <div>
              <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title mb-0">Disk Usage & Allocation</div>
              <p className="text-xs text-[#78716c]">Local index database & thumbnail asset footprints</p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-[#78716c] block">Total Catalog Size</span>
              <span className="text-sm font-bold text-[#e5a93c]">{formatBytes(totalBytes)}</span>
            </div>
          </div>
          
          {/* Bar Chart Visual */}
          <div className="cr-bar-chart">
            <div className="cr-bar-row">
              <span className="cr-bar-label">Database</span>
              <div className="cr-bar-track"><div className="cr-bar-fill green" style={{ width: `${dbPercent || 40}%` }}></div></div>
              <span className="cr-bar-value">{formatBytes(dbBytes)}</span>
            </div>

            <div className="cr-bar-row">
              <span className="cr-bar-label">Thumbnails</span>
              <div className="cr-bar-track"><div className="cr-bar-fill blue" style={{ width: `${thumbPercent || 60}%` }}></div></div>
              <span className="cr-bar-value">{formatBytes(thumbBytes)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Controls */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[#f5f0ed] mb-1">Maintenance & Reclaim Utilities</div>
            <p className="text-xs text-[#78716c]">
              Clear temporary thumbnail caches or trigger database vacuum optimizations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition"
            >
              {isClearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>

            <button
              onClick={handleVacuumDatabase}
              disabled={isVacuuming}
              className="px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition shadow-sm"
            >
              {isVacuuming ? 'Optimizing...' : 'Optimize Database'}
            </button>
          </div>
        </div>

        {cacheActionStatus && (
          <div className={`mt-3 font-mono text-xs p-2.5 rounded border ${
            cacheActionStatus.type === 'success' ? 'bg-[rgba(229,169,60,0.15)] text-[#e5a93c] border-[#e5a93c]/30' :
            cacheActionStatus.type === 'error' ? 'bg-[#100e0d] text-[#f87171] border-[#f87171]/30' :
            'bg-[#100e0d] text-[#a8a29e] border-[#a8a29e]/30'
          }`}>
            {cacheActionStatus.message}
          </div>
        )}
      </div>

      {/* Sub Tab Switcher */}
      <div className="pt-2">
        <TabSwitcher activeTab={activeSubTab} onTabChange={setActiveSubTab} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
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

