import type { Dispatch, SetStateAction, RefObject } from 'react';
import { Photo } from '../../types';
import { SearchFilters, SortMode, ViewMode } from '../../types';

export interface ImportProgressStatus {
  is_scanning: boolean;
  total_files: number;
  processed_files: number;
  progress: number;
}

export interface PhotoGridProps {
  photos: Photo[];
  isLoading?: boolean;
  syncStatus?: ImportProgressStatus;
  currentView?: ViewMode;
  onPhotoClick: (photo: Photo) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  scrollParentRef?: RefObject<HTMLDivElement | null>;
  onSearch?: (filters: SearchFilters | null) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: ImportProgressStatus) => void;
  onUpdatePhotos?: Dispatch<SetStateAction<Photo[]>>;
  onBulkFavorite?: (selectedIds: Set<string>) => Promise<void>;
  onBulkDelete?: (selectedIds: Set<string>) => Promise<void>;
  onBulkLockToggle?: (selectedIds: Set<string>) => Promise<void>;
}

export interface PhotoGridHeaderProps {
  dateKey: string;
  photoIds: string[];
  location?: string;
  selectedIds: Set<string>;
  onToggleGroupSelection: (ids: string[]) => void;
  virtualRowStart: number;
  virtualRowKey: React.Key;
  virtualRowIndex: number;
  measureElement: (element: HTMLElement | null) => void;
}

export interface PhotoItemProps {
  photo: Photo;
  isSelected: boolean;
  isSelectionMode: boolean;
  isFullRow: boolean;
  rowHeight: number;
  rowPadding: number;
  onPhotoClick: (photo: Photo) => void;
  onToggleSelection: (id: string) => void;
}

export interface PhotoGridRowProps {
  photos: Photo[];
  isFull: boolean;
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  rowHeight: number;
  rowPadding: number;
  onPhotoClick: (photo: Photo) => void;
  onToggleSelection: (id: string) => void;
  virtualRowStart: number;
  virtualRowKey: React.Key;
  virtualRowIndex: number;
  measureElement: (element: HTMLElement | null) => void;
}


export type RowItem =
  | { type: 'header'; dateKey: string; photoIds: string[]; location?: string }
  | { type: 'row'; photos: Photo[]; isFull: boolean };

export type VirtualRowItem =
  | RowItem
  | { type: 'empty' }
  | { type: 'list-item'; photo: Photo };
