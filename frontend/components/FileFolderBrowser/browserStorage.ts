import { BrowserSortState, GroupBy, RecentFolder, SmartFolder, SortDirection, SortField } from './types';

const RECENT_KEY = 'prism_file_browser_recent_folders';
const SMART_KEY = 'prism_file_browser_smart_folders';
const SORT_KEY = 'prism_file_browser_sort';
const MAX_RECENT = 5;

const DEFAULT_SORT: BrowserSortState = {
  sortField: 'name',
  sortDirection: 'asc',
  groupBy: 'none',
};

const SORT_FIELDS: SortField[] = ['name', 'size', 'modified'];
const SORT_DIRS: SortDirection[] = ['asc', 'desc'];
const GROUP_BYS: GroupBy[] = ['none', 'type', 'date'];


function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * loadRecentFolders - Performs load recent folders.
 */
export function loadRecentFolders(): RecentFolder[] {
  return safeParse<RecentFolder[]>(localStorage.getItem(RECENT_KEY), []);
}

/**
 * pushRecentFolder - Performs push recent folder.
 */
export function pushRecentFolder(path: string, name?: string): RecentFolder[] {
  if (!path) return loadRecentFolders();

  const entry: RecentFolder = {
    name: name || path.split('/').filter(Boolean).pop() || path,
    path,
    lastVisitedAt: Date.now(),
  };

  /**
   * existing - Performs existing.
   */
  const existing = loadRecentFolders().filter((r) => r.path !== path);
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

/**
 * loadSmartFolders - Performs load smart folders.
 */
export function loadSmartFolders(): SmartFolder[] {
  return safeParse<SmartFolder[]>(localStorage.getItem(SMART_KEY), []);
}

/**
 * saveSmartFolders - Performs save smart folders.
 */
export function saveSmartFolders(folders: SmartFolder[]): void {
  localStorage.setItem(SMART_KEY, JSON.stringify(folders));
}

/**
 * createSmartFolder - Performs create smart folder.
 */
export function createSmartFolder(
  name: string,
  criteria: SmartFolder['criteria'],
  basePath?: string
): SmartFolder {
  const folder: SmartFolder = {
    id: `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    basePath: basePath || undefined,
    criteria,
    createdAt: Date.now(),
  };

  const next = [folder, ...loadSmartFolders()];
  saveSmartFolders(next);
  return folder;
}

/**
 * deleteSmartFolder - Performs delete smart folder.
 */
export function deleteSmartFolder(id: string): SmartFolder[] {
  /**
   * next - Performs next.
   */
  const next = loadSmartFolders().filter((f) => f.id !== id);
  saveSmartFolders(next);
  return next;
}

/**
 * loadSortState - Performs load sort state.
 */
export function loadSortState(): BrowserSortState {
  const raw = safeParse<Partial<BrowserSortState>>(localStorage.getItem(SORT_KEY), {});
  return {
    sortField: SORT_FIELDS.includes(raw.sortField as SortField)
      ? (raw.sortField as SortField)
      : DEFAULT_SORT.sortField,
    sortDirection: SORT_DIRS.includes(raw.sortDirection as SortDirection)
      ? (raw.sortDirection as SortDirection)
      : DEFAULT_SORT.sortDirection,
    groupBy: GROUP_BYS.includes(raw.groupBy as GroupBy)
      ? (raw.groupBy as GroupBy)
      : DEFAULT_SORT.groupBy,
  };
}

/**
 * saveSortState - Performs save sort state.
 */
export function saveSortState(state: BrowserSortState): void {
  localStorage.setItem(SORT_KEY, JSON.stringify(state));
}
