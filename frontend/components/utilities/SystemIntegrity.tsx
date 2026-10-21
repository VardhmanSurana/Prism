import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface SystemIntegrityProps {
  isResetting: boolean;
  onReset: () => void;
  systemStatus: string | null;
}

/**
 * System integrity panel: arm/disarm and execute integrity checks.
 */
export const SystemIntegrity: React.FC<SystemIntegrityProps> = ({
  isResetting,
  onReset,
  systemStatus
}) => {
  const [armed, setArmed] = useState(false);

  /** Arms the destructive integrity action. */
  const handleArm = () => setArmed(true);
  /** Disarms the integrity action. */
  const handleDisarm = () => setArmed(false);

  /** Executes the armed integrity operation. */
  const handleExecute = () => {
    setArmed(false);
    onReset();
  };

  return (
    <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm border-[#f87171]/40 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div>
          <div className="bg-[#211f1e] border border-white/5 p-5 rounded-2xl shadow-sm-title text-[#f87171] flex items-center gap-2">
            <ShieldAlert size={14} />
            System Reset // Factory Purge
          </div>
          <p className="text-xs text-[#78716c] mt-1">
            Completely purge database caches, clear metadata index files, and delete encrypted vaults. Irreversible action.
          </p>
        </div>
      </div>

      {/* Purge / Preserved grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#100e0d] border border-[#f87171]/20 rounded p-3">
          <p className="font-mono text-[10px] uppercase font-bold text-[#f87171] mb-2">[ PURGED ]</p>
          <ul className="space-y-1 font-mono text-[11px] text-[#78716c]">
            {[
              'Photo records & metadata',
              'Albums & face assignments',
              'Thumbnail & mask cache',
              'Video transcode & proxies',
              'Backend log files',
              'Encrypted vault files'
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="text-[#f87171]">×</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#100e0d] border border-[#e5a93c]/20 rounded p-3">
          <p className="font-mono text-[10px] uppercase font-bold text-[#e5a93c] mb-2">[ PRESERVED ]</p>
          <ul className="space-y-1 font-mono text-[11px] text-[#78716c]">
            {[
              'Original photo files',
              'Watched folder paths',
              'Locked folder passwords',
              'Theme & UI preferences'
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="text-[#e5a93c]">✓</span>
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
            className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition text-[#f87171] border-[#f87171]/60 hover:bg-[#f87171]/10 font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Resetting...' : 'EXECUTE_PURGE'}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#f87171] uppercase tracking-wider">
              <AlertTriangle size={11} />
              Are you sure? This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDisarm}
                className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition"
                style={{ color: '#78716c' }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="px-3.5 py-1.5 rounded-full font-mono text-xs bg-[#2c2928] hover:bg-[#373433] text-[#f5f0ed] border border-white/10 transition font-bold uppercase"
                style={{
                  background: '#f87171',
                  borderColor: '#f87171',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
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
            ? 'text-[#e5a93c] bg-[rgba(229,169,60,0.15)] border-[#e5a93c]/30'
            : systemStatus.startsWith('✗')
            ? 'text-[#f87171] bg-[#f87171]/5 border-[#f87171]/30'
            : 'text-[#a8a29e] bg-[#100e0d] border-[rgba(255,255,255,0.06)]'
        }`}>
          {systemStatus}
        </p>
      )}
    </div>
  );
};
