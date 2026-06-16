import React from 'react';
import { FolderMinus } from 'lucide-react';

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
    <section className="reveal-item space-y-6" style={{ animationDelay: '0.15s' }}>
      <div className="flex items-center gap-3 mb-2">
        <FolderMinus size={20} className="text-rose-400" />
        <h3 className="text-xl font-serif italic text-white">Purge Folder Library</h3>
      </div>

      <div className="bg-surface border border-white/5 rounded-[2rem] p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-white font-medium">Remove from Library</p>
          <p className="text-xs text-gray-500">Permanently delete all indexed photos from a folder and their cached thumbnails.</p>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="flex items-center w-full">
              <input
                type="text"
                value={purgeInput}
                onChange={(e) => setPurgeInput(e.target.value)}
                placeholder="/home/user/Android/sdk"
                className="flex-1 bg-transparent border-b border-gray-600/50 hover:border-gray-500 text-sm text-gray-300 py-2 px-1 focus:outline-none focus:border-rose-500 transition-colors font-mono"
              />
              <button
                onClick={onBrowse}
                title="Browse for a folder to purge from the library"
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium py-2 px-6 rounded-[4px] ml-4 transition-colors"
              >
                Browse
              </button>
            </div>
          </div>
          <button
            onClick={onPurge}
            disabled={!purgeInput}
            className="bg-rose-600/80 hover:bg-rose-600 text-white text-sm font-medium py-2 px-6 rounded-[4px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Purge
          </button>
        </div>

        {purgeStatus && (
          <p className={`text-xs font-mono tracking-wider animate-in fade-in ${purgeStatus.startsWith('✓') ? 'text-emerald-400' : purgeStatus === 'Purging...' ? 'text-gray-400' : 'text-rose-400'}`}>
            {purgeStatus}
          </p>
        )}
      </div>
    </section>
  );
};
