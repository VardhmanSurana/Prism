export interface FileEntry {
  name: string;
  path: string;
  is_hidden: boolean;
  size_bytes?: number;
  modified_ms?: number;
  width_px?: number;
  height_px?: number;
  is_image?: boolean;
  is_video?: boolean;
}

export interface FolderEntry {
  name: string;
  path: string;
  is_hidden: boolean;
  modified_ms?: number;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface ShortcutItem {
  name: string;
  path: string;
}

export type MountKind = 'network' | 'removable' | 'volume';

export interface BrowserMount {
  name: string;
  path: string;
  kind: MountKind;
  fstype?: string | null;
  source?: string;
}

export type ExternalProviderId = 'local_path' | 'smb' | 's3' | 'gdrive';

export interface ExternalLocation {
  id: string;
  provider: ExternalProviderId | string;
  name: string;
  enabled: boolean;
  mount_path?: string | null;
  status?: string;
  error?: string | null;
  bucket?: string;
  region?: string;
  endpoint?: string;
  smb_host?: string;
  smb_share?: string;
  notes?: string;
}

export interface CloudProviderInfo {
  id: string;
  label: string;
  ready: boolean;
  description: string;
  notes?: string;
}

export interface BrowserLocationsResponse {
  mounts: BrowserMount[];
  external_locations: ExternalLocation[];
  providers: CloudProviderInfo[];
  home_path: string;
}

export interface RecentFolder {
  name: string;
  path: string;
  lastVisitedAt: number;
}

export type SmartFolderMediaType = 'all' | 'image' | 'video';

export interface SmartFolderCriteria {
  /** Case-insensitive substring match on file/folder name */
  namePattern?: string;
  mediaType?: SmartFolderMediaType;
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

export interface SmartFolder {
  id: string;
  name: string;
  /** Optional path to navigate to when the smart folder is activated */
  basePath?: string;
  criteria: SmartFolderCriteria;
  createdAt: number;
}

export interface ResizeOption {
  label: string;
  value: number | undefined;
}

export type SortField = 'name' | 'size' | 'modified' | 'resolution';
export type SortDirection = 'asc' | 'desc';
/** How entries are sectioned in the list. `none` keeps folders above files. */
export type GroupBy = 'none' | 'type' | 'date';

export interface BrowserSortState {
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
}
