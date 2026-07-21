import React from 'react';

interface FaceSettingsProps {
  onTriggerSync: () => void;
  status: string | null;
}

export const FaceSettings: React.FC<FaceSettingsProps> = ({ onTriggerSync, status }) => {
  const isRunning = status?.includes('discovery') || status?.includes('Initiating');
  
  return (
    <section className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl space-y-6">
      {/* Top pill tag */}
      <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
        <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.04] rounded-full text-[9px] font-mono uppercase tracking-wider text-[#8a8f98]">
          Centerface clustering engine
        </span>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.08] rounded-2xl p-4 transition-all gap-4">
          <div className="max-w-md">
            <p className="text-sm font-medium text-[#f7f8f8]">Manual Scan</p>
            <p className="text-xs text-[#8a8f98] mt-1 leading-relaxed">
              Triggers a full-library scan for faces using CenterFace. This will group detected faces into the People tab in your albums.
            </p>
          </div>
          <button 
            onClick={onTriggerSync}
            disabled={isRunning}
            className={`shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-[0.98] ${
              isRunning
                ? 'bg-white/[0.02] text-gray-500 border border-white/[0.06] cursor-not-allowed'
                : 'bg-[#5e6ad2] text-white hover:bg-[#828fff] shadow-[0_0_15px_rgba(94,106,210,0.3)]'
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
            <div key={item.label} className="bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-3 text-center transition-all duration-200 select-none">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-gray-500 mb-1">{item.label}</p>
              <p className="text-xs text-[#d0d6e0] font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        {status && status.includes('discovery') && (
          <div className="bg-[#5e6ad2]/5 border border-[#5e6ad2]/15 rounded-xl px-4 py-3">
            <p className="text-xs text-[#828fff] font-mono leading-relaxed">{status}</p>
          </div>
        )}
      </div>
    </section>
  );
};

