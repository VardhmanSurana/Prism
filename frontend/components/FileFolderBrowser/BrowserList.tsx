import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Folder, Image as ImageIcon, Film, ChevronUp } from 'lucide-react';
import { FileEntry, FolderEntry, GroupBy, SortDirection, SortField } from './types';
import { buildGroups, sortFiles, sortFolders } from './browserSort';

const ROW_HEIGHT = 40;
const PARENT_ROW_HEIGHT = 40;
const GROUP_HEADER_HEIGHT = 28;

type ListRow =
  | { kind: 'parent' }
  | { kind: 'group'; key: string; label: string; count: number }
  | { kind: 'folder'; folder: FolderEntry }
  | { kind: 'file'; file: FileEntry }
  | { kind: 'empty' };

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
  activeFilterLabel?: string | null;
  sortField?: SortField;
  sortDirection?: SortDirection;
  groupBy?: GroupBy;
  onGoUp: () => void;
  onFolderDoubleClick: (path: string) => void;
  onItemSelect: (path: string, isFolder: boolean, fileObj?: FileEntry) => void;
  onRetry: () => void;
  onContextMenu?: (e: React.MouseEvent, path: string, isFolder: boolean) => void;
}

function formatSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatModified(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function formatResolution(width?: number, height?: number): string {
  if (!width || !height) return '';
  return `${width}×${height}`;
}

function metaLabel(
  sortField: SortField,
  sizeBytes?: number,
  modifiedMs?: number,
  widthPx?: number,
  heightPx?: number,
): string {
  if (sortField === 'resolution') {
    return (
      formatResolution(widthPx, heightPx) || formatSize(sizeBytes) || formatModified(modifiedMs)
    );
  }
  if (sortField === 'modified') {
    return formatModified(modifiedMs) || formatSize(sizeBytes);
  }
  if (sortField === 'size') {
    return formatSize(sizeBytes) || formatModified(modifiedMs);
  }
  // name: prefer size for files
  return formatSize(sizeBytes) || formatModified(modifiedMs);
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
  searchQuery,
  activeFilterLabel,
  sortField = 'name',
  sortDirection = 'asc',
  groupBy = 'none',
  onGoUp,
  onFolderDoubleClick,
  onItemSelect,
  onRetry,
  onContextMenu,
}) => {
  const isDirectoryOnly = directoryOnly ?? false;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowColumns = isDirectoryOnly
    ? '28px minmax(0, 1fr) 150px'
    : '28px minmax(0, 1fr) 150px 110px';

  const rows: ListRow[] = React.useMemo(() => {
    const next: ListRow[] = [];
    if (!isRoot && parentPath !== null) {
      next.push({ kind: 'parent' });
    }

    const mediaFiles = isDirectoryOnly ? [] : files;
    const hasContent = folders.length > 0 || mediaFiles.length > 0;

    if (!hasContent) {
      next.push({ kind: 'empty' });
      return next;
    }

    const groups = buildGroups(folders, mediaFiles, groupBy, sortField, sortDirection);

    if (!groups) {
      const sortedFolders = sortFolders(folders, sortField, sortDirection);
      const sortedFiles = sortFiles(mediaFiles, sortField, sortDirection);
      for (const folder of sortedFolders) {
        next.push({ kind: 'folder', folder });
      }
      for (const file of sortedFiles) {
        next.push({ kind: 'file', file });
      }
      return next;
    }

    for (const group of groups) {
      const count = group.folders.length + group.files.length;
      if (count === 0) continue;
      next.push({ kind: 'group', key: group.key, label: group.label, count });
      for (const folder of group.folders) {
        next.push({ kind: 'folder', folder });
      }
      for (const file of group.files) {
        next.push({ kind: 'file', file });
      }
    }

    return next;
  }, [folders, files, isRoot, parentPath, isDirectoryOnly, groupBy, sortField, sortDirection]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (row?.kind === 'parent') return PARENT_ROW_HEIGHT;
      if (row?.kind === 'group') return GROUP_HEADER_HEIGHT;
      return ROW_HEIGHT;
    },
    overscan: 12,
  });

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

  const emptyMessage =
    searchQuery || activeFilterLabel
      ? `No matches${activeFilterLabel ? ` for “${activeFilterLabel}”` : ''}${searchQuery ? ` matching “${searchQuery}”` : ''}.`
      : `No folders${!isDirectoryOnly ? ' or supported media files' : ''} found.`;

  const selectionMark = (isSelected: boolean) => (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
        isSelected ? 'border-primary bg-primary text-black' : 'border-white/25 bg-transparent'
      }`}
    >
      {isSelected && <span className="h-1.5 w-1.5 rounded-[1px] bg-black" />}
    </span>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="grid shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/38"
        style={{ gridTemplateColumns: rowColumns }}
      >
        <span className="h-4 w-4 rounded border border-white/20" />
        <span>Name</span>
        <span>Date modified</span>
        {!isDirectoryOnly && (
          <span className="text-right">{sortField === 'resolution' ? 'Resolution' : 'Size'}</span>
        )}
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            const style: React.CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            };

            if (row.kind === 'parent') {
              return (
                <div key="parent" style={style} className="px-0.5">
                  <div
                    onClick={onGoUp}
                    className="flex h-full items-center gap-3 rounded-lg px-3 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    <ChevronUp size={14} className="text-primary/70" />
                    <span className="font-semibold">.. (Parent directory)</span>
                  </div>
                </div>
              );
            }

            if (row.kind === 'group') {
              return (
                <div key={`group-${row.key}`} style={style} className="px-0.5">
                  <div className="flex h-full items-center gap-2 px-3">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
                      {row.label}
                    </span>
                    <span className="text-[9px] font-mono text-white/20">{row.count}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                </div>
              );
            }

            if (row.kind === 'empty') {
              return (
                <div key="empty" style={style} className="px-0.5">
                  <div className="py-12 text-center text-xs text-white/30">{emptyMessage}</div>
                </div>
              );
            }

            if (row.kind === 'folder') {
              const f = row.folder;
              const isSelected = selectedPaths.has(f.path);
              const secondary = metaLabel(sortField, undefined, f.modified_ms);
              return (
                <div key={f.path} style={style} className="px-0.5">
                  <div
                    onClick={() => onItemSelect(f.path, true)}
                    onDoubleClick={() => onFolderDoubleClick(f.path)}
                    onContextMenu={(e) => onContextMenu?.(e, f.path, true)}
                    style={{ gridTemplateColumns: rowColumns }}
                    className={`group grid h-full items-center gap-3 rounded-lg px-3 text-sm transition-colors cursor-pointer
                    ${
                      isSelected
                        ? 'bg-primary/12 text-primary'
                        : 'text-white/82 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="text-white/35">
                      {isDirectoryOnly ? selectionMark(isSelected) : null}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <Folder
                        size={18}
                        className={
                          isSelected ? 'shrink-0 text-primary' : 'shrink-0 text-amber-400/85'
                        }
                      />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <span className="truncate text-xs text-white/38">
                      {formatModified(f.modified_ms) || secondary || '—'}
                    </span>
                    {!isDirectoryOnly && (
                      <span className="text-right text-xs text-white/30">—</span>
                    )}
                  </div>
                </div>
              );
            }

            const file = row.file;
            const isSelected = selectedPaths.has(file.path);
            const isPreviewed = previewFile?.path === file.path;
            const secondary = metaLabel(
              sortField,
              file.size_bytes,
              file.modified_ms,
              file.width_px,
              file.height_px,
            );
            return (
              <div key={file.path} style={style} className="px-0.5">
                <div
                  onClick={() => onItemSelect(file.path, false, file)}
                  onContextMenu={(e) => onContextMenu?.(e, file.path, false)}
                  style={{ gridTemplateColumns: rowColumns }}
                  className={`group grid h-full items-center gap-3 rounded-lg px-3 text-sm transition-colors cursor-pointer
                  ${
                    isSelected
                      ? 'bg-primary/12 text-primary'
                      : isPreviewed
                        ? 'bg-white/5 text-white'
                        : 'text-white/82 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{selectionMark(isSelected)}</span>
                  <div className="flex min-w-0 items-center gap-3">
                    {file.is_video ? (
                      <Film
                        size={18}
                        className={
                          isSelected ? 'shrink-0 text-primary' : 'shrink-0 text-emerald-400/85'
                        }
                      />
                    ) : (
                      <ImageIcon
                        size={18}
                        className={
                          isSelected ? 'shrink-0 text-primary' : 'shrink-0 text-sky-400/85'
                        }
                      />
                    )}
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span className="truncate text-xs text-white/38">
                    {formatModified(file.modified_ms) || '—'}
                  </span>
                  <span className="text-right text-xs text-white/38">{secondary || '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
