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
  { id: 'engine' as const, label: 'Engine Configuration', displayLabel: 'Engine Configuration', icon: Cpu },
  { id: 'storage' as const, label: 'Storage Cleanup', displayLabel: 'Storage Cleanup', icon: HardDrive },
  { id: 'diagnostics' as const, label: 'Diagnostics', displayLabel: 'System Diagnostics', icon: Activity },
  { id: 'privacy' as const, label: 'Privacy Audit', displayLabel: 'Privacy Audit', icon: Shield },
  { id: 'appearance' as const, label: 'Appearance', displayLabel: 'Appearance', icon: Palette },
];

export const UtilitiesView: React.FC<UtilitiesViewProps> = ({ onResetSuccess }) => {
  const [activeTab, setActiveTab] = useState<'engine' | 'storage' | 'privacy' | 'diagnostics' | 'appearance'>('engine');
  
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

  const activeTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <div className="flex h-full min-h-screen cr-container select-none">
      {/* ═══════ LEFT SIDEBAR ═══════ */}
      <aside className="w-60 shrink-0 bg-[var(--cr-surface-sidebar)] border-r border-[var(--cr-border)] flex flex-col justify-between">
        <div>
          {/* Sidebar Header */}
          <div className="p-5 border-b border-[var(--cr-border)]">
            <h2 
              className="text-lg font-serif text-[var(--cr-text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--cr-font-display)' }}
            >
              System Utilities
            </h2>
            <p className="font-mono text-[10px] text-[var(--cr-text-muted)] uppercase tracking-wider mt-0.5">
              control room v2.1.0
            </p>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="p-2 space-y-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cr-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="cr-nav-prompt">&gt;</span>
                  <span className="nav-label">{tab.label}</span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[var(--cr-border)] font-mono text-[10px] text-[var(--cr-text-muted)]">
          <span className="text-[var(--cr-accent)]">●</span> &nbsp;System operational &nbsp;·&nbsp; PID 4821
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT AREA ═══════ */}
      <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Main Header */}
        <header className="px-7 py-5 border-b border-[var(--cr-border)] flex items-center justify-between shrink-0">
          <div className="flex items-baseline gap-3">
            <h1 
              className="text-xl font-serif text-[var(--cr-text-primary)]"
              style={{ fontFamily: 'var(--cr-font-display)' }}
            >
              {activeTabObj.displayLabel}
            </h1>
            <span className="font-mono text-[10px] font-semibold text-[var(--cr-accent)] bg-[var(--cr-accent-faint)] border border-[var(--cr-accent-dim)]/20 px-2 py-0.5 rounded">
              LIVE
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--cr-text-muted)]">
            Prism Engine v0.4.2 // Protocol Active
          </span>
        </header>

        {/* Main Content Body */}
        <div className="p-7 space-y-6 flex-1">
          {/* Bento Status Grid */}
          <div className="cr-status-grid">
            <div className="cr-status-card">
              <div className="cr-status-card-label">Backend</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value">Running</span>
              </div>
            </div>
            <div className="cr-status-card">
              <div className="cr-status-card-label">Python ML</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value">Connected</span>
              </div>
            </div>
            <div className="cr-status-card">
              <div className="cr-status-card-label">Database</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value">Healthy</span>
              </div>
            </div>
            <div className="cr-status-card">
              <div className="cr-status-card-label">Search Index</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value">Loaded</span>
              </div>
            </div>
            <div className="cr-status-card">
              <div className="cr-status-card-label">Host Cache</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot warn"></span>
                <span className="cr-status-card-value">82% Full</span>
              </div>
            </div>
          </div>

          {/* Active Tab Views */}
          {activeTab === 'storage' && (
            <StorageCleanup />
          )}

          {activeTab === 'engine' && (
            <div className="space-y-8">
              {/* AI Core Settings */}
              <div>
                <AISettings />
              </div>

              {/* Sync Settings */}
              <div className="pt-6 border-t border-[var(--cr-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={15} className="text-[var(--cr-secondary)]" />
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--cr-text-secondary)] font-medium">
                    Territory Sync
                  </h4>
                </div>
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

              {/* Face Discovery */}
              <div className="pt-6 border-t border-[var(--cr-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={15} className="text-[var(--cr-secondary)]" />
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--cr-text-secondary)] font-medium">
                    People Recognition
                  </h4>
                </div>
                <FaceSettings 
                  onTriggerSync={handleTriggerFaceSync}
                  status={systemStatus}
                />
              </div>

              {/* Purge Territory */}
              <div className="pt-6 border-t border-[var(--cr-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 size={15} className="text-[var(--cr-status-error)]" />
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--cr-text-secondary)] font-medium">
                    Cleanse Territories
                  </h4>
                </div>
                <PurgeSettings 
                  purgeInput={purgeInput}
                  setPurgeInput={setPurgeInput}
                  purgeStatus={purgeStatus}
                  onBrowse={handlePurgeBrowse}
                  onPurge={handlePurgeFolder}
                />
              </div>

              {/* Danger Zone */}
              <div className="pt-6 border-t border-[var(--cr-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={15} className="text-[var(--cr-status-error)]" />
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--cr-text-secondary)] font-medium">
                    Danger Zone
                  </h4>
                </div>
                <SystemIntegrity 
                  isResetting={isResetting}
                  onReset={handleResetLibrary}
                  systemStatus={systemStatus}
                />
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
        </div>
      </main>

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



