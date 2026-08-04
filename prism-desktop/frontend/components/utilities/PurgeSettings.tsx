import React from 'react';

interface PurgeSettingsProps {
  purgeInput: string;
  setPurgeInput: (v: string) => void;
  purgeStatus: string | null;
  onBrowse: () => void;
  onPurge: () => void;
}

export const PurgeSettings: React.FC<PurgeSettingsProps> = ({
  purgeInput,
  setPurgeInput,
  purgeStatus,
  onBrowse,
  onPurge
}) => {
  return (
    <div className="cr-card">
      <div className="cr-card-title mb-1">Remove Territory from Library</div>
      <p className="text-xs text-[var(--cr-text-muted)] mb-3">
        Permanently purge indexed photo records and cached thumbnails of a folder from database. Original source files remain untouched on disk.
      </p>

      <div className="flex gap-2">
        <div className="flex-1 flex gap-1.5 bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] focus-within:border-[var(--cr-border-focus)] rounded overflow-hidden">
          <input
            type="text"
            id="purge-folder-input"
            name="purgeFolderInput"
            aria-label="Territory path to purge"
            value={purgeInput}
            onChange={(e) => setPurgeInput(e.target.value)}
            placeholder="~/Pictures/FolderToPurge"
            className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-muted)] outline-none font-mono"
          />
          <button
            onClick={onBrowse}
            title="Browse for a folder to purge"
            className="px-3 py-2 text-xs font-mono font-medium text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] border-l border-[var(--cr-border)] hover:bg-[var(--cr-surface-card-hover)] transition-all"
          >
            Browse...
          </button>
        </div>
        <button
          onClick={onPurge}
          disabled={!purgeInput}
          className="cr-inline-btn font-mono text-xs font-semibold text-[var(--cr-status-error)] border-[var(--cr-status-error)]/40 hover:bg-[var(--cr-status-error)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Purge Territory
        </button>
      </div>

      {purgeStatus && (
        <p className="text-xs text-[var(--cr-status-error)] mt-3 font-mono bg-[var(--cr-surface-sunken)] border border-[var(--cr-status-error)]/30 p-3 rounded">
          {purgeStatus}
        </p>
      )}
    </div>
  );
};


