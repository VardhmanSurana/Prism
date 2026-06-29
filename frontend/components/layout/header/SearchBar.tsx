import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, ArrowDownWideNarrow, ChevronDown, Check } from 'lucide-react';
import { SearchFilters, SortMode } from '@/types';

interface SearchBarProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, sortMode, onSortChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!query.trim()) {
        onSearch(null);
        return;
      }
      onSearch({ query });
    }
  };

  const sortOptions: { label: string; value: SortMode }[] = [
    { label: 'Newest first', value: 'newest' },
    { label: 'Oldest first', value: 'oldest' },
    { label: 'Recently added', value: 'added' },
  ];

  return (
    <div className="flex-1 max-w-xl">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
          )}
        </div>
        <input
          type="text"
          className="w-full bg-transparent border-b border-white/5 rounded-none py-3 pl-8 pr-12 text-sm text-gray-100 focus:border-primary/50 focus:ring-0 transition-all font-mono placeholder:text-gray-600 placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
          placeholder="Query deep library..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute inset-y-0 right-0 pr-1 flex items-center" ref={sortMenuRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${isSortOpen ? 'text-primary' : 'text-gray-500 hover:text-white'}`}
            title="Sort options"
          >
            <ArrowDownWideNarrow size={16} />
            <ChevronDown size={12} className={`transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSortOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl p-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-border/50 mb-1">
                Sort by
              </div>
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setIsSortOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors active:scale-[0.98]
                    ${sortMode === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-gray-300 hover:bg-surfaceHover'}
                  `}
                >
                  {option.label}
                  {sortMode === option.value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
