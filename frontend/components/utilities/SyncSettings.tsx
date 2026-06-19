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
    <div className="flex-1 flex gap-1.5 bg-[#050505] border border-[#23252a] rounded-lg overflow-hidden">
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-[#d0d6e0] placeholder:text-[#62666d] outline-none font-mono text-[11px]"
      />
      <button 
        onClick={onBrowse}
        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8a8f98] hover:text-[#d0d6e0] border-l border-[#23252a] transition-colors"
      >
        Browse
      </button>
    </div>
    <button 
      onClick={onAdd}
      disabled={disabled}
      className="px-4 py-2 bg-[#5e6ad2] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#828fff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      Add
    </button>
  </div>
);

const FolderTag: React.FC<{ folder: string; onRemove: () => void }> = ({ folder, onRemove }) => (
  <div className="group flex items-center justify-between gap-3 bg-[#050505] border border-[#23252a] rounded-lg px-3 py-2 hover:border-[#34343a] transition-colors">
    <span className="text-[11px] font-mono text-[#8a8f98] truncate">{folder}</span>
    <button 
      onClick={onRemove}
      className="shrink-0 text-[#62666d] hover:text-[#e5484d] transition-colors text-sm"
      title={`Remove ${folder}`}
    >
      ×
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
    <section className="bg-[#0c0c0c] border border-[#23252a] rounded-xl p-6">
      <div className="mb-6">
        <h3 className="font-serif italic text-[#f7f8f8] text-lg leading-tight">
          Auto Intelligence Sync
        </h3>
      </div>
      
      <div className="space-y-6">
        {/* Auto sync toggle */}
        <div className="flex items-center justify-between bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-[#f7f8f8]">Automatic System Scan</p>
            <p className="text-xs text-[#8a8f98] mt-1">Automatically index all images from your watched folders, excluding hidden folders.</p>
          </div>
          <button 
            onClick={onToggleSync}
            title={syncEnabled ? 'Disable automatic sync' : 'Enable automatic sync'}
            className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 ${
              syncEnabled ? 'bg-[#5e6ad2]' : 'bg-[#1c1d1f]'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              syncEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Watched folders */}
        <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-[#f7f8f8]">Watched Library Territories</p>
            </div>
            <p className="text-xs text-[#8a8f98]">Specified directories containing photo assets that the background engine will index.</p>
          </div>
          
          <FolderInput
            value={wInput}
            onChange={setWInput}
            onBrowse={browseW}
            onAdd={addW}
            placeholder="/home/user/Pictures"
            disabled={!wInput}
          />

          <div className="mt-3 space-y-1.5">
            {wFolders.length === 0 ? (
              <p className="text-[11px] text-[#62666d] font-mono py-2">Defaulting to user Pictures directory</p>
            ) : (
              wFolders.map((folder, idx) => (
                <FolderTag key={idx} folder={folder} onRemove={() => removeW(folder)} />
              ))
            )}
          </div>
        </div>

        {/* Excluded folders */}
        <div className="bg-[#050505] border border-[#23252a] rounded-xl p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-[#f7f8f8]">Excluded Territories</p>
            </div>
            <p className="text-xs text-[#8a8f98]">Specified paths that will be ignored by the background indexer.</p>
          </div>
          
          <FolderInput
            value={eInput}
            onChange={setEInput}
            onBrowse={browseE}
            onAdd={addE}
            placeholder="/home/user/Downloads"
            disabled={!eInput}
          />

          <div className="mt-3 space-y-1.5">
            {eFolders.length === 0 ? (
              <p className="text-[11px] text-[#62666d] font-mono py-2">No exclusions defined</p>
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
