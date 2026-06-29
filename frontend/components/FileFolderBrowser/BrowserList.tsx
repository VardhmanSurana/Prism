import React from 'react';
import { FileEntry, FolderEntry } from './types';

interface BrowserListProps {
  folders: FolderEntry[];
  files: FileEntry[];
  isLoading: boolean;
  error: string | null;
  isRoot: boolean;
  parentPath: string | null;
  selectedPaths: Set<string>;
  previewFile: FileEntry | null;
  directoryOnly?: boolean;
  multiple?: boolean;
  searchQuery: string;
  onGoUp: () => void;
  onFolderDoubleClick: (path: string) => void;
  onItemSelect: (path: string, isFolder: boolean, fileObj?: FileEntry) => void;
  onRetry: () => void;
}

export const BrowserList: React.FC<BrowserListProps> = ({
  folders,
  files,
  isLoading,
  error,
  isRoot,
  parentPath,
  selectedPaths,
  previewFile,
  directoryOnly,
  multiple,
  searchQuery,
  onGoUp,
  onFolderDoubleClick,
  onItemSelect,
  onRetry,
}) => {
  const isDirectoryOnly = directoryOnly ?? false;
  const isMultiple = multiple ?? false;

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.is_image && f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2 py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Scanning directory...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-6 text-center gap-2 py-12">
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-red-400 text-lg">!</span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider">Access Error</span>
        <span className="text-xs text-white/50 max-w-xs">{error}</span>
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl"
        >
          Return to Allowed Roots
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {!isRoot && parentPath !== null && (
        <div
          onClick={onGoUp}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white text-xs cursor-pointer transition-all border border-transparent"
        >
          <span className="text-primary/70">↑</span>
          <span className="font-semibold">.. (Parent directory)</span>
        </div>
      )}

      {filteredFolders.length === 0 && (isDirectoryOnly || filteredFiles.length === 0) && (
        <div className="py-12 text-center text-white/30 text-xs font-mono">
          No folders {!isDirectoryOnly && 'or supported image files'} found.
        </div>
      )}

      {filteredFolders.map(f => {
        const isSelected = selectedPaths.has(f.path);
        return (
          <div
            key={f.path}
            onClick={() => onItemSelect(f.path, true)}
            onDoubleClick={() => onFolderDoubleClick(f.path)}
            className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border
              ${isSelected 
                ? 'bg-primary/10 border-primary/20 text-primary shadow-[inset_0_0_10px_rgba(var(--color-primary),0.05)]' 
                : 'bg-transparent border-transparent text-white/80 hover:bg-white/5 hover:text-white'}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isDirectoryOnly && (
                <span className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors">
                  {multiple ? (
                    isSelected ? (
                      <span className="text-primary">☑</span>
                    ) : (
                      <span className="text-white/30">☐</span>
                    )
                  ) : (
                    <span className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center
                      ${isSelected ? 'border-primary' : ''}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </span>
                  )}
                </span>
              )}
              
              <span className={`shrink-0 ${isSelected ? 'text-primary' : 'text-amber-500/70 group-hover:text-amber-400'}`}>📁</span>
              <span className="truncate pr-4">{f.name}</span>
            </div>
          </div>
        );
      })}

      {!isDirectoryOnly && filteredFiles.map(file => {
        const isSelected = selectedPaths.has(file.path);
        const isPreviewed = previewFile?.path === file.path;
        return (
          <div
            key={file.path}
            onClick={() => onItemSelect(file.path, false, file)}
            className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border
              ${isSelected 
                ? 'bg-primary/10 border-primary/20 text-primary shadow-[inset_0_0_10px_rgba(var(--color-primary),0.05)]' 
                : isPreviewed
                  ? 'bg-white/5 border-white/10 text-white'
                  : 'bg-transparent border-transparent text-white/80 hover:bg-white/5 hover:text-white'}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors">
                {isMultiple ? (
                  isSelected ? (
                    <span className="text-primary">☑</span>
                  ) : (
                    <span className="text-white/30">☐</span>
                  )
                ) : (
                  <span className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center
                    ${isSelected ? 'border-primary' : ''}`}>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </span>
                )}
              </span>
              
              <span className={`shrink-0 ${isSelected ? 'text-primary' : file.is_video ? 'text-green-400/70' : 'text-blue-400/70'}`}>{file.is_video ? '🎬' : '🖼️'}</span>
              <span className="truncate pr-4">{file.name}</span>
            </div>
            
            <span className="text-[10px] font-mono text-white/30 group-hover:text-white/50 shrink-0">
              {file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};