import React, { useState } from 'react';
import { useUtilities } from '../../hooks/utilities';

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
  { id: 'storage' as const, label: 'Storage Cleanup' },
  { id: 'system' as const, label: 'Engine Settings' },
  { id: 'privacy' as const, label: 'Privacy' },
  { id: 'diagnostics' as const, label: 'Diagnostics' },
  { id: 'appearance' as const, label: 'Appearance' },
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
    <div className="min-h-full bg-[#050505]">
      <header className="max-w-5xl mx-auto px-8 pt-10 pb-8 text-center">
        <h2 className="font-serif italic text-white text-[32px] leading-tight">
          System Utilities
        </h2>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-gray-500 mt-3">
          Engine management & environment optimization
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-8 pb-8 flex justify-center">
        <div className="flex gap-1 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-1.5 shadow-2xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-500 ${
                activeTab === tab.id
                  ? 'bg-primary text-black shadow-[0_0_20px_rgba(var(--color-primary),0.3)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-8 pb-12 space-y-5">
        {activeTab === 'storage' && (
          <StorageCleanup />
        )}

        {activeTab === 'system' && (
          <div className="space-y-5">
            <AISettings />
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

            <FaceSettings 
              onTriggerSync={handleTriggerFaceSync}
              status={systemStatus}
            />

            <PurgeSettings 
              purgeInput={purgeInput}
              setPurgeInput={setPurgeInput}
              purgeStatus={purgeStatus}
              onBrowse={handlePurgeBrowse}
              onPurge={handlePurgeFolder}
            />

            <SystemIntegrity 
              isResetting={isResetting}
              onReset={handleResetLibrary}
              systemStatus={systemStatus}
            />
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

      <footer className="max-w-5xl mx-auto px-8 pb-12">
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
