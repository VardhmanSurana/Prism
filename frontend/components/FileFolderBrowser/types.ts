export interface FileEntry {
  name: string;
  path: string;
  is_hidden: boolean;
  size_bytes?: number;
  is_image?: boolean;
  is_video?: boolean;
}

export interface FolderEntry {
  name: string;
  path: string;
  is_hidden: boolean;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface ShortcutItem {
  name: string;
  path: string;
}

export interface ResizeOption {
  label: string;
  value: number | undefined;
}