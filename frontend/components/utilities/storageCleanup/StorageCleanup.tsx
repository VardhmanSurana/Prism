import React from 'react';
import { Database, Image, RefreshCw, Trash2, Loader2, HardDrive, CheckCircle2, XCircle } from 'lucide-react';
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
    <div className="bg-[#111]/40 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-8">
      <Header />

      {/* Storage Summary Cards */}
      {storageStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Database size={16} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Database</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatBytes(storageStats.database_size_bytes)}</p>
            <p className="text-[9px] font-mono text-gray-600 truncate" title={storageStats.database_path}>
              {storageStats.database_path.replace(/\/home\/[^/]+/, '~')}
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Image size={16} className="text-yellow-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Thumbnails</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatBytes(storageStats.thumbnail_cache_size_bytes)}</p>
            <p className="text-[9px] font-mono text-gray-600">Generated preview cache</p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <HardDrive size={16} className="text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatBytes(storageStats.database_size_bytes + storageStats.thumbnail_cache_size_bytes)}</p>
            <p className="text-[9px] font-mono text-gray-600">Indexed library data</p>
          </div>
        </div>
      )}

      {/* Maintenance Actions */}
      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-400 mb-1">
          <HardDrive size={16} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Database Maintenance</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            title="Delete all cached thumbnails to free disk space. Photos will need to be re-indexed."
            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold uppercase tracking-wider py-3 px-5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          >
            {isClearingCache ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : (
              <Trash2 size={14} className="text-rose-400" />
            )}
            <span>Clear Thumbnail Cache</span>
          </button>

          <button
            onClick={handleVacuumDatabase}
            disabled={isVacuuming}
            title="Optimize the SQLite database to reclaim disk space and improve performance"
            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold uppercase tracking-wider py-3 px-5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          >
            {isVacuuming ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : (
              <RefreshCw size={14} className="text-blue-400" />
            )}
            <span>Vacuum Database</span>
          </button>
        </div>

        {cacheActionStatus && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-mono animate-in fade-in slide-in-from-top-1
            ${cacheActionStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
            ${cacheActionStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : ''}
            ${cacheActionStatus.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : ''}`}
          >
            {cacheActionStatus.type === 'success' && <CheckCircle2 size={14} />}
            {cacheActionStatus.type === 'error' && <XCircle size={14} />}
            {cacheActionStatus.type === 'info' && <Loader2 size={14} className="animate-spin" />}
            <span>{cacheActionStatus.message}</span>
          </div>
        )}
      </div>

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
