import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../../constants';
import { BrowseOptions } from '../../services/FileFolderBrowserService';
import { FileEntry, FolderEntry } from './types';

interface BrowserState {
  options: BrowseOptions | null;
  currentPath: string;
  parentPath: string | null;
  folders: FolderEntry[];
  files: FileEntry[];
  isRoot: boolean;
  isLoading: boolean;
  error: string | null;
  showHidden: boolean;
  searchQuery: string;
  selectedPaths: Set<string>;
  previewFile: FileEntry | null;
  imgLoading: boolean;
  dimensions: { width: number; height: number } | null;
  resizeWidth: number | undefined;
  homePath: string | null;
}

export const useFileFolderBrowser = () => {
  const [state, setState] = useState<BrowserState>({
    options: null,
    currentPath: '',
    parentPath: null,
    folders: [],
    files: [],
    isRoot: true,
    isLoading: false,
    error: null,
    showHidden: false,
    searchQuery: '',
    selectedPaths: new Set(),
    previewFile: null,
    imgLoading: true,
    dimensions: null,
    resizeWidth: undefined,
    homePath: null,
  });

  const showHiddenRef = useRef(state.showHidden);
  showHiddenRef.current = state.showHidden;

  const fetchDirectory = useCallback(async (path: string, showHiddenFiles: boolean) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, previewFile: null, dimensions: null, imgLoading: true }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/list-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path || null, show_hidden: showHiddenFiles }),
      });

      if (res.ok) {
        const data = await res.json();
        setState(prev => {
          const newHomePath = prev.homePath ? prev.homePath : (() => {
            if (data.current_path && !data.is_root) {
              const parts = data.current_path.split('/');
              if (parts.length >= 3 && parts[1] === 'home') {
                return '/' + parts[1] + '/' + parts[2];
              }
              return data.current_path;
            }
            return prev.homePath;
          })();

          return {
            ...prev,
            currentPath: data.current_path,
            parentPath: data.parent_path,
            folders: data.folders || [],
            files: data.files || [],
            isRoot: data.is_root,
            homePath: newHomePath,
          };
        });
      } else {
        const errData = await res.json();
        setState(prev => ({ ...prev, error: errData.detail || 'Failed to list directory contents' }));
      }
    } catch {
      setState(prev => ({ ...prev, error: `Connection to backend failed — is the backend running on port 8269?` }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    import('../../services/FileFolderBrowserService').then(({ registerBrowserCallback, unregisterBrowserCallback }) => {
      registerBrowserCallback((opts) => {
        setState(prev => ({
          ...prev,
          options: opts,
          selectedPaths: new Set(),
          previewFile: null,
          dimensions: null,
          imgLoading: true,
          resizeWidth: undefined,
          searchQuery: '',
          currentPath: '',
        }));
        fetchDirectory('', showHiddenRef.current);
      });

      return () => {
        unregisterBrowserCallback();
      };
    });
  }, [fetchDirectory]);

  const toggleHidden = useCallback(() => {
    const nextHidden = !state.showHidden;
    setState(prev => ({ ...prev, showHidden: nextHidden }));
    fetchDirectory(state.currentPath, nextHidden);
  }, [state.showHidden, state.currentPath, fetchDirectory]);

  const cancel = useCallback(() => {
    setState(prev => prev.options ? { ...prev, options: null } : prev);
  }, []);

  const confirm = useCallback(() => {
    setState(prev => {
      if (!prev.options) return prev;

      let finalPaths: string[] = [];
      if (prev.options.multiple) {
        if (prev.selectedPaths.size > 0) {
          finalPaths = Array.from(prev.selectedPaths);
        } else if (prev.options.directoryOnly) {
          finalPaths = [prev.currentPath];
        }
      } else {
        if (prev.selectedPaths.size > 0) {
          finalPaths = [Array.from(prev.selectedPaths)[0]];
        } else if (prev.options.directoryOnly) {
          finalPaths = [prev.currentPath];
        }
      }

      if (finalPaths.length > 0) {
        prev.options.resolve({ paths: finalPaths, resizeWidth: prev.resizeWidth });
      } else {
        prev.options.resolve(null);
      }

      return { ...prev, options: null };
    });
  }, []);

  const navigateUp = useCallback(() => {
    setState(prev => {
      if (prev.parentPath !== null) {
        fetchDirectory(prev.parentPath, prev.showHidden);
      }
      return { ...prev, selectedPaths: new Set(), searchQuery: '' };
    });
  }, [fetchDirectory]);

  const navigateTo = useCallback((path: string) => {
    fetchDirectory(path, state.showHidden);
    setState(prev => ({ ...prev, selectedPaths: new Set(), searchQuery: '' }));
  }, [state.showHidden, fetchDirectory]);

  const handleItemSelect = useCallback((path: string, isFolder: boolean, fileObj?: FileEntry, options?: { directoryOnly: boolean; multiple: boolean }) => {
    setState(prev => {
      if (!prev.options) return prev;

      const nextSelected = new Set(prev.selectedPaths);

      if (!options?.directoryOnly && isFolder) {
        fetchDirectory(path, prev.showHidden);
        return { ...prev, selectedPaths: new Set(), searchQuery: '' };
      }

      if (options?.multiple) {
        if (nextSelected.has(path)) {
          nextSelected.delete(path);
          if (prev.previewFile?.path === path) {
            return { ...prev, selectedPaths: nextSelected, previewFile: null, dimensions: null };
          }
        } else {
          nextSelected.add(path);
          if (fileObj?.is_image) {
            return { ...prev, selectedPaths: nextSelected, previewFile: fileObj, imgLoading: true };
          }
        }
      } else {
        nextSelected.clear();
        nextSelected.add(path);
        if (fileObj?.is_image) {
          return { ...prev, selectedPaths: nextSelected, previewFile: fileObj, imgLoading: true };
        }
      }

      return { ...prev, selectedPaths: nextSelected };
    });
  }, [fetchDirectory]);

  const handleFolderDoubleClick = useCallback((path: string) => {
    navigateTo(path);
  }, [navigateTo]);

  const setSelectedPaths = useCallback((paths: Set<string>) => {
    setState(prev => ({ ...prev, selectedPaths: paths }));
  }, []);

  const setResizeWidth = useCallback((value: number | undefined) => {
    setState(prev => ({ ...prev, resizeWidth: value }));
  }, []);

  const setDimensions = useCallback((dimensions: { width: number; height: number } | null) => {
    setState(prev => ({ ...prev, dimensions, imgLoading: false }));
  }, []);

  return {
    ...state,
    fetchDirectory,
    toggleHidden,
    cancel,
    confirm,
    navigateUp,
    navigateTo,
    handleItemSelect,
    handleFolderDoubleClick,
    setSelectedPaths,
    setResizeWidth,
    setDimensions,
  };
};
