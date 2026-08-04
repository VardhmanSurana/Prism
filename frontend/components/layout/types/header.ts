import { SearchFilters, SortMode } from '@/types';

export interface HeaderProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}
