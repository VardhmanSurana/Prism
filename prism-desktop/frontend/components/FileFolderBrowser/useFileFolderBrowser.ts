import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE } from '../../constants';
import { BrowseOptions } from '../../services/FileFolderBrowserService';
import {
  BrowserMount,
  CloudProviderInfo,
  ExternalLocation,
  FileEntry,
  FolderEntry,
  GroupBy,
  RecentFolder,
  SmartFolder,
  SmartFolderCriteria,
  SortDirection,
  SortField,
} from './types';
import {
  loadRecentFolders,
  pushRecentFolder,
  loadSmartFolders,
  createSmartFolder as persistSmartFolder,
  deleteSmartFolder as persistDeleteSmartFolder,
  loadSortState,
  saveSortState,
} from './browserStorage';

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
  recentFolders: RecentFolder[];
  smartFolders: SmartFolder[];
  activeSmartFolderId: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  mounts: BrowserMount[];
  externalLocations: ExternalLocation[];
  cloudProviders: CloudProviderInfo[];
}

function matchesSmartCriteria(
  name: string,
  file: FileEntry | null,
  criteria: SmartFolderCriteria,
): boolean {
  const pattern = (criteria.namePattern || '').trim().toLowerCase();
  if (pattern && !name.toLowerCase().includes(pattern)) {
    return false;
  }

  if (file) {
    const mediaType = criteria.mediaType || 'all';
    if (mediaType === 'image' && !file.is_image) return false;
    if (mediaType === 'video' && !file.is_video) return false;

    const size = file.size_bytes ?? 0;
    if (criteria.minSizeBytes != null && size < criteria.minSizeBytes) return false;
    if (criteria.maxSizeBytes != null && size > criteria.maxSizeBytes) return false;
  }

  return true;
}

