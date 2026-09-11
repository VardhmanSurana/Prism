import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, ArrowDownWideNarrow, ChevronDown, Check, BookmarkPlus, CheckCircle2 } from 'lucide-react';
import { SearchFilters, SortMode } from '@/types';
import { API_BASE } from '@/constants';

interface SearchBarProps {
  onSearch: (filters: SearchFilters | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

// ponytail: simplified SearchBar, standardized on signature Prism styling
/**
 * SearchBar - Renders search bar with match filter pills and smart album saving.
 */
export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, sortMode, onSortChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);
  const [albumSaved, setAlbumSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /**
     * handleClickOutside - Handles click outside.
     */
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * handleKeyDown - Handles key down.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!query.trim()) {
        onSearch(null);
        return;
      }
      onSearch({ query });
    }
  };

  const handleAppendFilter = (prefix: string) => {
    setQuery((prev) => {
      const next = prev ? `${prev.trim()} ${prefix}` : prefix;
      return next;
    });
    inputRef.current?.focus();
  };

  const handleSaveSmartAlbum = async () => {
    if (!query.trim() || isSavingAlbum) return;
    setIsSavingAlbum(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Smart: ${query}`,
          type: 'smart',
          is_smart: true,
          smart_rules: JSON.stringify({ query }),
        }),
      });
      if (res.ok) {
        setAlbumSaved(true);
        setTimeout(() => setAlbumSaved(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save smart album:', err);
    } finally {
      setIsSavingAlbum(false);
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
        <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-1">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
          )}
        </div>
        <input
          ref={inputRef}
          id="header-search-input"
          name="headerSearchQuery"
          aria-label="Query deep library"
          type="text"
          className="w-full bg-transparent border-b border-white/5 rounded-none py-3 pl-8 pr-12 text-sm text-gray-100 focus:border-primary/50 focus:ring-0 transition-colors 150ms ease, border-color 150ms ease font-mono placeholder:text-gray-600 placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
          placeholder="Query deep library (e.g. sunset -dog)..."
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
            <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl p-1 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
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

      {/* Match Filter Pills & Smart Album Action */}
      <div className="flex items-center gap-1.5 mt-1 px-0.5 flex-wrap">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-mono select-none">Pills:</span>
        <button
          type="button"
          onClick={() => handleAppendFilter('date:2024')}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
        >
          Date:
        </button>
        <button
          type="button"
          onClick={() => handleAppendFilter('camera:Sony')}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
        >
          Camera:
        </button>
        <button
          type="button"
          onClick={() => handleAppendFilter('person:Alice')}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
        >
          Person:
        </button>
        <button
          type="button"
          onClick={() => handleAppendFilter('-')}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors cursor-pointer border border-rose-500/20"
          title="Exclude keyword (e.g. -dog)"
        >
          Exclude:
        </button>

        {query.trim().length > 0 && (
          <button
            type="button"
            onClick={handleSaveSmartAlbum}
            disabled={isSavingAlbum}
            className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
              albumSaved
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
            }`}
            title="Save active search as Smart Album"
          >
            {albumSaved ? <CheckCircle2 size={11} /> : <BookmarkPlus size={11} />}
            <span>{albumSaved ? 'Saved Smart Album!' : 'Save as Smart Album'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
