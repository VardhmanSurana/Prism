import { ViewMode } from '@/types';

/**
 * useBulkActions - Hook managing bulk actions state.
 */
export function useBulkActions({
  selectedCount,
  currentView,
}: {
  selectedCount: number;
  currentView: ViewMode;
}) {
  const isTrashView = currentView === 'trash';
  const isVisible = selectedCount > 0;

  return { isTrashView, isVisible };
}
