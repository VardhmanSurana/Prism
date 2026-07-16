import React from 'react';

interface FaceSettingsProps {
  onTriggerSync: () => void;
  status: string | null;
}

export const FaceSettings: React.FC<FaceSettingsProps> = ({ onTriggerSync, status }) => {
  const isRunning = status?.includes('discovery') || status?.includes('Initiating');
  
  return (
    <section className="bg-[#0c0c0c] border border-[#23252a] rounded-3xl p-6">
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
            People Discovery
          </h3>
          <span className="px-2 py-0.5 bg-[#141516] border border-[#23252a] rounded-full text-[9px] font-mono uppercase tracking-wider text-[#8a8f98]">
            GPU Optimized
          </span>
        </div>
        <p className="text-xs text-[#8a8f98] mt-1.5">
          Local facial recognition & clustering
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex items-start justify-between bg-[#050505] border border-[#23252a] rounded-2xl p-4">
          <div className="max-w-md">
            <p className="text-sm font-medium text-[#f7f8f8]">Manual Scan</p>
            <p className="text-xs text-[#8a8f98] mt-1 leading-relaxed">
              Triggers a full-library scan for faces using CenterFace. This will group detected faces into the People tab in your albums.
            </p>
          </div>
          <button 
            onClick={onTriggerSync}
            disabled={isRunning}
            className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
              isRunning
                ? 'bg-[#141516] text-[#62666d] border border-[#23252a] cursor-not-allowed'
                : 'bg-[#5e6ad2] text-white hover:bg-[#828fff]'
            }`}
          >
            {isRunning ? 'Scanning...' : 'Discover People'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Engine', value: 'CenterFace ONNX' },
            { label: 'Clustering', value: 'DBSCAN Vector' },
            { label: 'Privacy', value: '100% Offline' },
          ].map((item) => (
            <div key={item.label} className="bg-[#050505] border border-[#23252a] rounded-2xl p-3 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-1">{item.label}</p>
              <p className="text-xs text-[#d0d6e0]">{item.value}</p>
            </div>
          ))}
        </div>

        {status && status.includes('discovery') && (
          <div className="bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 rounded-xl px-4 py-3">
            <p className="text-xs text-[#5e6ad2] font-mono">{status}</p>
          </div>
        )}
      </div>
    </section>
  );
};
