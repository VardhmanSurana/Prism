import React from 'react';

interface SyncSettingsProps {
  syncEnabled: boolean;
  onToggleSync: () => void;
  
  watchedFolders?: string[];
  watchedInput?: string;
  setWatchedInput?: (v: string) => void;
  onBrowseWatched?: () => void;
  onAddWatchedFolder?: () => void;
  onRemoveWatchedFolder?: (folder: string) => void;

  excludedFolders: string[];
  excludedInput?: string;
  setExcludedInput?: (v: string) => void;
  onBrowseExcluded?: () => void;
  onAddExcludedFolder?: () => void;
  onRemoveExcludedFolder?: (folder: string) => void;
  
  // Backward compatibility props
  folderInput?: string;
  setFolderInput?: (v: string) => void;
  onBrowse?: () => void;
  onAddFolder?: () => void;
  onRemoveFolder?: (folder: string) => void;
}

const FolderInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => void;
  onAdd: () => void;
  placeholder: string;
  disabled?: boolean;
}> = ({ value, onChange, onBrowse, onAdd, placeholder, disabled }) => (
  <div className="flex gap-2">
    <div className="flex-1 flex gap-1.5 bg-white/[0.01] border border-white/[0.06] focus-within:border-white/[0.15] focus-within:bg-white/[0.02] rounded-xl overflow-hidden transition-all duration-200">
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-4 py-2.5 text-xs text-[#d0d6e0] placeholder:text-gray-600 outline-none font-mono"
      />
      <button 
        onClick={onBrowse}
        className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8a8f98] hover:text-white border-l border-white/[0.06] hover:bg-white/[0.02] transition-all"
      >
        Browse
      </button>
    </div>
    <button 
      onClick={onAdd}
      disabled={disabled}
      className="px-5 py-2.5 bg-[#5e6ad2] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#828fff] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
    >
      Add
    </button>
  </div>
);

const FolderTag: React.FC<{ folder: string; onRemove: () => void }> = ({ folder, onRemove }) => (
  <div className="group flex items-center justify-between gap-3 bg-white/[0.01] border border-white/[0.05] rounded-xl px-4 py-2.5 hover:border-white/[0.1] hover:bg-white/[0.02] transition-all duration-200">
    <span className="text-[11px] font-mono text-[#8a8f98] group-hover:text-gray-300 truncate transition-colors">{folder}</span>
    <button 
      onClick={onRemove}
      className="shrink-0 text-gray-600 hover:text-red-400 hover:bg-white/[0.05] px-2 py-0.5 rounded-md transition-all font-mono text-xs"
      title={`Remove ${folder}`}
    >
      remove
    </button>
  </div>
);

export const SyncSettings: React.FC<SyncSettingsProps> = ({
  syncEnabled,
  onToggleSync,
  watchedFolders,
  watchedInput,
  setWatchedInput,
  onBrowseWatched,
  onAddWatchedFolder,
  onRemoveWatchedFolder,
  excludedFolders,
  excludedInput,
  setExcludedInput,
  onBrowseExcluded,
  onAddExcludedFolder,
  onRemoveExcludedFolder,
  folderInput,
  setFolderInput,
  onBrowse,
  onAddFolder,
  onRemoveFolder
}) => {
  const wFolders = watchedFolders || [];
  const wInput = watchedInput || '';
  const setWInput = setWatchedInput || (() => {});
  const browseW = onBrowseWatched || (() => {});
  const addW = onAddWatchedFolder || (() => {});
  const removeW = onRemoveWatchedFolder || (() => {});

  const eFolders = excludedFolders || [];
  const eInput = excludedInput || folderInput || '';
  const setEInput = setExcludedInput || setFolderInput || (() => {});
  const browseE = onBrowseExcluded || onBrowse || (() => {});
  const addE = onAddExcludedFolder || onAddFolder || (() => {});
  const removeE = onRemoveExcludedFolder || onRemoveFolder || (() => {});

  return (
    <section className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 shadow-xl space-y-6">
      {/* Top Tag line */}
      <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
        <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.04] rounded-full text-[9px] font-mono uppercase tracking-wider text-[#8a8f98]">
          Automatic Daemon Scan
        </span>
      </div>
      
      <div className="space-y-6">
        {/* Auto sync toggle */}
        <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.08] rounded-2xl p-4 transition-all">
          <div>
            <p className="text-sm font-medium text-[#f7f8f8]">Automatic System Scan</p>
            <p className="text-xs text-[#8a8f98] mt-1">Automatically index all images from your watched folders, excluding hidden folders.</p>
          </div>
          <button 
            onClick={onToggleSync}
            title={syncEnabled ? 'Disable automatic sync' : 'Enable automatic sync'}
            className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 ${
              syncEnabled ? 'bg-[#5e6ad2]' : 'bg-white/[0.08] border border-white/[0.02]'
            }`}
          >
            <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
              syncEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Watched folders */}
        <div className="bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.08] rounded-2xl p-4 transition-all">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-[#f7f8f8]">Watched Library Territories</h4>
            <p className="text-xs text-[#8a8f98] mt-1">Specified directories containing photo assets that the background engine will index.</p>
          </div>
          
          <FolderInput
            value={wInput}
            onChange={setWInput}
            onBrowse={browseW}
            onAdd={addW}
            placeholder="/home/user/Pictures"
            disabled={!wInput}
          />

          <div className="mt-4 space-y-2">
            {wFolders.length === 0 ? (
              <p className="text-[11px] text-gray-500 font-mono py-1">Defaulting to user Pictures directory</p>
            ) : (
              wFolders.map((folder, idx) => (
                <FolderTag key={idx} folder={folder} onRemove={() => removeW(folder)} />
              ))
            )}
          </div>
        </div>

        {/* Excluded folders */}
        <div className="bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.08] rounded-2xl p-4 transition-all">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-[#f7f8f8]">Excluded Territories</h4>
            <p className="text-xs text-[#8a8f98] mt-1">Specified paths that will be ignored by the background indexer.</p>
          </div>
          
          <FolderInput
            value={eInput}
            onChange={setEInput}
            onBrowse={browseE}
            onAdd={addE}
            placeholder="/home/user/Downloads"
            disabled={!eInput}
          />

          <div className="mt-4 space-y-2">
            {eFolders.length === 0 ? (
              <p className="text-[11px] text-gray-500 font-mono py-1">No exclusions defined</p>
            ) : (
              eFolders.map((folder, idx) => (
                <FolderTag key={idx} folder={folder} onRemove={() => removeE(folder)} />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

