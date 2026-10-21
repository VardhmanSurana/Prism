import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, ArrowDownWideNarrow, ChevronDown, Check } from 'lucide-react';
import { SearchFilters, SortMode } from '@/types';

interface SearchBarProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

/**
 * SearchBar - Renders Prism search input with ⌘K badge and sort controls.
 */
export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, sortMode, onSortChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
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
    <div className="flex-1 max-w-2xl mx-auto">
      <div className="relative flex items-center w-full group">
        <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-[#78716c]">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#f5f5f4]" />
          ) : (
            <Search className="h-4 w-4 text-[#78716c] group-focus-within:text-[#f5f5f4] transition-colors" />
          )}
        </div>

        <input
          ref={inputRef}
          id="header-search-input"
          name="headerSearchQuery"
          aria-label="Query deep library"
          type="text"
          className="w-full h-10 pl-10 pr-24 rounded-full bg-[#151312] border border-[#292524] text-[#f5f5f4] text-xs sm:text-sm placeholder:text-[#78716c] transition-all duration-200 focus:border-[#57534e] focus:bg-[#1c1917] focus:outline-none focus:ring-1 focus:ring-[#78716c]/40 font-sans"
          placeholder="Search portfolio, archival tags, locations... (Query deep library)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="absolute right-2.5 inset-y-0 flex items-center gap-1.5" ref={sortMenuRef}>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#23201e] border border-[#322e2b] font-mono text-[10px] text-[#a8a29e] pointer-events-none select-none">
            ⌘K
          </span>

          <button
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
              isSortOpen ? 'text-white bg-[#23201e]' : 'text-[#78716c] hover:text-[#f5f5f4]'
            }`}
            title="Sort options"
          >
            <ArrowDownWideNarrow size={14} />
            <ChevronDown size={11} className={`transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSortOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-[#181514] border border-[#292524] rounded-xl shadow-2xl p-1 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="px-3 py-2 text-[10px] font-mono font-bold text-[#78716c] uppercase tracking-widest border-b border-[#292524] mb-1">
                Sort by
              </div>
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSortChange(option.value);
                    setIsSortOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer active:scale-[0.98] ${
                    sortMode === option.value
                      ? 'bg-[#23201e] text-[#f5f5f4] font-medium'
                      : 'text-[#a8a29e] hover:bg-[#23201e] hover:text-[#f5f5f4]'
                  }`}
                >
                  {option.label}
                  {sortMode === option.value && <Check size={14} className="text-[#f5f5f4]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
