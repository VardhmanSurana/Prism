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
        <div className="cr-card">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[var(--cr-border)] pb-3 mb-3">
            <div>
              <div className="cr-card-title mb-0">Disk Usage & Allocation</div>
              <p className="text-xs text-[var(--cr-text-muted)]">Local index database & thumbnail asset footprints</p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-[var(--cr-text-muted)] block">Total Catalog Size</span>
              <span className="text-sm font-bold text-[var(--cr-accent)]">{formatBytes(totalBytes)}</span>
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
      <div className="cr-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="cr-card-title mb-1">Maintenance & Reclaim Utilities</div>
            <p className="text-xs text-[var(--cr-text-muted)]">
              Clear temporary thumbnail caches or trigger database vacuum optimizations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="cr-inline-btn"
            >
              {isClearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>

            <button
              onClick={handleVacuumDatabase}
              disabled={isVacuuming}
              className="cr-inline-btn primary"
            >
              {isVacuuming ? 'Optimizing...' : 'Optimize Database'}
            </button>
          </div>
        </div>

        {cacheActionStatus && (
          <div className={`mt-3 font-mono text-xs p-2.5 rounded border ${
            cacheActionStatus.type === 'success' ? 'bg-[var(--cr-accent-glow-strong)] text-[var(--cr-accent)] border-[var(--cr-accent)]/30' :
            cacheActionStatus.type === 'error' ? 'bg-[var(--cr-surface-sunken)] text-[var(--cr-status-error)] border-[var(--cr-status-error)]/30' :
            'bg-[var(--cr-surface-sunken)] text-[var(--cr-secondary)] border-[var(--cr-secondary)]/30'
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
        <div className="cr-card">
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

