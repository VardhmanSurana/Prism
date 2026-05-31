import React, { useState } from 'react';
import { Cloud, Settings2, Trash2 } from 'lucide-react';
import { useUtilities } from '../hooks/utilities';

// Sub-components
import { SyncSettings } from './utilities/SyncSettings';
import { FaceSettings } from './utilities/FaceSettings';
import { PurgeSettings } from './utilities/PurgeSettings';
import { ThemeSettings } from './utilities/ThemeSettings';
import { SystemIntegrity } from './utilities/SystemIntegrity';
import { ConfirmationDialog } from './utilities/ConfirmationDialog';
import { StorageCleanup } from './utilities/storageCleanup';

interface UtilitiesViewProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

export const UtilitiesView: React.FC<UtilitiesViewProps> = ({ currentTheme, onThemeChange }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'system'>('storage');
  
  const {
    syncEnabled,
    excludedFolders,
    folderInput,
    setFolderInput,
    purgeInput,
    setPurgeInput,
    purgeStatus,
    isResetting,
    systemStatus,
    confirmDialog,
    setConfirmDialog,
    handleToggleSync,
    handleAddFolder,
    handleRemoveFolder,
    handleBrowse,
    handlePurgeBrowse,
    handlePurgeFolder,
    handleResetLibrary,
    handleTriggerFaceSync
  } = useUtilities();

  return (
    <div className="p-4 sm:p-8 max-w-4xl space-y-8 flex flex-col h-full overflow-hidden select-none">
      <header className="reveal-item shrink-0">
        <h2 className="text-4xl font-serif italic text-white tracking-tight mb-2">System Utilities</h2>
        <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.2em]">Engine management & environment optimization</p>
      </header>

      {/* Premium Tab Switcher */}
      <div className="flex items-center gap-1.5 bg-[#111] p-1.5 rounded-2xl border border-white/5 shadow-inner shrink-0 max-w-md">
        <button 
          onClick={() => setActiveTab('storage')}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300
            ${activeTab === 'storage' 
              ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Trash2 size={14} />
          <span>Storage Cleanup</span>
        </button>

        <button 
          onClick={() => setActiveTab('system')}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300
            ${activeTab === 'system' 
              ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Settings2 size={14} />
          <span>Engine Settings</span>
        </button>
      </div>

      {/* Main Tab View Panels */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-8 custom-scrollbar pb-8">
        {activeTab === 'storage' ? (
          <StorageCleanup />
        ) : (
          <div className="space-y-8">
            <SyncSettings 
              syncEnabled={syncEnabled}
              onToggleSync={handleToggleSync}
              folderInput={folderInput}
              setFolderInput={setFolderInput}
              excludedFolders={excludedFolders}
              onBrowse={handleBrowse}
              onAddFolder={handleAddFolder}
              onRemoveFolder={handleRemoveFolder}
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

            <ThemeSettings 
              currentTheme={currentTheme}
              onThemeChange={onThemeChange}
            />

            <SystemIntegrity 
              isResetting={isResetting}
              onReset={handleResetLibrary}
              systemStatus={systemStatus}
            />
          </div>
        )}
      </div>

      <section className="reveal-item pt-4 opacity-20 hover:opacity-100 transition-opacity shrink-0">
         <div className="flex items-center justify-center gap-2 text-gray-500">
            <Cloud size={14} />
            <span className="text-[9px] font-mono uppercase tracking-[0.3em]">Prism Engine v0.4.2 // Protocol Active</span>
         </div>
      </section>

      <ConfirmationDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
