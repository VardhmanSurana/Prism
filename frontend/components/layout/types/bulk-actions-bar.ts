import { ViewMode } from '@/types';

export interface BulkActionsBarProps {
  selectedCount: number;
  currentView: ViewMode;
  onClear: () => void;
  onAddToAlbum: () => void;
  onRemoveFromAlbum?: () => void;
  onToggleLock: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  isFavorited?: boolean;
}
