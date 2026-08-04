import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

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
  const [armed, setArmed] = useState(false);

  const handleArm = () => setArmed(true);
  const handleDisarm = () => setArmed(false);

  const handleExecute = () => {
    setArmed(false);
    onReset();
  };

  return (
    <div className="cr-card border-[var(--cr-status-error)]/40 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--cr-border)] pb-4">
        <div>
          <div className="cr-card-title text-[var(--cr-status-error)] flex items-center gap-2">
            <ShieldAlert size={14} />
            System Reset // Factory Purge
          </div>
          <p className="text-xs text-[var(--cr-text-muted)] mt-1">
            Completely purge database caches, clear metadata index files, and delete encrypted vaults. Irreversible action.
          </p>
        </div>
      </div>

      {/* Purge / Preserved grid */}
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

      {/* Two-step confirm action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        {!armed ? (
          <button
            onClick={handleArm}
            disabled={isResetting}
            className="cr-inline-btn text-[var(--cr-status-error)] border-[var(--cr-status-error)]/60 hover:bg-[var(--cr-status-error)]/10 font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Resetting...' : 'EXECUTE_PURGE'}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--cr-status-error)] uppercase tracking-wider">
              <AlertTriangle size={11} />
              Are you sure? This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDisarm}
                className="cr-inline-btn text-[var(--cr-text-muted)] border-[var(--cr-border)] hover:text-[var(--cr-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="cr-inline-btn text-white bg-[var(--cr-status-error)]/80 border-[var(--cr-status-error)] hover:bg-[var(--cr-status-error)] font-bold uppercase"
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {systemStatus && (
        <p className={`font-mono text-xs p-3 rounded border ${
          systemStatus.startsWith('✓')
            ? 'text-[var(--cr-accent)] bg-[var(--cr-accent-glow-strong)] border-[var(--cr-accent)]/30'
            : systemStatus.startsWith('✗')
            ? 'text-[var(--cr-status-error)] bg-[var(--cr-status-error)]/5 border-[var(--cr-status-error)]/30'
            : 'text-[var(--cr-text-secondary)] bg-[var(--cr-surface-sunken)] border-[var(--cr-border)]'
        }`}>
          {systemStatus}
        </p>
      )}
    </div>
  );
};
