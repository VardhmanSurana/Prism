import React, { useState, useEffect } from 'react';
import { Switch } from '../ui';
import { getApiBase, setApiBase } from '../../constants';
import { WatcherStatus as WatcherStatusData } from '../../hooks/utilities/useSyncConfig';

interface SyncSettingsProps {
  syncEnabled: boolean;
  onToggleSync: () => void;

  /** Live watcher engine status (polled by useSyncConfig). */
  watcherStatus?: WatcherStatusData | null;
  /** True after Rescan Now is clicked until a scan starts. */
  isRescanQueued?: boolean;
  onRescanNow?: () => void;

  watchedFolders?: string[];
  watchedInput?: string;
  setWatchedInput?: (v: string) => void;
  onBrowseWatched?: () => void;
  onAddWatchedFolder?: () => void;
  onRemoveWatchedFolder?: (folder: string) => void;

  excludedFolders: string[];
  excludedInput?: string;
  setExcludedInput?: (v: string) => void;
  onBrowseExcluded?: () => void;
  onAddExcludedFolder?: () => void;
  onRemoveExcludedFolder?: (folder: string) => void;
  
  // Backward compatibility props
  folderInput?: string;
  setFolderInput?: (v: string) => void;
  onBrowse?: () => void;
  onAddFolder?: () => void;
  onRemoveFolder?: (folder: string) => void;
}

