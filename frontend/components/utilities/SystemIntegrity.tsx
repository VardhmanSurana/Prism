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
    <section className="bg-red-500/[0.01] border border-red-500/10 hover:border-red-500/20 rounded-3xl p-6 shadow-[0_0_30px_rgba(229,72,77,0.03)] transition-all relative space-y-6">
      {/* Top pill tag */}
      <div className="flex justify-between items-center border-b border-red-500/10 pb-4">
        <span className="px-2.5 py-1 bg-red-500/5 border border-red-500/10 rounded-full text-[9px] font-mono uppercase tracking-wider text-red-400">
          Destructive operations
        </span>
      </div>

      <div 
        onClick={!isResetting ? onReset : undefined}
        className={`group border border-red-500/20 rounded-2xl p-5 transition-all duration-200 ${
          isResetting 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:bg-red-500/[0.02] hover:border-red-500/35'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-lg">
            <p className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">System Reset</p>
            <p className="text-xs text-[#8a8f98] mt-1.5 leading-relaxed">
              Completely purge all app-generated caches, clear the photo library database, and remove encrypted Locked Folder files. This action is irreversible.
            </p>
          </div>
          {!isResetting && (
            <div className="shrink-0 px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 transition-all duration-150 active:scale-[0.98] shadow-[0_0_15px_rgba(229,72,77,0.25)]">
              Execute Purge
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-red-500/10 pt-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-3">
            What gets removed vs preserved
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-red-500/[0.02] border border-red-500/10 rounded-xl p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-red-400 font-semibold mb-2">Removed</p>
              <ul className="space-y-2">
                {[
                  'Photo records & metadata',
                  'Albums, people, face assignments',
                  'Thumbnail cache & masks',
                  'Video transcode & HLS cache',
                  'NLE preview & proxy cache',
                  'Video export files',
                  'Backend logs',
                  'Encrypted Locked Folder files'
                ].map((item, idx) => (
                  <li key={idx} className="text-[11px] text-[#8a8f98] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-2">Preserved</p>
              <ul className="space-y-2">
                {[
                  'Original photo files (never deleted)',
                  'Watched folder configuration',
                  'Locked Folder password & settings',
                  'Theme & sync preferences'
                ].map((item, idx) => (
                  <li key={idx} className="text-[11px] text-[#8a8f98] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {systemStatus && (
        <p className="text-xs text-[#8a8f98] mt-4 font-mono leading-relaxed bg-white/[0.02] border border-white/[0.05] px-4 py-3 rounded-xl">
          {systemStatus}
        </p>
      )}
    </section>
  );
};
