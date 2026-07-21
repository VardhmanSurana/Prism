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
    <section className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl space-y-6">
      {/* Top pill tag */}
      <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
        <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.04] rounded-full text-[9px] font-mono uppercase tracking-wider text-[#8a8f98]">
          Purge directories
        </span>
      </div>

      <div className="bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.08] rounded-2xl p-4 transition-all">
        <div className="mb-4">
          <p className="text-sm font-medium text-[#f7f8f8]">Remove from Library</p>
          <p className="text-xs text-[#8a8f98] mt-1 leading-relaxed">
            Permanently delete all indexed photos from a folder and their cached thumbnails. Original files remain on your disk.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex gap-1.5 bg-white/[0.01] border border-white/[0.06] focus-within:border-white/[0.15] focus-within:bg-white/[0.02] rounded-xl overflow-hidden transition-all duration-200">
            <input
              type="text"
              value={purgeInput}
              onChange={(e) => setPurgeInput(e.target.value)}
              placeholder="/home/user/Android/sdk"
              className="flex-1 bg-transparent px-4 py-2.5 text-xs text-[#d0d6e0] placeholder:text-gray-600 outline-none font-mono"
            />
            <button
              onClick={onBrowse}
              title="Browse for a folder to purge from the library"
              className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8a8f98] hover:text-white border-l border-white/[0.06] hover:bg-white/[0.02] transition-all"
            >
              Browse
            </button>
          </div>
          <button
            onClick={onPurge}
            disabled={!purgeInput}
            className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
          >
            Purge
          </button>
        </div>

        {purgeStatus && (
          <p className="text-xs text-red-400 mt-4 font-mono leading-relaxed bg-red-500/5 border border-red-500/10 px-4 py-3 rounded-xl">
            {purgeStatus}
          </p>
        )}
      </div>
    </section>
  );
};

