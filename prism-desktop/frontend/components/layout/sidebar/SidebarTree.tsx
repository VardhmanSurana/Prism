import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, FolderOpen, Film, Loader2 } from 'lucide-react';
import { API_BASE } from '@/constants';
import { apiClient } from '@/services/apiClient';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';
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

export const SidebarTree: React.FC<SidebarTreeProps> = ({ type, onViewAll, onSelectItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<TreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { galleryStyle } = useGalleryLayout();

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

  const handleToggle = () => {
    if (!isExpanded) fetchItems();
    setIsExpanded(!isExpanded);
  };

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hasMore = items.length > MAX_VISIBLE_ITEMS;
  const Icon = type === 'albums' ? FolderOpen : Film;

  if (galleryStyle === 'google') {
    return (
      <div className="py-1">
        <div className="w-full flex items-center gap-3 px-4 py-2 text-xs font-sans text-[#C4C6D0] hover:bg-white/10 hover:text-white transition-colors rounded-full group">
          <button
            onClick={() => onViewAll()}
            className="flex items-center gap-3 flex-1 text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">
              {type === 'albums' ? 'photo_album' : 'movie'}
            </span>
            <span>{type === 'albums' ? 'Albums' : 'Video Projects'}</span>
            {items.length > 0 && (
              <span className="ml-auto text-[10px] text-gray-500">{items.length}</span>
            )}
          </button>
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-4 h-4 cursor-pointer"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
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
                <div className="flex items-center gap-2 px-10 py-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="pl-10">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem(item.id)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-[#C4C6D0] hover:bg-white/10 hover:text-white transition-colors rounded-full truncate"
                    >
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                  {hasMore && (
                    <button
                      onClick={onViewAll}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-[#8AB4F8] hover:bg-white/10 transition-colors rounded-full"
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
  }

  return (
    <div className="py-1">
      <div className={`w-full flex items-center gap-4 px-6 py-3 text-sm transition-all duration-300 relative group text-gray-500 hover:text-white`}>
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
