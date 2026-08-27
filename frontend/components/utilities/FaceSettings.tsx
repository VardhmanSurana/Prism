import React from 'react';

interface FaceSettingsProps {
  onTriggerSync: () => void;
  status: string | null;
}

/**
 * Face recognition settings: shows discovery status and triggers sync.
 */
export const FaceSettings: React.FC<FaceSettingsProps> = ({ onTriggerSync, status }) => {
  const isRunning = status?.includes('discovery') || status?.includes('Initiating');
  
  return (
    <div className="cr-card space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[var(--cr-border)]">
        <div>
          <div className="cr-card-title mb-1">Manual People Scan</div>
          <p className="text-xs text-[var(--cr-text-muted)]">
            Trigger a full-library face detection and clustering pass using CenterFace and DBSCAN.
          </p>
        </div>
        <button 
          onClick={onTriggerSync}
          disabled={isRunning}
          className={`cr-inline-btn primary shrink-0 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRunning ? 'SCANNING...' : 'DISCOVER_PEOPLE'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Engine', value: 'CenterFace ONNX' },
          { label: 'Clustering', value: 'DBSCAN Vector' },
          { label: 'Privacy', value: '100% Offline' },
        ].map((item) => (
          <div key={item.label} className="bg-[var(--cr-surface-sunken)] border border-[var(--cr-border)] rounded p-3 text-center">
            <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--cr-text-muted)] mb-1">{item.label}</p>
            <p className="font-mono text-xs font-semibold text-[var(--cr-text-primary)]">{item.value}</p>
          </div>
        ))}
      </div>

      {status && status.includes('discovery') && (
        <div className="font-mono text-xs text-[var(--cr-accent)] bg-[var(--cr-accent-glow-strong)] border border-[var(--cr-accent-dim)]/30 p-3 rounded">
          {status}
        </div>
      )}
    </div>
  );
};


