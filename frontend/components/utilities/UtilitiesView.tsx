import React, { useState } from 'react';
import { useUtilities } from '../../hooks/utilities';
import { 
  HardDrive, 
  Cpu, 
  Shield, 
  Activity, 
  Palette,
  Folder,
  Users,
  Trash2,
  ShieldAlert
} from 'lucide-react';

import { SyncSettings } from './SyncSettings';
import { FaceSettings } from './FaceSettings';
import { AISettings } from './AISettings';
import { PurgeSettings } from './PurgeSettings';
import { Appearance } from './Appearance';
import { SystemIntegrity } from './SystemIntegrity';
import { ConfirmationDialog } from './ConfirmationDialog';
import { StorageCleanup } from './storageCleanup';
import { DiagnosticsLogs } from './DiagnosticsLogs';
import { PrivacyDashboard } from './PrivacyDashboard';

interface UtilitiesViewProps {
  onResetSuccess?: () => void;
}

const TABS = [
  { id: 'storage' as const, label: 'Storage Cleanup', icon: HardDrive },
  { id: 'system' as const, label: 'Engine Settings', icon: Cpu },
  { id: 'privacy' as const, label: 'Privacy & Safety', icon: Shield },
  { id: 'diagnostics' as const, label: 'Diagnostics', icon: Activity },
  { id: 'appearance' as const, label: 'Appearance', icon: Palette },
];

export const UtilitiesView: React.FC<UtilitiesViewProps> = ({ onResetSuccess }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'system' | 'privacy' | 'diagnostics' | 'appearance'>('storage');
  
  const {
    syncEnabled,
    watchedFolders,
    excludedFolders,
    watchedInput,
    setWatchedInput,
    handleAddWatchedFolder,
    handleRemoveWatchedFolder,
    handleBrowseWatched,
    excludedInput,
    setExcludedInput,
    handleAddExcludedFolder,
    handleRemoveExcludedFolder,
    handleBrowseExcluded,
    purgeInput,
    setPurgeInput,
    purgeStatus,
    isResetting,
    systemStatus,
    confirmDialog,
    setConfirmDialog,
    handleToggleSync,
    handlePurgeBrowse,
    handlePurgeFolder,
    handleResetLibrary,
    handleTriggerFaceSync
  } = useUtilities({ onResetSuccess });

  return (
    <div className="min-h-full bg-transparent">
      <header className="px-10 pt-10 pb-6 flex items-center justify-between border-b border-white/[0.04]">
        <div>
          <h2 className="font-serif font-bold text-white text-[32px] leading-tight">
            System Utilities
          </h2>
          <p className="text-xs text-[#8a8f98] mt-1">
            Configure application runtime settings, machine learning features, diagnostics and database utilities.
          </p>
        </div>
      </header>

      <div className="px-10 py-6 flex justify-start">
        <div className="flex flex-wrap gap-1 bg-white/[0.01] border border-white/[0.05] rounded-2xl p-1 shadow-2xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-primary text-black shadow-[0_0_20px_rgba(var(--color-primary),0.2)] font-semibold'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-black' : 'text-gray-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-10 pb-16">
        {activeTab === 'storage' && (
          <StorageCleanup />
        )}

        {activeTab === 'system' && (
          <div className="divide-y divide-white/[0.04] space-y-12">
            {/* AI Core Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4 first:pt-0">
              <div className="lg:col-span-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={16} className="text-[#5e6ad2]" />
                  <h4 className="font-serif italic text-white text-xl leading-tight">
                    AI Core Settings
                  </h4>
                </div>
                <p className="text-xs text-[#8a8f98] leading-relaxed">
                  Configure hardware acceleration mode (CUDA/ROCm/CPU) and choose active machine learning pipelines for semantic search, facial recognition, captioning, and video AI features.
                </p>
              </div>
              <div className="lg:col-span-2">
                <AISettings />
              </div>
            </div>

            {/* Sync Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
              <div className="lg:col-span-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-[#5e6ad2]" />
                  <h4 className="font-serif italic text-white text-xl leading-tight">
                    Territory Sync
                  </h4>
                </div>
                <p className="text-xs text-[#8a8f98] leading-relaxed">
                  Manage indexed folders in your local filesystem. Add folders to auto-scan or define exclusion paths to prevent search indexers from tracking temporary directories.
                </p>
              </div>
              <div className="lg:col-span-2">
                <SyncSettings 
                  syncEnabled={syncEnabled}
                  onToggleSync={handleToggleSync}
                  watchedFolders={watchedFolders}
                  watchedInput={watchedInput}
                  setWatchedInput={setWatchedInput}
                  onBrowseWatched={handleBrowseWatched}
                  onAddWatchedFolder={handleAddWatchedFolder}
                  onRemoveWatchedFolder={handleRemoveWatchedFolder}
                  excludedFolders={excludedFolders}
                  excludedInput={excludedInput}
                  setExcludedInput={setExcludedInput}
                  onBrowseExcluded={handleBrowseExcluded}
                  onAddExcludedFolder={handleAddExcludedFolder}
                  onRemoveExcludedFolder={handleRemoveExcludedFolder}
                />
              </div>
            </div>

            {/* Face discovery */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
              <div className="lg:col-span-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-[#5e6ad2]" />
                  <h4 className="font-serif italic text-white text-xl leading-tight">
                    People Recognition
                  </h4>
                </div>
                <p className="text-xs text-[#8a8f98] leading-relaxed">
                  Trigger manual facial detection and clustering scans. The offline DBSCAN clustering engine organizes detected faces into groups on your People album.
                </p>
              </div>
              <div className="lg:col-span-2">
                <FaceSettings 
                  onTriggerSync={handleTriggerFaceSync}
                  status={systemStatus}
                />
              </div>
            </div>

            {/* Purge Folder Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
              <div className="lg:col-span-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 size={16} className="text-red-400" />
                  <h4 className="font-serif italic text-white text-xl leading-tight">
                    Cleanse Territories
                  </h4>
                </div>
                <p className="text-xs text-[#8a8f98] leading-relaxed">
                  Permanently remove an indexed folder from your library database and purge all its cached thumbnails, without deleting the original source files on disk.
                </p>
              </div>
              <div className="lg:col-span-2">
                <PurgeSettings 
                  purgeInput={purgeInput}
                  setPurgeInput={setPurgeInput}
                  purgeStatus={purgeStatus}
                  onBrowse={handlePurgeBrowse}
                  onPurge={handlePurgeFolder}
                />
              </div>
            </div>

            {/* Danger Zone */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
              <div className="lg:col-span-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-red-500" />
                  <h4 className="font-serif italic text-white text-xl leading-tight">
                    Danger Zone
                  </h4>
                </div>
                <p className="text-xs text-[#8a8f98] leading-relaxed">
                  Perform destructive database actions. Completely reset your application library, purge all metadata indexes, and delete locked vaults. This action is irreversible.
                </p>
              </div>
              <div className="lg:col-span-2">
                <SystemIntegrity 
                  isResetting={isResetting}
                  onReset={handleResetLibrary}
                  systemStatus={systemStatus}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <PrivacyDashboard />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsLogs />
        )}

        {activeTab === 'appearance' && (
          <Appearance />
        )}
      </main>

      <footer className="px-10 pb-12">
        <div className="border-t border-white/[0.05] pt-8 flex items-center justify-between opacity-50">
          <span className="text-[10px] font-mono text-gray-500">
            Prism Engine v0.4.2 // Protocol Active
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              Operational
            </span>
          </div>
        </div>
      </footer>

      <ConfirmationDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev: any) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

