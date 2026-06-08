import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewMode, SearchFilters, SortMode } from '../../types';

const THEMES = ['theme-purple', 'theme-green', 'theme-orange', 'theme-rose'];

export function useFilters() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = (location.pathname.split('/')[1] || 'gallery') as ViewMode;

  const setCurrentView = (v: ViewMode, onClearContext?: () => void) => {
    navigate(`/${v === 'gallery' ? '' : v}`);
    onClearContext?.();
  };

  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [theme, setTheme] = useState('default');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove(...THEMES);
    if (theme !== 'default') html.classList.add(theme);
  }, [theme]);

  return {
    currentView,
    setCurrentView,
    activeFilters,
    setActiveFilters,
    sortMode,
    setSortMode,
    theme,
    setTheme,
    isChatOpen,
    setIsChatOpen
  };
}
