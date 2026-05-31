import React from 'react';
import { RefreshCw, FolderMinus, Trash2 } from 'lucide-react';

interface SyncSettingsProps {
  syncEnabled: boolean;
  onToggleSync: () => void;
  folderInput: string;
  setFolderInput: (v: string) => void;
  excludedFolders: string[];
  onBrowse: () => void;
  onAddFolder: () => void;
  onRemoveFolder: (folder: string) => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({
  syncEnabled,
  onToggleSync,
  folderInput,
  setFolderInput,
  excludedFolders,
  onBrowse,
  onAddFolder,
  onRemoveFolder
}) => {
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
            <p className="text-xs text-gray-500">Automatically index all images from your home directory, excluding hidden folders.</p>
          </div>
          <button 
            onClick={onToggleSync}
            className={`w-14 h-8 rounded-full transition-all duration-500 relative ${syncEnabled ? 'bg-primary' : 'bg-zinc-800'}`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-500 ${syncEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p className="text-white font-medium">Excluded Territories</p>
              <p className="text-xs text-gray-500">Specified paths will be ignored by the background indexer.</p>
            </div>
            
            <div className="flex items-end gap-3 mt-2">
              <div className="flex-1">
                <div className="flex items-center w-full">
                  <input 
                    type="text" 
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                    placeholder="/home/user/Downloads"
                    className="flex-1 bg-transparent border-b border-gray-600/50 hover:border-gray-500 text-sm text-gray-300 py-2 px-1 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                  <button 
                    onClick={onBrowse}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium py-2 px-6 rounded-[4px] ml-4 transition-colors"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <button 
                onClick={onAddFolder}
                disabled={!folderInput}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 px-6 rounded-[4px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {excludedFolders.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">No exclusions defined</p>
              </div>
            ) : (
              excludedFolders.map((folder, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderMinus size={14} className="text-gray-600" />
                    <span className="text-[10px] font-mono text-gray-400 truncate">{folder}</span>
                  </div>
                  <button 
                    onClick={() => onRemoveFolder(folder)}
                    className="p-2 text-gray-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
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
