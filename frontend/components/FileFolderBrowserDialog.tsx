import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderOpen, 
  FileImage, 
  File, 
  ArrowUp, 
  X, 
  Search, 
  ChevronRight, 
  Home, 
  Check, 
  Square, 
  CheckSquare, 
  Info,
  Loader2
} from 'lucide-react';
import { API_BASE, resolveUrl } from '../constants';
import { registerBrowserCallback, unregisterBrowserCallback, BrowseOptions } from '../services/FileFolderBrowserService';

interface FileEntry {
  name: string;
  path: string;
  is_hidden: boolean;
  size_bytes?: number;
  is_image?: boolean;
}

interface FolderEntry {
  name: string;
  path: string;
  is_hidden: boolean;
}

export const FileFolderBrowserDialog: React.FC = () => {
  const [options, setOptions] = useState<BrowseOptions | null>(null);
  
  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isRoot, setIsRoot] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Control States
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  
  // Preview & Resizer States
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [imgLoading, setImgLoading] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [resizeWidth, setResizeWidth] = useState<number | undefined>(undefined);
  
  // Helpers
  const [homePath, setHomePath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Register with Global Service
  useEffect(() => {
    registerBrowserCallback((opts) => {
      setOptions(opts);
      setSelectedPaths(new Set());
      setPreviewFile(null);
      setResizeWidth(undefined);
      setSearchQuery('');
      // Reset path or initialize to home
      setCurrentPath('');
      fetchDirectory('', showHidden);
    });

    return () => {
      unregisterBrowserCallback();
    };
  }, [showHidden]);

  // Fetch folders and files from backend
  const fetchDirectory = async (path: string, showHiddenFiles: boolean) => {
    setIsLoading(true);
    setError(null);
    setPreviewFile(null);
    setDimensions(null);
    setImgLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/list-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path || null, show_hidden: showHiddenFiles })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentPath(data.current_path);
        setParentPath(data.parent_path);
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setIsRoot(data.is_root);
        
        // Dynamically capture user's home directory if not set
        if (!homePath && data.current_path && !data.is_root) {
          const parts = data.current_path.split('/');
          if (parts.length >= 3 && parts[1] === 'home') {
            setHomePath('/' + parts[1] + '/' + parts[2]);
          } else {
            setHomePath(data.current_path);
          }
        }
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to list directory contents');
      }
    } catch (err) {
      console.error('Error listing directory:', err);
      setError('Connection to backend failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger folder refresh when toggling show hidden
  const handleToggleHidden = () => {
    const nextHidden = !showHidden;
    setShowHidden(nextHidden);
    fetchDirectory(currentPath, nextHidden);
  };

  if (!options) return null;

  const handleCancel = () => {
    options.resolve(null);
    setOptions(null);
  };

  const handleConfirm = () => {
    let finalPaths: string[] = [];
    if (options.multiple) {
      if (selectedPaths.size > 0) {
        finalPaths = Array.from(selectedPaths);
      } else {
        // Fallback: If multiple selection but none selected, use current directory (only for directory picker)
        if (options.directoryOnly) {
          finalPaths = [currentPath];
        }
      }
    } else {
      // Single selection
      if (selectedPaths.size > 0) {
        finalPaths = [Array.from(selectedPaths)[0]];
      } else {
        // Fallback to current folder for folder selector
        if (options.directoryOnly) {
          finalPaths = [currentPath];
        }
      }
    }
    
    if (finalPaths.length > 0) {
      options.resolve({ paths: finalPaths, resizeWidth });
    } else {
      options.resolve(null);
    }
    setOptions(null);
  };

  // Selection handlers
  const handleItemSelect = (path: string, isFolder: boolean, fileObj?: FileEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // In file picker mode, folders are only double-clicked/clicked to navigate, not selected
    if (!options.directoryOnly && isFolder) {
      fetchDirectory(path, showHidden);
      setSearchQuery('');
      return;
    }

    const nextSelected = new Set(selectedPaths);
    if (options.multiple) {
      if (nextSelected.has(path)) {
        nextSelected.delete(path);
        // Clear preview if this file was deselected
        if (previewFile?.path === path) {
          setPreviewFile(null);
          setDimensions(null);
        }
      } else {
        nextSelected.add(path);
        if (fileObj && fileObj.is_image) {
          setImgLoading(true);
          setPreviewFile(fileObj);
        }
      }
    } else {
      nextSelected.clear();
      nextSelected.add(path);
      if (fileObj && fileObj.is_image) {
        setImgLoading(true);
        setPreviewFile(fileObj);
      }
    }
    setSelectedPaths(nextSelected);
  };

  // Double click to navigate into folder
  const handleFolderDoubleClick = (path: string) => {
    fetchDirectory(path, showHidden);
    setSelectedPaths(new Set());
    setSearchQuery('');
  };

  // Navigating up
  const handleGoUp = () => {
    if (parentPath !== null) {
      fetchDirectory(parentPath, showHidden);
      setSelectedPaths(new Set());
      setSearchQuery('');
    }
  };

  // Quick shortcut selection
  const handleShortcutClick = (path: string) => {
    fetchDirectory(path, showHidden);
    setSelectedPaths(new Set());
    setSearchQuery('');
  };

  // Formatting file size
  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Parse path breadcrumbs
  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [];
    let accum = '';
    for (let i = 0; i < parts.length; i++) {
      accum += '/' + parts[i];
      breadcrumbs.push({
        name: parts[i],
        path: accum
      });
    }
    return breadcrumbs;
  };

  // Local filtering
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Allowed shortcuts
  const shortcutList = [];
  if (homePath) {
    shortcutList.push({ name: 'Home', path: homePath });
    shortcutList.push({ name: 'Pictures', path: homePath + '/Pictures' });
    shortcutList.push({ name: 'Downloads', path: homePath + '/Downloads' });
  }

  // Generate local preview URL
  const getPreviewUrl = () => {
    if (!previewFile) return '';
    return resolveUrl('local://' + previewFile.path);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className={`relative w-full bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px] select-none transition-all duration-300
            ${previewFile ? 'max-w-4xl' : 'max-w-xl'}`}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-white/95 uppercase tracking-wider">
              {options.title || (options.directoryOnly ? 'Browse for folder' : 'Browse image files')}
            </h3>
            <button
              onClick={handleCancel}
              className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Breadcrumbs Row */}
          <div className="px-4 py-2 bg-[#080808] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs text-white/60 shrink-0 select-none">
            <button
              onClick={() => handleShortcutClick('')}
              className="hover:text-white flex items-center gap-1 shrink-0 transition-colors"
              title="Allowed Roots"
            >
              <Home size={13} />
              <span>/</span>
            </button>
            
            {getBreadcrumbs().map((b, idx) => (
              <React.Fragment key={b.path}>
                <span className="text-white/20">/</span>
                <button
                  onClick={() => fetchDirectory(b.path, showHidden)}
                  className="hover:text-white truncate max-w-[120px] transition-colors"
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Shortcuts & Search Area */}
          <div className="p-3 border-b border-white/5 space-y-2 shrink-0 bg-[#0c0c0c]">
            {shortcutList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-gray-500 font-mono uppercase mr-1">Quick:</span>
                {shortcutList.map(s => (
                  <button
                    key={s.name}
                    onClick={() => handleShortcutClick(s.path)}
                    className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Filter Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-white/40">
                <Search size={14} />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={options.directoryOnly ? "Filter folders in current view..." : "Filter folders and images..."}
                className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder-white/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center text-white/40 hover:text-white/80"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Main Content Layout with Split Pane when preview active */}
          <div className="flex-1 flex overflow-hidden bg-[#050505]">
            
            {/* List Column */}
            <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar p-2 transition-all duration-300
              ${previewFile ? 'w-3/5 border-r border-white/5' : 'w-full'}`}
            >
              {isLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2 py-12">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <span className="text-xs font-mono">Scanning directory...</span>
                </div>
              ) : error ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-6 text-center gap-2 py-12">
                  <Info size={24} className="stroke-[1.5]" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Access Error</span>
                  <span className="text-xs text-white/50 max-w-xs">{error}</span>
                  <button
                    onClick={() => handleShortcutClick('')}
                    className="mt-3 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl"
                  >
                    Return to Allowed Roots
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {/* Parent Directory Link */}
                  {!isRoot && parentPath !== null && (
                    <div
                      onClick={handleGoUp}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white text-xs cursor-pointer transition-all border border-transparent"
                    >
                      <ArrowUp size={14} className="text-primary/70 shrink-0" />
                      <span className="font-semibold">.. (Parent directory)</span>
                    </div>
                  )}

                  {/* Empty State */}
                  {filteredFolders.length === 0 && (options.directoryOnly || filteredFiles.length === 0) && (
                    <div className="py-12 text-center text-white/30 text-xs font-mono">
                      No folders {!options.directoryOnly && 'or supported image files'} found.
                    </div>
                  )}

                  {/* Folders List */}
                  {filteredFolders.map(f => {
                    const isSelected = selectedPaths.has(f.path);
                    return (
                      <div
                        key={f.path}
                        onClick={(e) => handleItemSelect(f.path, true, undefined, e)}
                        onDoubleClick={() => handleFolderDoubleClick(f.path)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border
                          ${isSelected 
                            ? 'bg-primary/10 border-primary/20 text-primary shadow-[inset_0_0_10px_rgba(var(--color-primary),0.05)]' 
                            : 'bg-transparent border-transparent text-white/80 hover:bg-white/5 hover:text-white'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Selector indicator for folder picker */}
                          {options.directoryOnly && (
                            <span className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors">
                              {options.multiple ? (
                                isSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />
                              ) : (
                                <span className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center
                                  ${isSelected ? 'border-primary' : ''}`}>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </span>
                              )}
                            </span>
                          )}
                          
                          <Folder size={14} className={`shrink-0 ${isSelected ? 'text-primary' : 'text-amber-500/70 group-hover:text-amber-400'}`} />
                          <span className="truncate pr-4">{f.name}</span>
                        </div>
                        
                        {/* Chevron Navigation Button on the right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFolderDoubleClick(f.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all"
                          title="Enter Folder"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Files List */}
                  {!options.directoryOnly && filteredFiles.map(file => {
                    const isSelected = selectedPaths.has(file.path);
                    const isPreviewed = previewFile?.path === file.path;
                    return (
                      <div
                        key={file.path}
                        onClick={(e) => handleItemSelect(file.path, false, file, e)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border
                          ${isSelected 
                            ? 'bg-primary/10 border-primary/20 text-primary shadow-[inset_0_0_10px_rgba(var(--color-primary),0.05)]' 
                            : isPreviewed
                              ? 'bg-white/5 border-white/10 text-white'
                              : 'bg-transparent border-transparent text-white/80 hover:bg-white/5 hover:text-white'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors">
                            {options.multiple ? (
                              isSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />
                            ) : (
                              <span className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center
                                ${isSelected ? 'border-primary' : ''}`}>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </span>
                            )}
                          </span>
                          
                          {file.is_image ? (
                            <FileImage size={14} className={`shrink-0 ${isSelected ? 'text-primary' : 'text-blue-400/70'}`} />
                          ) : (
                            <File size={14} className="shrink-0 text-white/40" />
                          )}
                          <span className="truncate pr-4">{file.name}</span>
                        </div>
                        
                        <span className="text-[10px] font-mono text-white/30 group-hover:text-white/50 shrink-0">
                          {formatSize(file.size_bytes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Preview & Resizer Panel */}
            {previewFile && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '40%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex flex-col h-full bg-[#0c0c0c] border-l border-white/5 p-4 overflow-y-auto custom-scrollbar shrink-0 select-none"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">File Preview</h4>
                  <button 
                    onClick={() => { setPreviewFile(null); setDimensions(null); }}
                    className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Image Box */}
                <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                  {imgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary/70" size={16} />
                    </div>
                  )}
                  <img
                    src={getPreviewUrl()}
                    alt={previewFile.name}
                    onLoad={(e) => {
                      setImgLoading(false);
                      const img = e.currentTarget;
                      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                  />
                </div>

                {/* Filename caption */}
                <div className="mt-3 text-xs text-white/90 font-medium truncate text-center border-b border-white/5 pb-3" title={previewFile.name}>
                  {previewFile.name}
                </div>

                {/* Resizer Section */}
                <div className="mt-4 space-y-2.5">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Import Resizer Option</h5>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Original', value: undefined },
                      { label: '1920px (FHD)', value: 1920 },
                      { label: '1280px (HD)', value: 1280 },
                      { label: '800px (Mobile)', value: 800 }
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setResizeWidth(opt.value)}
                        className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer text-center
                          ${resizeWidth === opt.value
                            ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-white/30 leading-relaxed mt-1">
                    Resize reduces files larger than target width on ingestion, freeing device storage. Mutated copies go to library; originals are untouched.
                  </p>
                </div>

              </motion.div>
            )}

          </div>

          {/* Footer controls & action buttons */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-[#080808] shrink-0 select-none">
            {/* Show hidden checkbox */}
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase text-white/40 hover:text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={handleToggleHidden}
                className="rounded border-white/10 bg-transparent text-primary focus:ring-0 w-3 h-3"
              />
              <span>Show hidden</span>
            </label>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white/70 hover:text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-4 py-1.5 bg-primary text-black hover:bg-primary/95 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {options.directoryOnly 
                  ? (selectedPaths.size > 0 ? 'Use selected folder' : 'Use this folder') 
                  : (selectedPaths.size > 0 ? `Use selected (${selectedPaths.size})` : 'Use current')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