export const useFileFolderBrowser = () => {
  const initialSort = loadSortState();
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
    recentFolders: loadRecentFolders(),
    smartFolders: loadSmartFolders(),
    activeSmartFolderId: null,
    sortField: initialSort.sortField,
    sortDirection: initialSort.sortDirection,
    groupBy: initialSort.groupBy,
    mounts: [],
    externalLocations: [],
    cloudProviders: [],
  });

  const showHiddenRef = useRef(state.showHidden);
  showHiddenRef.current = state.showHidden;

  const fetchBrowserLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/browser-locations`);
      if (!res.ok) return;
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        mounts: data.mounts || [],
        externalLocations: data.external_locations || [],
        cloudProviders: data.providers || [],
        homePath: prev.homePath || data.home_path || null,
      }));
    } catch {
      // Non-fatal — shortcuts still work without mounts
    }
  }, []);

  const fetchDirectory = useCallback(async (path: string, showHiddenFiles: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      previewFile: null,
      dimensions: null,
      imgLoading: true,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/list-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path || null, show_hidden: showHiddenFiles }),
      });

      if (res.ok) {
        const data = await res.json();
        setState((prev) => {
          const newHomePath = prev.homePath
            ? prev.homePath
            : (() => {
                if (data.current_path && !data.is_root) {
                  const parts = data.current_path.split('/');
                  if (parts.length >= 3 && parts[1] === 'home') {
                    return '/' + parts[1] + '/' + parts[2];
                  }
                  return data.current_path;
                }
                return prev.homePath;
              })();

          let recentFolders = prev.recentFolders;
          if (data.current_path && !data.is_root) {
            recentFolders = pushRecentFolder(data.current_path);
          }

          return {
            ...prev,
            currentPath: data.current_path,
            parentPath: data.parent_path,
            folders: data.folders || [],
            files: data.files || [],
            isRoot: data.is_root,
            homePath: newHomePath,
            recentFolders,
          };
        });
      } else {
        const errData = await res.json();
        setState((prev) => ({
          ...prev,
          error: errData.detail || 'Failed to list directory contents',
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        error: `Connection to backend failed — is the backend running on port 8269?`,
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    import('../../services/FileFolderBrowserService').then(
      ({ registerBrowserCallback, unregisterBrowserCallback }) => {
        registerBrowserCallback((opts) => {
          setState((prev) => ({
            ...prev,
            options: opts,
            selectedPaths: new Set(),
            previewFile: null,
            dimensions: null,
            imgLoading: true,
            resizeWidth: undefined,
            searchQuery: '',
            currentPath: '',
            activeSmartFolderId: null,
            recentFolders: loadRecentFolders(),
            smartFolders: loadSmartFolders(),
          }));
          fetchDirectory('', showHiddenRef.current);
          fetchBrowserLocations();
        });

        return () => {
          unregisterBrowserCallback();
        };
      },
    );
  }, [fetchDirectory, fetchBrowserLocations]);

  const activeSmartFolder = useMemo(
    () => state.smartFolders.find((f) => f.id === state.activeSmartFolderId) || null,
    [state.smartFolders, state.activeSmartFolderId],
  );

  const filteredFolders = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    const criteria = activeSmartFolder?.criteria;

    return state.folders.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (criteria) {
        // Smart folder size/type apply to files; folders only match name pattern.
        const pattern = (criteria.namePattern || '').trim().toLowerCase();
        if (pattern && !f.name.toLowerCase().includes(pattern)) return false;
      }
      return true;
    });
  }, [state.folders, state.searchQuery, activeSmartFolder]);

  const filteredFiles = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    const criteria = activeSmartFolder?.criteria;

    return state.files.filter((f) => {
      if (!f.is_image && !f.is_video) return false;
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (criteria && !matchesSmartCriteria(f.name, f, criteria)) return false;
      return true;
    });
  }, [state.files, state.searchQuery, activeSmartFolder]);

  const toggleHidden = useCallback(() => {
    const nextHidden = !state.showHidden;
    setState((prev) => ({ ...prev, showHidden: nextHidden }));
    fetchDirectory(state.currentPath, nextHidden);
  }, [state.showHidden, state.currentPath, fetchDirectory]);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const cancel = useCallback(() => {
    setState((prev) => (prev.options ? { ...prev, options: null } : prev));
  }, []);

  const confirm = useCallback(() => {
    setState((prev) => {
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
    setState((prev) => {
      if (prev.parentPath !== null) {
        fetchDirectory(prev.parentPath, prev.showHidden);
      }
      return { ...prev, selectedPaths: new Set(), searchQuery: '', activeSmartFolderId: null };
    });
  }, [fetchDirectory]);

  const navigateTo = useCallback(
    (path: string) => {
      fetchDirectory(path, state.showHidden);
      setState((prev) => ({
        ...prev,
        selectedPaths: new Set(),
        searchQuery: '',
        activeSmartFolderId: null,
      }));
    },
    [state.showHidden, fetchDirectory],
  );

  const handleItemSelect = useCallback(
    (
      path: string,
      isFolder: boolean,
      fileObj?: FileEntry,
      options?: { directoryOnly: boolean; multiple: boolean },
    ) => {
      setState((prev) => {
        if (!prev.options) return prev;

        const nextSelected = new Set(prev.selectedPaths);

        if (!options?.directoryOnly && isFolder) {
          fetchDirectory(path, prev.showHidden);
          return {
            ...prev,
            selectedPaths: new Set(),
            searchQuery: '',
            activeSmartFolderId: null,
          };
        }

        if (options?.multiple) {
          if (nextSelected.has(path)) {
            nextSelected.delete(path);
            if (prev.previewFile?.path === path) {
              return {
                ...prev,
                selectedPaths: nextSelected,
                previewFile: null,
                dimensions: null,
              };
            }
          } else {
            nextSelected.add(path);
            if (fileObj?.is_image || fileObj?.is_video) {
              return {
                ...prev,
                selectedPaths: nextSelected,
                previewFile: fileObj,
                imgLoading: true,
              };
            }
          }
        } else {
          nextSelected.clear();
          nextSelected.add(path);
          if (fileObj?.is_image || fileObj?.is_video) {
            return {
              ...prev,
              selectedPaths: nextSelected,
              previewFile: fileObj,
              imgLoading: true,
            };
          }
        }

        return { ...prev, selectedPaths: nextSelected };
      });
    },
    [fetchDirectory],
  );

  const handleFolderDoubleClick = useCallback(
    (path: string) => {
      navigateTo(path);
    },
    [navigateTo],
  );

  const setSelectedPaths = useCallback((paths: Set<string>) => {
    setState((prev) => ({ ...prev, selectedPaths: paths }));
  }, []);

  const setResizeWidth = useCallback((value: number | undefined) => {
    setState((prev) => ({ ...prev, resizeWidth: value }));
  }, []);

  const setDimensions = useCallback((dimensions: { width: number; height: number } | null) => {
    setState((prev) => ({ ...prev, dimensions, imgLoading: false }));
  }, []);

  const clearPreview = useCallback(() => {
    setState((prev) => ({ ...prev, previewFile: null, dimensions: null, imgLoading: true }));
  }, []);

  const activateSmartFolder = useCallback(
    (folder: SmartFolder) => {
      setState((prev) => ({
        ...prev,
        activeSmartFolderId: folder.id,
        searchQuery: folder.criteria.namePattern || '',
        selectedPaths: new Set(),
        previewFile: null,
      }));

      if (folder.basePath) {
        fetchDirectory(folder.basePath, showHiddenRef.current);
      }
    },
    [fetchDirectory],
  );

  const clearSmartFolder = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeSmartFolderId: null,
      searchQuery: '',
    }));
  }, []);

  const saveSmartFolder = useCallback(
    (name: string, criteria: SmartFolderCriteria, basePath?: string) => {
      const created = persistSmartFolder(name, criteria, basePath);
      setState((prev) => ({
        ...prev,
        smartFolders: [created, ...prev.smartFolders.filter((f) => f.id !== created.id)],
        activeSmartFolderId: created.id,
        searchQuery: criteria.namePattern || prev.searchQuery,
      }));
      return created;
    },
    [],
  );

  const removeSmartFolder = useCallback((id: string) => {
    const next = persistDeleteSmartFolder(id);
    setState((prev) => ({
      ...prev,
      smartFolders: next,
      activeSmartFolderId: prev.activeSmartFolderId === id ? null : prev.activeSmartFolderId,
    }));
  }, []);

  const setSortField = useCallback((field: SortField) => {
    setState((prev) => {
      const next = {
        ...prev,
        sortField: field,
        // Keep direction when re-selecting the same field; defaults when switching
        sortDirection:
          field === prev.sortField
            ? prev.sortDirection
            : field === 'name'
              ? ('asc' as SortDirection)
              : ('desc' as SortDirection),
      };
      saveSortState({
        sortField: next.sortField,
        sortDirection: next.sortDirection,
        groupBy: next.groupBy,
      });
      return next;
    });
  }, []);

  const toggleSortDirection = useCallback(() => {
    setState((prev) => {
      const nextDir: SortDirection = prev.sortDirection === 'asc' ? 'desc' : 'asc';
      const next = { ...prev, sortDirection: nextDir };
      saveSortState({
        sortField: next.sortField,
        sortDirection: next.sortDirection,
        groupBy: next.groupBy,
      });
      return next;
    });
  }, []);

  const setGroupBy = useCallback((groupBy: GroupBy) => {
    setState((prev) => {
      const next = { ...prev, groupBy };
      saveSortState({
        sortField: next.sortField,
        sortDirection: next.sortDirection,
        groupBy: next.groupBy,
      });
      return next;
    });
  }, []);

  const addExternalLocation = useCallback((loc: ExternalLocation) => {
    setState((prev) => ({
      ...prev,
      externalLocations: [loc, ...prev.externalLocations.filter((l) => l.id !== loc.id)],
    }));
  }, []);

  const removeExternalLocation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/external-locations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        externalLocations: prev.externalLocations.filter((l) => l.id !== id),
      }));
    } catch {
      // ignore
    }
  }, []);

  const openInOsExplorer = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api/v1/utilities/open-in-os-explorer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Failed to open OS explorer');
    }
  }, []);

  return {
    ...state,
    filteredFolders,
    filteredFiles,
    activeSmartFolder,
    fetchDirectory,
    fetchBrowserLocations,
    toggleHidden,
    setSearchQuery,
    cancel,
    confirm,
    navigateUp,
    navigateTo,
    handleItemSelect,
    handleFolderDoubleClick,
    setSelectedPaths,
    setResizeWidth,
    setDimensions,
    clearPreview,
    activateSmartFolder,
    clearSmartFolder,
    saveSmartFolder,
    removeSmartFolder,
    setSortField,
    toggleSortDirection,
    setGroupBy,
    addExternalLocation,
    removeExternalLocation,
    openInOsExplorer,
  };
};
