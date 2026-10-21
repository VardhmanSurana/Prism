import React, { useState, useCallback } from 'react';
import { ChevronRight, FolderOpen, Film, Loader2 } from 'lucide-react';
import { API_BASE } from '@/constants';
import { apiClient } from '@/services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_VISIBLE_ITEMS = 5;

interface TreeItem {
  id: number | string;
  name: string;
}

interface SidebarTreeProps {
  type: 'albums' | 'projects';
  onViewAll: () => void;
  onSelectItem: (id: number | string) => void;
}

// ponytail: simplified SidebarTree, standardized on signature Prism styling
/**
 * SidebarTree - Renders sidebar tree.
 */
export const SidebarTree: React.FC<SidebarTreeProps> = ({ type, onViewAll, onSelectItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<TreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * fetchItems - Retrieves fetch items.
   */
  const fetchItems = useCallback(async () => {
    if (items.length > 0 || isLoading) return;
    setIsLoading(true);
    try {
      if (type === 'albums') {
        const [customRes, smartRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/albums/`),
          fetch(`${API_BASE}/api/v1/albums/smart`),
        ]);
        const customData = await customRes.json();
        const smartData = await smartRes.json();
        const customAlbums = Array.isArray(customData) ? customData : [];
        const smartAlbums = Array.isArray(smartData) ? smartData : [];
        setItems([...smartAlbums, ...customAlbums]);
      } else {
        const data = await apiClient.get<TreeItem[]>('/api/v1/nle/projects');
        const list = Array.isArray(data) ? data : (data as any).projects ?? [];
        setItems(list);
      }
    } catch (e) {
      console.error(`Failed to fetch ${type}`, e);
    } finally {
      setIsLoading(false);
    }
  }, [type, items.length, isLoading]);

  /**
   * handleToggle - Handles toggle.
   */
  const handleToggle = () => {
    if (!isExpanded) fetchItems();
    setIsExpanded(!isExpanded);
  };

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hasMore = items.length > MAX_VISIBLE_ITEMS;
  const Icon = type === 'albums' ? FolderOpen : Film;

  return (
    <div className="py-1">
      <div className="w-full flex items-center gap-4 px-6 py-3 text-sm transition-colors duration-300 relative group text-gray-500 hover:text-white">
        <button
          onClick={() => onViewAll()}
          className="flex items-center gap-4 flex-1 text-left cursor-pointer"
        >
          <Icon size={18} className="text-gray-600 group-hover:text-primary/50" />
          <span className="tracking-tight font-medium">{type === 'albums' ? 'Albums' : 'Video Projects'}</span>
          {items.length > 0 && (
            <span className="ml-auto text-[10px] text-gray-600">{items.length}</span>
          )}
        </button>
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-4 h-4 cursor-pointer"
        >
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} text-gray-600 group-hover:text-gray-400`}
          />
        </button>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center gap-2 px-16 py-2 text-xs text-gray-600">
                <Loader2 size={12} className="animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <div className="pl-14">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-500 hover:text-white transition-colors rounded-lg truncate"
                  >
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
                {hasMore && (
                  <button
                    onClick={onViewAll}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-primary/80 hover:text-primary transition-colors rounded-lg"
                  >
                    Show all ({items.length})
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