/** Small controlled input with browse/add for folder paths. */
const FolderInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => void;
  onAdd: () => void;
  placeholder: string;
  disabled?: boolean;
}> = ({ value, onChange, onBrowse, onAdd, placeholder, disabled }) => (
  <div className="flex gap-2">
    <div className="flex-1 flex gap-1.5 bg-[#100e0d] border border-[rgba(255,255,255,0.06)] focus-within:border-[rgba(255,255,255,0.2)] rounded overflow-hidden">
      <input 
        type="text" 
        id={placeholder ? `folder-input-${placeholder.replace(/[^a-zA-Z0-9]/g, '-')}` : 'folder-input'}
        name={placeholder ? `folderInput-${placeholder.replace(/[^a-zA-Z0-9]/g, '')}` : 'folderInput'}
        aria-label={placeholder ? `Folder path for ${placeholder}` : 'Folder path input'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-2 text-xs text-[#f5f0ed] placeholder:text-[#78716c] outline-none font-mono"
      />
      <button 
        onClick={onBrowse}
        className="px-3 py-2 text-xs font-mono font-medium text-[#a8a29e] hover:text-[#f5f0ed] border-l border-[rgba(255,255,255,0.06)] hover:bg-white/5 transition-all"
      >
        Browse...
      </button>
    </div>
    <button 
      onClick={onAdd}
      disabled={disabled}
      className="px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition shadow-sm"
    >
      Add Path
    </button>
  </div>
);

/** Removable tag chip for a watched/excluded folder. */
const FolderTag: React.FC<{ folder: string; onRemove: () => void }> = ({ folder, onRemove }) => (
  <div className="group flex items-center justify-between gap-3 bg-[#100e0d] border border-[rgba(255,255,255,0.06)] rounded px-3 py-2 hover:border-[#e5a93c] transition-all">
    <span className="text-[11px] font-mono text-[#a8a29e] group-hover:text-[#f5f0ed] truncate">{folder}</span>
    <button 
      onClick={onRemove}
      className="shrink-0 text-[#f87171] hover:bg-white/5 px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold"
      title={`Remove ${folder}`}
    >
      Remove
    </button>
  </div>
);

/**
 * Sync and folder watch settings: watched/excluded folders and companion server URL.
 */
export const SyncSettings: React.FC<SyncSettingsProps> = ({
  syncEnabled,
  onToggleSync,
  watcherStatus,
  isRescanQueued,
  onRescanNow,
  watchedFolders,
  watchedInput,
  setWatchedInput,
  onBrowseWatched,
  onAddWatchedFolder,
  onRemoveWatchedFolder,
  excludedFolders,
  excludedInput,
  setExcludedInput,
  onBrowseExcluded,
  onAddExcludedFolder,
  onRemoveExcludedFolder,
  folderInput,
  setFolderInput,
  onBrowse,
  onAddFolder,
  onRemoveFolder
}) => {
  const wFolders = watchedFolders || [];
  const wInput = watchedInput || '';
  const setWInput = setWatchedInput || (() => {});
  const browseW = onBrowseWatched || (() => {});
  const addW = onAddWatchedFolder || (() => {});
  const removeW = onRemoveWatchedFolder || (() => {});

  const eFolders = excludedFolders || [];
  const eInput = excludedInput || folderInput || '';
  const setEInput = setExcludedInput || setFolderInput || (() => {});
  const browseE = onBrowseExcluded || onBrowse || (() => {});
  const addE = onAddExcludedFolder || onAddFolder || (() => {});
  const removeE = onRemoveExcludedFolder || onRemoveFolder || (() => {});

  const [serverUrl, setServerUrl] = useState<string>(getApiBase());
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    // Perform initial quick check
    testServerConnection(getApiBase());
  }, []);

  /**
   * Tests connectivity to the companion server health endpoint.
   * @param url - Server base URL.
   */
  const testServerConnection = async (url: string) => {
    setStatus('testing');
    setStatusMsg('Checking server health...');
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/health`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        setStatus('connected');
        setStatusMsg(`Online (${data.service || 'prism-server'} v${data.version || '0.1.0'})`);
      } else {
        setStatus('error');
        setStatusMsg(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(`Unable to connect (${err.message || 'Network error'})`);
    }
  };

  /** Saves the sanitized server URL to persistent settings. */
  const handleSaveServerUrl = () => {
    const clean = serverUrl.trim().replace(/\/+$/, '');
    setApiBase(clean);
    testServerConnection(clean);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Prism Companion Server Connection Card */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title">Prism Companion Server Connection</div>
            <p className="text-xs text-[#78716c]">
              Specify the IP or hostname of your Dockerized Prism Companion Server or local backend.
            </p>
          </div>
          {status === 'testing' && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#100e0d] text-[#a8a29e]">
              ⏳ Testing...
            </span>
          )}
          {status === 'connected' && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {statusMsg}
            </span>
          )}
          {status === 'error' && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30">
              ⚠️ {statusMsg}
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <div className="flex-1 flex gap-1.5 bg-[#100e0d] border border-[rgba(255,255,255,0.06)] focus-within:border-[rgba(255,255,255,0.2)] rounded overflow-hidden">
            <span className="px-3 py-2 text-xs font-mono text-[#78716c] select-none border-r border-[rgba(255,255,255,0.06)] bg-[#211f1e]">
              Server URL
            </span>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:8269 or http://192.168.1.100:8269"
              className="flex-1 bg-transparent px-3 py-2 text-xs text-[#f5f0ed] placeholder:text-[#78716c] outline-none font-mono"
            />
          </div>
          <button
            onClick={() => testServerConnection(serverUrl)}
            className="px-3 py-2 text-xs font-mono font-medium text-[#a8a29e] hover:text-[#f5f0ed] border border-[rgba(255,255,255,0.06)] rounded hover:bg-white/5 transition-all"
          >
            Test Status
          </button>
          <button
            onClick={handleSaveServerUrl}
            className="px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition shadow-sm"
          >
            Save & Connect
          </button>
        </div>
        <p className="text-[11px] font-mono text-[#78716c] mt-2">
          Saved configuration persists across application launches. Zero environment variables required.
        </p>
      </div>
      {/* Auto sync toggle card */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#f5f0ed]">Automatic System File Watcher</span>
            <span className="text-[11px] text-[#78716c]">Automatically index photo assets added to watched territories</span>
          </div>
          <div className="shrink-0">
            <Switch
              label=""
              checked={syncEnabled}
              onToggle={onToggleSync}
              ariaLabel="Toggle automatic system file watcher"
            />
          </div>
        </div>
      </div>

      {/* Watcher engine status card */}
      <WatcherStatusCard
        status={watcherStatus}
        isRescanQueued={isRescanQueued}
        onRescanNow={onRescanNow}
      />

      {/* Watched folders card */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title">Watched Library Territories</div>
        <p className="text-xs text-[#78716c] mb-3">Directories monitored by the background indexer engine.</p>
        
        <FolderInput
          value={wInput}
          onChange={setWInput}
          onBrowse={browseW}
          onAdd={addW}
          placeholder="~/Pictures"
          disabled={!wInput}
        />

        <div className="mt-3 space-y-1.5">
          {wFolders.length === 0 ? (
            <p className="text-[11px] text-[#78716c] font-mono py-1">Defaulting to user Pictures directory</p>
          ) : (
            wFolders.map((folder, idx) => (
              <FolderTag key={idx} folder={folder} onRemove={() => removeW(folder)} />
            ))
          )}
        </div>
      </div>

      {/* Excluded folders card */}
      <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm">
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title">Excluded Territories</div>
        <p className="text-xs text-[#78716c] mb-3">Paths ignored by the indexer engine.</p>
        
        <FolderInput
          value={eInput}
          onChange={setEInput}
          onBrowse={browseE}
          onAdd={addE}
          placeholder="~/Downloads"
          disabled={!eInput}
        />

        <div className="mt-3 space-y-1.5">
          {eFolders.length === 0 ? (
            <p className="text-[11px] text-[#78716c] font-mono py-1">No exclusions defined</p>
          ) : (
            eFolders.map((folder, idx) => (
              <FolderTag key={idx} folder={folder} onRemove={() => removeE(folder)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/** Formats an epoch-ms timestamp as a short relative time ("2m ago"). */
function formatRelative(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Live status of the watch-folder indexer: scan state, last scan outcome,
 * lifetime import total, and a manual "Rescan Now" trigger.
 */
export const WatcherStatusCard: React.FC<{
  status?: WatcherStatusData | null;
  isRescanQueued?: boolean;
  onRescanNow?: () => void;
}> = ({ status, isRescanQueued, onRescanNow }) => {
  const scanning = status?.is_scanning ?? false;
  const busy = scanning || !!isRescanQueued;

  return (
    <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm" data-testid="watcher-status-card">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title">Indexer Status</div>
        <button
          type="button"
          onClick={onRescanNow}
          disabled={!onRescanNow || busy}
          title="Scan all watched folders for new media immediately"
          aria-label="Rescan watched folders now"
          className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition font-mono text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scanning ? 'Scanning…' : isRescanQueued ? 'Queued…' : 'Rescan Now'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        {scanning ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true"></span>
            Scanning watched folders…
          </span>
        ) : isRescanQueued ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#100e0d] text-[#a8a29e] border border-[rgba(255,255,255,0.06)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78716c]" aria-hidden="true"></span>
            Rescan queued…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true"></span>
            Idle — monitoring for changes
          </span>
        )}

        <span className="text-[#78716c]">
          Last scan: {formatRelative(status?.last_scan_finished_ms ?? 0)}
        </span>

        {(status?.last_scan_imported ?? 0) > 0 && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            +{status?.last_scan_imported} imported
          </span>
        )}
        {(status?.last_scan_skipped ?? 0) > 0 && (
          <span className="text-[#78716c]">{status?.last_scan_skipped} skipped</span>
        )}
        {(status?.last_scan_failed ?? 0) > 0 && (
          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
            {status?.last_scan_failed} failed
          </span>
        )}
        {status?.last_scan_manual && (status?.last_scan_finished_ms ?? 0) > 0 && (
          <span className="text-[#78716c]">(manual)</span>
        )}
      </div>

      <p className="text-[11px] font-mono text-[#78716c] mt-2">
        Total imported by watcher: {status?.total_imported ?? 0}
      </p>
    </div>
  );
};


