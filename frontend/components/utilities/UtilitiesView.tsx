import React, { useState, useEffect } from 'react';
import { useUtilities } from '../../hooks/utilities';
import { API_BASE } from '../../constants';
import { 
  HardDrive, 
  Cpu, 
  Shield, 
  Activity, 
  Palette,
  Folder,
  Users,
  Trash2,
  ShieldAlert,
  Menu,
  X
} from 'lucide-react';

import { SyncSettings } from './SyncSettings';
import { FaceSettings } from './FaceSettings';
import { AISettings } from './AISettings';
import { PurgeSettings } from './PurgeSettings';
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
];

export const UtilitiesView: React.FC<UtilitiesViewProps> = ({ onResetSuccess }) => {
  const [activeTab, setActiveTab] = useState<'engine' | 'storage' | 'privacy' | 'diagnostics'>('engine');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hostCacheSize, setHostCacheSize] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/utilities/diagnostics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.thumbnail_cache_size_bytes === 'number') {
          const bytes = data.thumbnail_cache_size_bytes;
          if (bytes === 0) {
            setHostCacheSize('0 B');
          } else {
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            setHostCacheSize(parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]);
          }
        }
      })
      .catch(() => {});
  }, []);
  
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
    <div className="flex flex-col md:flex-row h-full min-h-screen cr-container">
      {/* ═══════ MOBILE NAV HEADER (md:hidden) ═══════ */}
      <div className="md:hidden border-b border-[var(--cr-border)] bg-[var(--cr-surface-sidebar)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 
              className="text-base font-serif text-[var(--cr-text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--cr-font-display)' }}
            >
              System Utilities
            </h2>
            <p className="font-mono text-[9px] text-[var(--cr-text-muted)] uppercase tracking-wider">
              control room v2.1.0
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] focus:outline-none rounded border border-[var(--cr-border)] bg-[var(--cr-surface-card)]"
            aria-label={mobileMenuOpen ? "Collapse utilities menu" : "Expand utilities menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Scrollable Mobile Tabs */}
        <div className="overflow-x-auto custom-scrollbar">
          <nav className="flex items-center gap-1.5 min-w-max pb-1" role="tablist" aria-label="Mobile system utilities navigation">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`mobile-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono transition-colors 150ms ease, background-color 150ms ease, border-color 150ms ease min-h-[44px] ${
                    isActive
                      ? 'bg-[var(--cr-accent)]/10 text-[var(--cr-accent)] border border-[var(--cr-accent)]/30 font-bold'
                      : 'text-[var(--cr-text-muted)] hover:text-[var(--cr-text-primary)] border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ═══════ DESKTOP SIDEBAR (hidden on mobile, md:flex) ═══════ */}
      <aside className="hidden md:flex w-60 shrink-0 bg-[var(--cr-surface-sidebar)] border-r border-[var(--cr-border)] flex-col justify-between">
        <div>
          {/* Sidebar Header */}
          <div className="p-5 border-b border-[var(--cr-border)]">
            <h2 
              className="text-lg font-serif text-[var(--cr-text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--cr-font-display)' }}
            >
              System Utilities
            </h2>
            <p className="font-mono text-[10px] text-[var(--cr-text-muted)] tracking-wider mt-0.5">
              Control Room v2.1.0
            </p>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="p-2 space-y-1" role="tablist" aria-label="System utilities navigation">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cr-nav-item w-full text-left flex items-center gap-2.5 min-h-[44px] ${isActive ? 'active' : ''}`}
                >
                  <Icon size={14} className={isActive ? 'text-[var(--cr-accent)]' : 'text-[var(--cr-text-muted)]'} />
                  <span className="nav-label">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[var(--cr-border)] font-mono text-[10px] text-[var(--cr-text-muted)]">
          <span className="text-[var(--cr-accent)]">●</span> &nbsp;System Operational &nbsp;·&nbsp; PID 4821
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT AREA ═══════ */}
      <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Main Header */}
        <header className="px-4 py-4 md:px-7 md:py-5 border-b border-[var(--cr-border)] flex items-center justify-between shrink-0">
          <div className="flex items-baseline gap-3">
            <h1 
              className="text-lg md:text-xl font-serif text-[var(--cr-text-primary)]"
              style={{ fontFamily: 'var(--cr-font-display)' }}
            >
              {activeTabObj.displayLabel}
            </h1>
            <span className="font-mono text-[10px] font-semibold text-[var(--cr-accent)] bg-[var(--cr-accent-faint)] border border-[var(--cr-accent-dim)]/20 px-2 py-0.5 rounded">
              LIVE
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--cr-text-muted)] hidden sm:inline">
            Prism Engine v0.4.2
          </span>
        </header>

        {/* Main Content Body */}
        <div 
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="p-4 md:p-7 space-y-6 flex-1 outline-none"
        >
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
              <div className="cr-status-card-label">AI Engines</div>
              <div className="cr-status-card-row">
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value">On-device</span>
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
                <span className="cr-status-dot ok"></span>
                <span className="cr-status-card-value font-mono tabular-nums">{hostCacheSize || 'Loading...'}</span>
              </div>
            </div>
          </div>

          {/* Active Tab Views */}
          {activeTab === 'storage' && (
            <div className="space-y-8">
              <StorageCleanup />

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
            </div>
          )}

          {activeTab === 'privacy' && (
            <PrivacyDashboard />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsLogs />
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



