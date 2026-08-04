import { ViewMode } from '@/types';

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
