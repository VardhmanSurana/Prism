import React from 'react';

interface SystemIntegrityProps {
  isResetting: boolean;
  onReset: () => void;
  systemStatus: string | null;
}

export const SystemIntegrity: React.FC<SystemIntegrityProps> = ({
  isResetting,
  onReset,
  systemStatus
}) => {
  return (
    <div className="cr-card border-[var(--cr-status-error)]/40 hover:border-[var(--cr-status-error)] space-y-4">
      <div 
        onClick={!isResetting ? onReset : undefined}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--cr-border)] pb-4 ${
          isResetting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'
        }`}
      >
        <div>
          <div className="cr-card-title text-[var(--cr-status-error)] group-hover:underline">
            System Reset // Factory Purge
          </div>
          <p className="text-xs text-[var(--cr-text-muted)]">
            Completely purge database caches, clear metadata index files, and delete encrypted vaults. Irreversible action.
          </p>
        </div>

        {!isResetting && (
          <button className="cr-inline-btn text-[var(--cr-status-error)] border-[var(--cr-status-error)]/60 hover:bg-[var(--cr-status-error)]/20 shrink-0 font-bold uppercase">
            EXECUTE_PURGE
          </button>
        )}
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase text-[var(--cr-text-muted)] tracking-wider mb-2">
          Scope of purge vs preserved data
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[var(--cr-surface-sunken)] border border-[var(--cr-status-error)]/20 rounded p-3">
            <p className="font-mono text-[10px] uppercase font-bold text-[var(--cr-status-error)] mb-2">[ PURGED ]</p>
            <ul className="space-y-1 font-mono text-[11px] text-[var(--cr-text-muted)]">
              {[
                'Photo records & metadata',
                'Albums & face assignments',
                'Thumbnail & mask cache',
                'Video transcode & proxies',
                'Backend log files',
                'Encrypted vault files'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="text-[var(--cr-status-error)]">×</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[var(--cr-surface-sunken)] border border-[var(--cr-accent)]/20 rounded p-3">
            <p className="font-mono text-[10px] uppercase font-bold text-[var(--cr-accent)] mb-2">[ PRESERVED ]</p>
            <ul className="space-y-1 font-mono text-[11px] text-[var(--cr-text-muted)]">
              {[
                'Original photo files',
                'Watched folder paths',
                'Locked folder passwords',
                'Theme & UI preferences'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="text-[var(--cr-accent)]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {systemStatus && (
        <p className="font-mono text-xs text-[var(--cr-text-secondary)] bg-[var(--cr-surface-sunken)] p-3 rounded border border-[var(--cr-border)]">
          {systemStatus}
        </p>
      )}
    </div>
  );
};

