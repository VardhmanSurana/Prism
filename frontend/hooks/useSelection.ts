import { useState, useCallback, useRef } from 'react';

const EMPTY_SET: ReadonlySet<string> = new Set();

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const emptySetRef = useRef(EMPTY_SET);

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleToggleGroupSelection = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      const allSelected = ids.every(id => newSet.has(id));
      if (allSelected) {
        ids.forEach(id => newSet.delete(id));
      } else {
        ids.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds: selectedIds.size === 0 ? (emptySetRef.current as Set<string>) : selectedIds,
    setSelectedIds,
    handleToggleSelection,
    handleToggleGroupSelection,
    clearSelection
  };
}
