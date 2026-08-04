import { FileEntry, FolderEntry, GroupBy, SortDirection, SortField } from './types';

export function compareNames(a: string, b: string, direction: SortDirection): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return direction === 'asc' ? cmp : -cmp;
}

export function compareNumbers(
  a: number | undefined | null,
  b: number | undefined | null,
  direction: SortDirection,
): number {
  const av = a ?? 0;
  const bv = b ?? 0;
  if (av === bv) return 0;
  const cmp = av < bv ? -1 : 1;
  return direction === 'asc' ? cmp : -cmp;
}

export function sortFolders(
  folders: FolderEntry[],
  sortField: SortField,
  sortDirection: SortDirection,
): FolderEntry[] {
  const next = [...folders];
  next.sort((a, b) => {
    if (sortField === 'name') {
      return compareNames(a.name, b.name, sortDirection);
    }
    if (sortField === 'modified') {
      const byDate = compareNumbers(a.modified_ms, b.modified_ms, sortDirection);
      return byDate !== 0 ? byDate : compareNames(a.name, b.name, 'asc');
    }
    // size/resolution do not apply to folders — keep name order as secondary
    return compareNames(a.name, b.name, sortDirection);
  });
  return next;
}

function resolutionValue(file: FileEntry): number {
  const width = file.width_px ?? 0;
  const height = file.height_px ?? 0;
  return width > 0 && height > 0 ? width * height : 0;
}

export function sortFiles(
  files: FileEntry[],
  sortField: SortField,
  sortDirection: SortDirection,
): FileEntry[] {
  const next = [...files];
  next.sort((a, b) => {
    if (sortField === 'name') {
      return compareNames(a.name, b.name, sortDirection);
    }
    if (sortField === 'size') {
      const bySize = compareNumbers(a.size_bytes, b.size_bytes, sortDirection);
      return bySize !== 0 ? bySize : compareNames(a.name, b.name, 'asc');
    }
    if (sortField === 'resolution') {
      const byResolution = compareNumbers(resolutionValue(a), resolutionValue(b), sortDirection);
      return byResolution !== 0 ? byResolution : compareNames(a.name, b.name, 'asc');
    }
    // modified
    const byDate = compareNumbers(a.modified_ms, b.modified_ms, sortDirection);
    return byDate !== 0 ? byDate : compareNames(a.name, b.name, 'asc');
  });
  return next;
}

export type ListGroupKey = string;

export interface ListGroup {
  key: ListGroupKey;
  label: string;
  folders: FolderEntry[];
  files: FileEntry[];
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatDateGroupLabel(modifiedMs: number | undefined | null): string {
  if (modifiedMs == null || !Number.isFinite(modifiedMs)) {
    return 'Unknown date';
  }

  const day = startOfLocalDay(modifiedMs);
  const today = startOfLocalDay(Date.now());
  const yesterday = today - 24 * 60 * 60 * 1000;

  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';

  return new Date(modifiedMs).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function dateGroupKey(modifiedMs: number | undefined | null): string {
  if (modifiedMs == null || !Number.isFinite(modifiedMs)) return 'unknown';
  return String(startOfLocalDay(modifiedMs));
}

/**
 * Build ordered groups for the virtual list.
 * - `none`: single implicit order — folders then files (caller handles flat list)
 * - `type`: Folders → Images → Videos
 * - `date`: calendar day groups (newest/oldest first follows sort direction when field is modified)
 */
export function buildGroups(
  folders: FolderEntry[],
  files: FileEntry[],
  groupBy: GroupBy,
  sortField: SortField,
  sortDirection: SortDirection,
): ListGroup[] | null {
  if (groupBy === 'none') return null;

  const sortedFolders = sortFolders(folders, sortField, sortDirection);
  const sortedFiles = sortFiles(files, sortField, sortDirection);

  if (groupBy === 'type') {
    const images = sortedFiles.filter((f) => f.is_image && !f.is_video);
    const videos = sortedFiles.filter((f) => f.is_video);
    const other = sortedFiles.filter((f) => !f.is_image && !f.is_video);

    const groups: ListGroup[] = [];
    if (sortedFolders.length > 0) {
      groups.push({ key: 'folders', label: 'Folders', folders: sortedFolders, files: [] });
    }
    if (images.length > 0) {
      groups.push({ key: 'images', label: 'Images', folders: [], files: images });
    }
    if (videos.length > 0) {
      groups.push({ key: 'videos', label: 'Videos', folders: [], files: videos });
    }
    if (other.length > 0) {
      groups.push({ key: 'other', label: 'Other', folders: [], files: other });
    }
    return groups;
  }

  // groupBy === 'date'
  type Bucket = { label: string; folders: FolderEntry[]; files: FileEntry[]; sortKey: number };
  const map = new Map<string, Bucket>();

  const ensure = (key: string, label: string, sortKey: number) => {
    let b = map.get(key);
    if (!b) {
      b = { label, folders: [], files: [], sortKey };
      map.set(key, b);
    }
    return b;
  };

  for (const folder of sortedFolders) {
    const key = dateGroupKey(folder.modified_ms);
    const label = formatDateGroupLabel(folder.modified_ms);
    const sortKey = folder.modified_ms ?? 0;
    ensure(key, label, sortKey).folders.push(folder);
  }
  for (const file of sortedFiles) {
    const key = dateGroupKey(file.modified_ms);
    const label = formatDateGroupLabel(file.modified_ms);
    const sortKey = file.modified_ms ?? 0;
    ensure(key, label, sortKey).files.push(file);
  }

  const buckets = Array.from(map.entries()).map(([key, b]) => ({
    key,
    label: b.label,
    folders: b.folders,
    files: b.files,
    sortKey: b.sortKey,
  }));

  // Order date groups by day; prefer newest-first when sorting by modified desc or size desc-ish default
  const groupDir: SortDirection =
    sortField === 'modified' ? sortDirection : sortDirection === 'asc' ? 'asc' : 'desc';

  buckets.sort((a, b) => {
    if (a.key === 'unknown') return 1;
    if (b.key === 'unknown') return -1;
    return compareNumbers(a.sortKey, b.sortKey, groupDir);
  });

  return buckets.map(({ key, label, folders: f, files: fi }) => ({
    key,
    label,
    folders: f,
    files: fi,
  }));
}
