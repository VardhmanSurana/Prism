import React from 'react';
import { RefreshCw, FolderMinus, FolderPlus, Trash2, FolderOpen } from 'lucide-react';

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
    <section className="reveal-item space-y-6" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center gap-3 mb-2">
        <RefreshCw size={20} className="text-primary" />
        <h3 className="text-xl font-serif italic text-white">Auto Intelligence Sync</h3>
      </div>
      
      <div className="bg-surface border border-white/5 rounded-[2rem] p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-white font-medium">Automatic System Scan</p>
            <p className="text-xs text-gray-500">Automatically index all images from your watched folders, excluding hidden folders.</p>
          </div>
          <button 
            onClick={onToggleSync}
            className={`w-14 h-8 rounded-full transition-all duration-500 relative ${syncEnabled ? 'bg-primary' : 'bg-zinc-800'}`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-500 ${syncEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Watched Library Folders Section */}
        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p className="text-white font-medium">Watched Library Territories</p>
              <p className="text-xs text-gray-500">Specified directories containing photo assets that the background engine will index.</p>
            </div>
            
            <div className="flex items-end gap-3 mt-2">
              <div className="flex-1">
                <div className="flex items-center w-full">
                  <input 
                    type="text" 
                    value={wInput}
                    onChange={(e) => setWInput(e.target.value)}
                    placeholder="/home/user/Pictures"
                    className="flex-1 bg-transparent border-b border-gray-600/50 hover:border-gray-500 text-sm text-gray-300 py-2 px-1 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                  <button 
                    onClick={browseW}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold uppercase tracking-wider py-2 px-5 rounded-lg ml-4 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 active:scale-98"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <button 
                onClick={addW}
                disabled={!wInput}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider py-2 px-5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {wFolders.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-white/5 rounded-2xl">
                <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">Defaulting to user Pictures directory</p>
              </div>
            ) : (
              wFolders.map((folder, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/5 rounded-xl group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderPlus size={14} className="text-gray-500" />
                    <span className="text-[10px] font-mono text-gray-300 truncate">{folder}</span>
                  </div>
                  <button 
                    onClick={() => removeW(folder)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Excluded territories Section */}
        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p className="text-white font-medium">Excluded Territories</p>
              <p className="text-xs text-gray-500">Specified paths that will be ignored by the background indexer.</p>
            </div>
            
            <div className="flex items-end gap-3 mt-2">
              <div className="flex-1">
                <div className="flex items-center w-full">
                  <input 
                    type="text" 
                    value={eInput}
                    onChange={(e) => setEInput(e.target.value)}
                    placeholder="/home/user/Downloads"
                    className="flex-1 bg-transparent border-b border-gray-600/50 hover:border-gray-500 text-sm text-gray-300 py-2 px-1 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                  <button 
                    onClick={browseE}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold uppercase tracking-wider py-2 px-5 rounded-lg ml-4 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 active:scale-98"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <button 
                onClick={addE}
                disabled={!eInput}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider py-2 px-5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {eFolders.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-white/5 rounded-2xl">
                <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">No exclusions defined</p>
              </div>
            ) : (
              eFolders.map((folder, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/5 rounded-xl group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderMinus size={14} className="text-gray-500" />
                    <span className="text-[10px] font-mono text-gray-400 truncate">{folder}</span>
                  </div>
                  <button 
                    onClick={() => removeE(folder)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
