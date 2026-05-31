import React from 'react';
import { Photo } from '../../types';

export interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleGroupSelection: (ids: string[]) => void;
  scrollParentRef?: React.RefObject<HTMLDivElement | null>;
  onSearch?: (filters: any) => void;
  onUpload?: (photos: Photo[]) => void;
  onImportProgress?: (status: any) => void;
  sortMode?: any;
  onSortChange?: (mode: any) => void;
}

export interface PhotoGridHeaderProps {
  dateKey: string;
  photoIds: string[];
  location?: string;
  selectedIds: Set<string>;
  onToggleGroupSelection: (ids: string[]) => void;
  virtualRowStart: number;
  virtualRowKey: string;
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
  virtualRowKey: string;
  virtualRowIndex: number;
  measureElement: (element: HTMLElement | null) => void;
}

export interface EmptyStateProps {
  message?: string;
}

export type RowItem =
  | { type: 'header'; dateKey: string; photoIds: string[]; location?: string }
  | { type: 'row'; photos: Photo[]; isFull: boolean };
