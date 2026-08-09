import React, { useState, useEffect } from 'react';
import { Switch } from '../ui';
import { getApiBase, setApiBase } from '../../constants';

interface SyncSettingsProps {
  syncEnabled: boolean;
  onToggleSync: () => void;
  
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

const FolderInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => void;
  onAdd: () => void;
  placeholder: string;
  disabled?: boolean;
}> = ({ value, onChange, onBrowse, onAdd, placeholder, disabled }) => (
  <div className="flex gap-2">
    <div className="flex-1 flex gap-1.5 bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] focus-within:border-[var(--cr-border-focus)] rounded overflow-hidden">
      <input 
        type="text" 
        id={placeholder ? `folder-input-${placeholder.replace(/[^a-zA-Z0-9]/g, '-')}` : 'folder-input'}
        name={placeholder ? `folderInput-${placeholder.replace(/[^a-zA-Z0-9]/g, '')}` : 'folderInput'}
        aria-label={placeholder ? `Folder path for ${placeholder}` : 'Folder path input'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] outline-none font-mono"
      />
      <button 
        onClick={onBrowse}
        className="px-3 py-2 text-xs font-mono font-medium text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] border-l border-[var(--cr-border)] hover:bg-[var(--cr-surface-card-hover)] transition-all"
      >
        Browse...
      </button>
    </div>
    <button 
      onClick={onAdd}
      disabled={disabled}
      className="cr-inline-btn primary"
    >
      Add Path
    </button>
  </div>
);

const FolderTag: React.FC<{ folder: string; onRemove: () => void }> = ({ folder, onRemove }) => (
  <div className="group flex items-center justify-between gap-3 bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] rounded px-3 py-2 hover:border-[var(--cr-accent)] transition-all">
    <span className="text-[11px] font-mono text-[var(--cr-text-secondary)] group-hover:text-[var(--cr-text-primary)] truncate">{folder}</span>
    <button 
      onClick={onRemove}
      className="shrink-0 text-[var(--cr-status-error)] hover:bg-[var(--cr-surface-card-hover)] px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold"
      title={`Remove ${folder}`}
    >
      Remove
    </button>
  </div>
);

export const SyncSettings: React.FC<SyncSettingsProps> = ({
  syncEnabled,
  onToggleSync,
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

  const handleSaveServerUrl = () => {
    const clean = serverUrl.trim().replace(/\/+$/, '');
    setApiBase(clean);
    testServerConnection(clean);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Prism Companion Server Connection Card */}
      <div className="cr-card">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <div className="cr-card-title">Prism Companion Server Connection</div>
            <p className="text-xs text-[var(--cr-text-muted)]">
              Specify the IP or hostname of your Dockerized Prism Companion Server or local backend.
            </p>
          </div>
          {status === 'testing' && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[var(--cr-surface-sunken)] text-[var(--cr-text-secondary)]">
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
          <div className="flex-1 flex gap-1.5 bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] focus-within:border-[var(--cr-border-focus)] rounded overflow-hidden">
            <span className="px-3 py-2 text-xs font-mono text-[var(--cr-text-muted)] select-none border-r border-[var(--cr-border)] bg-[var(--cr-surface-card)]">
              Server URL
            </span>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:8269 or http://192.168.1.100:8269"
              className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] outline-none font-mono"
            />
          </div>
          <button
            onClick={() => testServerConnection(serverUrl)}
            className="px-3 py-2 text-xs font-mono font-medium text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] border border-[var(--cr-border)] rounded hover:bg-[var(--cr-surface-card-hover)] transition-all"
          >
            Test Status
          </button>
          <button
            onClick={handleSaveServerUrl}
            className="cr-inline-btn primary"
          >
            Save & Connect
          </button>
        </div>
        <p className="text-[11px] font-mono text-[var(--cr-text-muted)] mt-2">
          Saved configuration persists across application launches. Zero environment variables required.
        </p>
      </div>
      {/* Auto sync toggle card */}
      <div className="cr-card">
        <div className="flex items-center justify-between gap-4">
          <div className="cr-toggle-info">
            <span className="cr-toggle-label">Automatic System File Watcher</span>
            <span className="cr-toggle-desc">Automatically index photo assets added to watched territories</span>
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

      {/* Watched folders card */}
      <div className="cr-card">
        <div className="cr-card-title">Watched Library Territories</div>
        <p className="text-xs text-[var(--cr-text-muted)] mb-3">Directories monitored by the background indexer engine.</p>
        
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
            <p className="text-[11px] text-[var(--cr-text-muted)] font-mono py-1">Defaulting to user Pictures directory</p>
          ) : (
            wFolders.map((folder, idx) => (
              <FolderTag key={idx} folder={folder} onRemove={() => removeW(folder)} />
            ))
          )}
        </div>
      </div>

      {/* Excluded folders card */}
      <div className="cr-card">
        <div className="cr-card-title">Excluded Territories</div>
        <p className="text-xs text-[var(--cr-text-muted)] mb-3">Paths ignored by the indexer engine.</p>
        
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
            <p className="text-[11px] text-[var(--cr-text-muted)] font-mono py-1">No exclusions defined</p>
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


