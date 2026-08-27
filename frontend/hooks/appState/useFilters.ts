import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewMode, SearchFilters, SortMode } from '../../types';

/**
 * useFilters - Hook managing filters.
 */
export function useFilters() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = (location.pathname.split('/')[1] || 'gallery') as ViewMode;

  /**
   * setCurrentView - Performs set current view.
   */
  const setCurrentView = (v: ViewMode, onClearContext?: () => void) => {
    navigate(`/${v === 'gallery' ? '' : v}`);
    onClearContext?.();
  };

  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [isChatOpen, setIsChatOpen] = useState(false);

  return {
    currentView,
    setCurrentView,
    activeFilters,
    setActiveFilters,
    sortMode,
    setSortMode,
    isChatOpen,
    setIsChatOpen
  };
}
