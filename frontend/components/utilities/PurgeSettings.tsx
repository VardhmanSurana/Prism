import React from 'react';
import { Trash2, FolderSearch } from 'lucide-react';

interface PurgeSettingsProps {
  purgeInput: string;
  setPurgeInput: (v: string) => void;
  purgeStatus: string | null;
  onBrowse: () => void;
  onPurge: () => void;
}

/**
 * Purge settings: remove folder records from database while preserving master files on disk.
 */
export const PurgeSettings: React.FC<PurgeSettingsProps> = ({
  purgeInput,
  setPurgeInput,
  purgeStatus,
  onBrowse,
  onPurge
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-serif text-lg text-[#f5f0ed] mb-0.5">Remove Monitored Directory from Library</h4>
        <p className="text-xs text-[#a8a29e]">
          Permanently purge indexed photo records and cached thumbnails of a directory from the database. Original source files remain completely untouched on disk.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex bg-[#100e0d] border border-white/10 rounded-xl overflow-hidden focus-within:border-white/20">
          <input
            type="text"
            id="purge-folder-input"
            name="purgeFolderInput"
            aria-label="Territory path to purge"
            value={purgeInput}
            onChange={(e) => setPurgeInput(e.target.value)}
            placeholder="/Volumes/Storage/FolderToPurge"
            className="flex-1 bg-transparent px-3.5 py-2 text-xs text-[#f5f0ed] placeholder:text-[#78716c] outline-none font-mono"
          />
          <button
            onClick={onBrowse}
            title="Browse for a folder to purge"
            className="px-3.5 py-2 text-xs font-mono text-[#a8a29e] hover:text-[#f5f0ed] border-l border-white/10 hover:bg-white/5 transition cursor-pointer"
          >
            Browse...
          </button>
        </div>
        <button
          onClick={onPurge}
          disabled={!purgeInput}
          className="px-4 py-2 rounded-xl font-mono text-xs font-semibold bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Purge Directory Records
        </button>
      </div>

      {purgeStatus && (
        <p className="text-xs text-rose-400 font-mono bg-[#100e0d] border border-rose-500/20 p-3 rounded-xl">
          {purgeStatus}
        </p>
      )}
    </div>
  );
};
