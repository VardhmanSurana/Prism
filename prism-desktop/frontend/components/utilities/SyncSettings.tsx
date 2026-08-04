import React from 'react';
import { Switch } from '../ui';

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

  return (
    <div className="space-y-4">
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


