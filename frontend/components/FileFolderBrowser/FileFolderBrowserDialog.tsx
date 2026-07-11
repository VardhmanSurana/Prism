import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, FilterX, Pencil, Grip } from 'lucide-react';
import {
  useFileFolderBrowser,
  BrowserHeader,
  BrowserBreadcrumbs,
  BrowserShortcuts,
  BrowserSearch,
  BrowserList,
  FilePreview,
} from '.';
import { SaveSmartFolderForm } from './SaveSmartFolderForm';
import { BatchRenameModal } from './BatchRenameModal';
import { AddExternalLocationForm } from './AddExternalLocationForm';
import { BrowserContextMenu, ContextMenuState } from './BrowserContextMenu';

const DEFAULT_DIALOG_SIZE = { width: 1080, height: 720 };
const MIN_DIALOG_SIZE = { width: 760, height: 520 };

// Kept at module scope deliberately: the choice lasts for the app session, but is not persisted
// across launches or written to user storage.
let sessionDialogSize = { ...DEFAULT_DIALOG_SIZE };

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface DialogPosition {
  left: number;
  top: number;
}

export const FileFolderBrowserDialog: React.FC = () => {
  const browser = useFileFolderBrowser();
  const [showSaveSmart, setShowSaveSmart] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamePaths, setRenamePaths] = useState<string[] | null>(null);
  const [dialogSize, setDialogSize] = useState(sessionDialogSize);
  const [dialogPosition, setDialogPosition] = useState<DialogPosition | null>(null);
  const resizeState = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const directoryOnly = browser.options?.directoryOnly ?? false;
  const multiple = browser.options?.multiple ?? false;
  const title = browser.options?.title;
  const homePath = browser.homePath;

  const filePathSet = useMemo(() => new Set(browser.files.map((f) => f.path)), [browser.files]);

  const selectedFilePaths = useMemo(
    () => Array.from(browser.selectedPaths).filter((p) => filePathSet.has(p)),
    [browser.selectedPaths, filePathSet],
  );

  const shortcutList = useMemo(() => {
    const list: { name: string; path: string }[] = [];
    if (homePath) {
      list.push({ name: 'Home', path: homePath });
      list.push({ name: 'Pictures', path: `${homePath}/Pictures` });
      list.push({ name: 'Downloads', path: `${homePath}/Downloads` });
    }
    return list;
  }, [homePath]);

  const openRename = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setContextMenu(null);
    setRenamePaths(paths);
  }, []);

  const resolveRenameTargets = useCallback(
    (clickedPath: string): string[] => {
      if (selectedFilePaths.length > 1 && selectedFilePaths.includes(clickedPath)) {
        return selectedFilePaths;
      }
      if (filePathSet.has(clickedPath)) {
        return [clickedPath];
      }
      return selectedFilePaths.length > 0 ? selectedFilePaths : [];
    },
    [selectedFilePaths, filePathSet],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, isFolder: boolean) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isFolder && filePathSet.has(path) && !browser.selectedPaths.has(path)) {
        const fileObj = browser.files.find((f) => f.path === path);
        browser.handleItemSelect(path, false, fileObj, {
          directoryOnly,
          multiple: false, // exclusive select the right-clicked file
        });
      }

      setContextMenu({ x: e.clientX, y: e.clientY, path, isFolder });
    },
    [browser, directoryOnly, filePathSet],
  );

  const handleShortcutClick = useCallback(
    (path: string) => {
      browser.navigateTo(path);
    },
    [browser],
  );

  const handleHome = useCallback(() => {
    browser.navigateTo('');
  }, [browser]);

  const handleRetry = useCallback(() => {
    browser.navigateTo('');
  }, [browser]);

  const handleOpenInOsExplorer = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await browser.openInOsExplorer(contextMenu.path);
      setContextMenu(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open OS explorer';
      alert(message);
    }
  }, [browser, contextMenu]);

  const hasActiveFilter = Boolean(browser.searchQuery.trim()) || Boolean(browser.activeSmartFolder);

  const canRenameFromFooter = !directoryOnly && selectedFilePaths.length > 0;

  const beginResize = useCallback((event: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    event.preventDefault();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    resizeState.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
    };
    setDialogPosition({ left: rect.left, top: rect.top });
  }, []);

  useEffect(() => {
    const resize = (event: PointerEvent) => {
      const active = resizeState.current;
      if (!active) return;

      const maxWidth = Math.max(MIN_DIALOG_SIZE.width, window.innerWidth - 32);
      const maxHeight = Math.max(MIN_DIALOG_SIZE.height, window.innerHeight - 32);
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      const resizesWest = active.edge.includes('w');
      const resizesNorth = active.edge.includes('n');
      const resizesEast = active.edge.includes('e');
      const resizesSouth = active.edge.includes('s');

      let width = active.startWidth + (resizesEast ? dx : resizesWest ? -dx : 0);
      let height = active.startHeight + (resizesSouth ? dy : resizesNorth ? -dy : 0);
      width = Math.min(maxWidth, Math.max(MIN_DIALOG_SIZE.width, width));
      height = Math.min(maxHeight, Math.max(MIN_DIALOG_SIZE.height, height));

      const left = resizesWest ? active.startLeft + active.startWidth - width : active.startLeft;
      const top = resizesNorth ? active.startTop + active.startHeight - height : active.startTop;
      const nextSize = { width, height };
      sessionDialogSize = nextSize;
      setDialogSize(nextSize);
      setDialogPosition({ left, top });
    };

    const stopResize = () => {
      resizeState.current = null;
    };

    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
    };
  }, []);

  if (!browser.options) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={browser.cancel}
          className="absolute inset-0 bg-black/70"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={
            dialogPosition
              ? {
                  width: dialogSize.width,
                  height: dialogSize.height,
                  left: dialogPosition.left,
                  top: dialogPosition.top,
                }
              : { width: dialogSize.width, height: dialogSize.height }
          }
          className={`fixed max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col select-none
            ${dialogPosition ? '' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'}`}
        >
          <BrowserHeader
            title={title || (directoryOnly ? 'Browse for folder' : 'Browse image files')}
            onClose={browser.cancel}
          />

          <div className="flex flex-1 min-h-0 overflow-hidden bg-[#070707]">
            <aside className="w-60 shrink-0 border-r border-white/10 bg-[#0b0b0b]">
              <BrowserShortcuts
                variant="sidebar"
                shortcuts={shortcutList}
                recentFolders={browser.recentFolders}
                smartFolders={browser.smartFolders}
                mounts={browser.mounts}
                externalLocations={browser.externalLocations}
                activeSmartFolderId={browser.activeSmartFolderId}
                onShortcutClick={handleShortcutClick}
                onRecentClick={handleShortcutClick}
                onSmartFolderClick={browser.activateSmartFolder}
                onSmartFolderDelete={browser.removeSmartFolder}
                onExternalDelete={browser.removeExternalLocation}
                onAddLocation={() => setShowAddLocation((v) => !v)}
              />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0c0c0c] px-5 py-3">
                <div className="min-w-0 flex-1">
                  <BrowserBreadcrumbs
                    currentPath={browser.currentPath}
                    onNavigate={(path: string) => browser.fetchDirectory(path, browser.showHidden)}
                    onHome={handleHome}
                  />
                </div>
                <div className="w-[280px] shrink-0">
                  <BrowserSearch
                    value={browser.searchQuery}
                    onChange={browser.setSearchQuery}
                    placeholder={directoryOnly ? 'Search folders...' : 'Search this folder...'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveSmart((v) => !v)}
                  title="Save current filters as a smart folder"
                  className={`shrink-0 p-2 rounded-lg border transition-all cursor-pointer ${
                    showSaveSmart
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Star size={14} />
                </button>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      browser.clearSmartFolder();
                      setShowSaveSmart(false);
                    }}
                    title="Clear active filters"
                    className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <FilterX size={14} />
                  </button>
                )}
              </div>

              <div className="shrink-0 border-b border-white/10 bg-[#090909] px-5 py-2.5">
                <BrowserHeader
                  title=""
                  onClose={browser.cancel}
                  showSortControls
                  sortField={browser.sortField}
                  sortDirection={browser.sortDirection}
                  groupBy={browser.groupBy}
                  onSortFieldChange={browser.setSortField}
                  onSortDirectionToggle={browser.toggleSortDirection}
                  onGroupByChange={browser.setGroupBy}
                  directoryOnly={directoryOnly}
                  compact
                />
              </div>

              {browser.activeSmartFolder && (
                <div className="flex shrink-0 items-center gap-2 border-b border-primary/15 bg-primary/[0.04] px-5 py-2 text-[11px] text-primary/90">
                  <Star size={12} />
                  <span className="truncate">Smart filter: {browser.activeSmartFolder.name}</span>
                </div>
              )}

              {showSaveSmart && (
                <div className="shrink-0 border-b border-white/10 px-5 py-3">
                  <SaveSmartFolderForm
                    initialNamePattern={browser.searchQuery}
                    currentPath={browser.currentPath || undefined}
                    onCancel={() => setShowSaveSmart(false)}
                    onSave={(name, criteria, basePath) => {
                      browser.saveSmartFolder(name, criteria, basePath);
                      setShowSaveSmart(false);
                    }}
                  />
                </div>
              )}

              {showAddLocation && (
                <div className="shrink-0 border-b border-white/10 px-5 py-3">
                  <AddExternalLocationForm
                    providers={browser.cloudProviders}
                    onCancel={() => setShowAddLocation(false)}
                    onCreated={(loc) => {
                      browser.addExternalLocation(loc);
                      setShowAddLocation(false);
                      if (loc.mount_path && loc.status === 'available')
                        browser.navigateTo(loc.mount_path);
                    }}
                  />
                </div>
              )}

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden px-4 py-3">
                  <BrowserList
                    folders={browser.filteredFolders}
                    files={browser.filteredFiles}
                    isLoading={browser.isLoading}
                    error={browser.error}
                    isRoot={browser.isRoot}
                    parentPath={browser.parentPath}
                    selectedPaths={browser.selectedPaths}
                    previewFile={browser.previewFile}
                    directoryOnly={directoryOnly}
                    multiple={multiple}
                    searchQuery={browser.searchQuery}
                    activeFilterLabel={browser.activeSmartFolder?.name}
                    sortField={browser.sortField}
                    sortDirection={browser.sortDirection}
                    groupBy={browser.groupBy}
                    onGoUp={browser.navigateUp}
                    onFolderDoubleClick={browser.handleFolderDoubleClick}
                    onItemSelect={(path: string, isFolder: boolean, fileObj?: any) => {
                      browser.handleItemSelect(path, isFolder, fileObj, {
                        directoryOnly,
                        multiple,
                      });
                    }}
                    onRetry={handleRetry}
                    onContextMenu={directoryOnly ? undefined : handleContextMenu}
                  />
                </div>

                {browser.previewFile && (
                  <FilePreview
                    file={browser.previewFile}
                    imgLoading={browser.imgLoading}
                    dimensions={browser.dimensions}
                    onLoad={(width: number, height: number) =>
                      browser.setDimensions({ width, height })
                    }
                    onClose={browser.clearPreview}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-[#080808] shrink-0 select-none gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <label className="flex items-center gap-2 text-[10px] font-mono uppercase text-white/40 hover:text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={browser.showHidden}
                  onChange={browser.toggleHidden}
                  className="rounded border-white/10 bg-transparent text-primary focus:ring-0 w-3 h-3"
                />
                <span>Show hidden</span>
              </label>
              {canRenameFromFooter && (
                <button
                  type="button"
                  onClick={() => openRename(selectedFilePaths)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg cursor-pointer"
                  title="Batch rename selected files"
                >
                  <Pencil size={11} />
                  Rename{selectedFilePaths.length > 1 ? ` (${selectedFilePaths.length})` : ''}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={browser.cancel}
                className="px-4 py-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white/70 hover:text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={browser.confirm}
                disabled={browser.isLoading}
                className="px-4 py-1.5 bg-primary text-black hover:bg-primary/95 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {directoryOnly
                  ? browser.selectedPaths.size > 0
                    ? 'Use selected folder'
                    : 'Use this folder'
                  : browser.selectedPaths.size > 0
                    ? `Use selected (${browser.selectedPaths.size})`
                    : 'Use current'}
              </button>
            </div>
          </div>
          {(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
            <div
              key={edge}
              role="presentation"
              onPointerDown={(event) => beginResize(event, edge)}
              className={`absolute z-10 ${
                edge === 'n'
                  ? 'top-0 left-3 right-3 h-1 cursor-n-resize'
                  : edge === 's'
                    ? 'bottom-0 left-3 right-3 h-1 cursor-s-resize'
                    : edge === 'e'
                      ? 'right-0 top-3 bottom-3 w-1 cursor-e-resize'
                      : edge === 'w'
                        ? 'left-0 top-3 bottom-3 w-1 cursor-w-resize'
                        : edge === 'ne'
                          ? 'right-0 top-0 h-3 w-3 cursor-ne-resize'
                          : edge === 'nw'
                            ? 'left-0 top-0 h-3 w-3 cursor-nw-resize'
                            : edge === 'se'
                              ? 'bottom-0 right-0 h-4 w-4 cursor-se-resize'
                              : 'bottom-0 left-0 h-3 w-3 cursor-sw-resize'
              }`}
            />
          ))}
          <Grip
            size={12}
            className="pointer-events-none absolute bottom-1 right-1 rotate-90 text-white/20"
          />
        </motion.div>

        {contextMenu && (
          <BrowserContextMenu
            menu={contextMenu}
            canBatchRename={!directoryOnly}
            selectedCount={
              selectedFilePaths.includes(contextMenu.path)
                ? Math.max(selectedFilePaths.length, 1)
                : 1
            }
            onClose={() => setContextMenu(null)}
            onBatchRename={() => openRename(resolveRenameTargets(contextMenu.path))}
            onOpenRenameForSingle={() =>
              openRename(
                filePathSet.has(contextMenu.path) ? resolveRenameTargets(contextMenu.path) : [],
              )
            }
            onOpenInOsExplorer={handleOpenInOsExplorer}
          />
        )}

        {renamePaths && renamePaths.length > 0 && (
          <BatchRenameModal
            paths={renamePaths}
            onClose={() => setRenamePaths(null)}
            onComplete={() => {
              setRenamePaths(null);
              browser.fetchDirectory(browser.currentPath, browser.showHidden);
              browser.setSelectedPaths(new Set());
            }}
          />
        )}
      </div>
    </AnimatePresence>
  );
};
