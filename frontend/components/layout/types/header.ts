import { Photo, SearchFilters, SortMode } from '@/types';

export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  onUpload: (photos: Photo[]) => void;
  onImportProgress: (status: {
    is_scanning: boolean;
    total_files: number;
    processed_files: number;
    progress: number;
  }) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  syncStatus: {
    is_scanning: boolean;
    total_files: number;
    processed_files: number;
    progress: number;
  };
}
