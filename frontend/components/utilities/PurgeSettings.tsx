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
    <section className="bg-[#0c0c0c] border border-[#23252a] rounded-3xl p-6">
      <div className="mb-5">
         <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
          Purge Folder Library
        </h3>
      </div>

      <div className="bg-[#050505] border border-[#23252a] rounded-2xl p-4">
        <div className="mb-4">
          <p className="text-sm font-medium text-[#f7f8f8]">Remove from Library</p>
          <p className="text-xs text-[#8a8f98] mt-1">Permanently delete all indexed photos from a folder and their cached thumbnails.</p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex gap-1.5 bg-[#0c0c0c] border border-[#23252a] rounded-lg overflow-hidden">
            <input
              type="text"
              value={purgeInput}
              onChange={(e) => setPurgeInput(e.target.value)}
              placeholder="/home/user/Android/sdk"
              className="flex-1 bg-transparent px-3 py-2 text-[11px] font-mono text-[#d0d6e0] placeholder:text-[#62666d] outline-none"
            />
            <button
              onClick={onBrowse}
              title="Browse for a folder to purge from the library"
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8a8f98] hover:text-[#d0d6e0] border-l border-[#23252a] transition-colors"
            >
              Browse
            </button>
          </div>
          <button
            onClick={onPurge}
            disabled={!purgeInput}
            className="px-4 py-2 bg-[#e5484d] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#dc3d42] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Purge
          </button>
        </div>

        {purgeStatus && (
          <p className="text-xs text-[#8a8f98] mt-3 font-mono">
            {purgeStatus}
          </p>
        )}
      </div>
    </section>
  );
};
