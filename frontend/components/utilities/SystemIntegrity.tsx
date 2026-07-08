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
    <section className="bg-[#0c0c0c] border border-[#e5484d]/20 rounded-xl p-6">
      <div className="mb-5">
        <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
          Core Integrity
        </h3>
      </div>
      
      <div 
        onClick={!isResetting ? onReset : undefined}
        className={`group border border-[#e5484d]/30 rounded-xl p-5 transition-all duration-200 ${
          isResetting 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:bg-[#e5484d]/5 hover:border-[#e5484d]/40'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[#f7f8f8]">System Reset</p>
            <p className="text-xs text-[#8a8f98] mt-1.5 leading-relaxed max-w-lg">
              Completely purge all app-generated caches, clear the photo library database, and remove encrypted Locked Folder files. This action is irreversible.
            </p>
          </div>
          {!isResetting && (
            <div className="shrink-0 ml-4 px-3 py-1.5 bg-[#e5484d] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider group-hover:bg-[#dc3d42] transition-colors">
              Execute Purge
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-[#e5484d]/10 pt-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#62666d] mb-3">
            What gets removed vs preserved
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#e5484d]/5 border border-[#e5484d]/10 rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#e5484d] mb-2">Removed</p>
              <ul className="space-y-1.5">
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Photo records & metadata
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Albums, people, face assignments
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Thumbnail cache & masks
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Video transcode & HLS cache
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  NLE preview & proxy cache
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Video export files
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Backend logs
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#e5484d]/50" />
                  Encrypted Locked Folder files
                </li>
              </ul>
            </div>
            <div className="bg-[#27a644]/5 border border-[#27a644]/10 rounded-lg p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#27a644] mb-2">Preserved</p>
              <ul className="space-y-1.5">
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#27a644]/50" />
                  Original photo files (never deleted)
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#27a644]/50" />
                  Watched folder configuration
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#27a644]/50" />
                  Locked Folder password & settings
                </li>
                <li className="text-xs text-[#8a8f98] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[#27a644]/50" />
                  Theme & sync preferences
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {systemStatus && (
        <p className="text-xs text-[#8a8f98] mt-4 font-mono">
          {systemStatus}
        </p>
      )}
    </section>
  );
};
