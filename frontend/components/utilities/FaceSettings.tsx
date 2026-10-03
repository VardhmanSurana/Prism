import React from 'react';
import { ScanFace } from 'lucide-react';

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <h4 className="font-serif text-lg text-[#f5f0ed] mb-0.5">Manual People & Face Clustering Scan</h4>
          <p className="text-xs text-[#a8a29e]">
            Trigger a full-library face detection and clustering pass using InsightFace Inception ResNet and DBSCAN.
          </p>
        </div>
        <button 
          onClick={onTriggerSync}
          disabled={isRunning}
          className={`px-4 py-2 rounded-full font-mono text-xs font-semibold bg-[#e5e2e0] hover:bg-white text-[#151312] transition shadow-sm cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRunning ? 'Scanning Library...' : 'Discover & Cluster Faces'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Detection Engine', value: 'CenterFace / InsightFace' },
          { label: 'Vector Clustering', value: 'DBSCAN 512-dim' },
          { label: 'Privacy Isolation', value: '100% On-Device' },
        ].map((item) => (
          <div key={item.label} className="bg-[#1d1b1a] border border-white/5 rounded-xl p-3 text-center">
            <p className="font-mono text-[9px] uppercase tracking-wider text-[#78716c] mb-1">{item.label}</p>
            <p className="font-mono text-xs font-semibold text-[#f5f0ed]">{item.value}</p>
          </div>
        ))}
      </div>

      {status && status.includes('discovery') && (
        <div className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{status}</span>
        </div>
      )}
    </div>
  );
};
