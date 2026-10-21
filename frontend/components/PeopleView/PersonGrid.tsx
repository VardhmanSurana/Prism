import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, ChevronDown, Check, X,
  LayoutGrid, List, Network, Sparkles, CheckCheck,
  ChevronLeft, ChevronRight, UserPlus, EyeOff, Radio
} from 'lucide-react';
import { Person } from './types';
import { PersonCard } from './PersonCard';
import { resolveUrl } from '../../constants';

interface PersonGridProps {
  people: Person[];
  isLoading: boolean;
  editingId: number | string | null;
  editName: string;
  onPersonClick: (person: Person) => void;
  onRefresh: () => void;
  onStartRename: (person: Person) => void;
  onCancelRename: () => void;
  onSaveRename: (personId: number | string) => void;
  onEditNameChange: (value: string) => void;
}

export type CategoryFilter = 'all' | 'favorites' | 'family' | 'studio' | 'uncategorized';
export type SortMode = 'most_photos' | 'name_asc' | 'recently_added';
export type ViewMode = 'grid' | 'list' | 'cluster';

export interface PendingTriageCard {
  id: string | number;
  candidateName: string;
  matchScore: number;
  thumbnail: string;
  contextTag: string;
  shotCount: number;
  personId?: number | string;
}

/**
 * PersonGrid - Prism Confirmed Identities & Face Triage Studio
 */
export const PersonGrid: React.FC<PersonGridProps> = ({
  people,
  isLoading,
  editingId,
  editName,
  onPersonClick,
  onRefresh,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onEditNameChange,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('most_photos');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isTriageCollapsed, setIsTriageCollapsed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Local favorites persistence
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('prism_favorite_people');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (personId: number | string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      const key = String(personId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('prism_favorite_people', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Failed to save favorite people', e);
      }
      return next;
    });
  };

  // Seed / mock pending face clusters for triage row (simulating InspireFace background queue)
  const [pendingTriage, setPendingTriage] = useState<PendingTriageCard[]>(() => [
    {
      id: 'triage-1',
      candidateName: 'Pulkit',
      matchScore: 98.4,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLjRhkTMbNum1le5_C0M0SRAD2mRr44fyOmTgAn9axDxUrFrdmpZQcMmGuuM7j9ovxCDgNSnmUfM6Ifgo4k3fQzu6BcpFoLWx5B6J1IxE0GWQFOjnMYhZ-uYYf6itscNuavfuepm4_-twnr8lbJ14b8XFbsxdiYBgLF1ljVgqzd8npG1M1oBoUHfEuoUCDbzgeYkZ71Vzh8g4oqcLm1VW67bkzc8xXs6DLi_8ZHGApExqXLFPLZfoZPQ',
      contextTag: 'Chitrakote Trip',
      shotCount: 24,
    },
    {
      id: 'triage-2',
      candidateName: 'Manvik',
      matchScore: 96.2,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8lOMso2FjBtpzbhqsGChhxO92P1c3v4pCbP97KrWLQFuED5chUSuAcht2igP8DW2JwzlzQXE8dbyfojRrzgsudWwxIqGtMUKM-iTW8t54T4BsJuLwfGwh4W6ZOvvIoTvHeM-NBZHov0QtMcCMUcJecpJfn_C8r39CxHLxHvalZkwQ8lVlXZ2K-R2LWuCtRX0eC8W7pOPMDCuYUJ2OKKhpOM9J1kmm8aOwGCoJk2ZQ_LoiGPDGclUZcQ',
      contextTag: 'Geedam Wedding',
      shotCount: 18,
    },
    {
      id: 'triage-3',
      candidateName: 'Elena Rostova',
      matchScore: 94.8,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKh9nJCmuGEf4-elrxVVkXtrZqppUO1aBWi3BGg_22lXTLQbg8JJJIBNcasFIdXk2FirjCcy8FtWhJ_jBY7FDereDUVFBGUNvpiA__1NQWheSR-VVZGozrW16Euv8ZL2rIRQfhRdUqhpsjcDPV-I2SnFm2fmGITMmg--Ac4hdlHEoJ_mVdHCDlXnLshjFff3xJnR9YnS5sByW9iFEzBjj-5h7NVdszdSesTn0vRCbpMPZky4icK23nWg',
      contextTag: 'Studio Session #4',
      shotCount: 12,
    },
    {
      id: 'triage-4',
      candidateName: 'Aarav Sharma',
      matchScore: 91.5,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPDVhwkS2vvxLLr8aY7DHKpIgvhg5jkajzOzE82MHCwzbKJZOjbdvWgxzvh8TjfbAvzxnZYJPsLgeZBRosx-sqfHFr2PpOXgfkwl2fyiqR4pwwUs6e_ICftKNZaj_TToRX-lhuv2X2ZFyIZHWpChoEljKOJF0s1bDO_jES6DBmNArrCqVUfVsYTZXRURp5VxSBkxkxIR04Uniaw6O7gTlUxHQkHokbFj6QOhvjHmfmPSY6QXzCUgTUew',
      contextTag: 'River Excursion',
      shotCount: 9,
    },
  ]);

  // Track ref for horizontal scrolling
  const triageTrackRef = useRef<HTMLDivElement>(null);

  // Sync triage candidates with loaded people if candidate matches existing person
  useEffect(() => {
    if (people.length > 0) {
      setPendingTriage((prev) =>
        prev.map((card) => {
          const match = people.find(
            (p) => p.name.toLowerCase() === card.candidateName.toLowerCase()
          );
          if (match && match.cover_face_thumbnail) {
            return {
              ...card,
              personId: match.uuid || match.id,
              thumbnail: match.cover_face_thumbnail ? resolveUrl(match.cover_face_thumbnail) : card.thumbnail,
            };
          }
          return card;
        })
      );
    }
  }, [people]);

  // Handle triage actions
  const handleConfirmTriage = (id: string | number) => {
    setPendingTriage((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDismissTriage = (id: string | number) => {
    setPendingTriage((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAcceptAllHighConfidence = () => {
    setPendingTriage([]);
  };

  const handleScrollTriage = (direction: 'left' | 'right') => {
    if (triageTrackRef.current) {
      const offset = direction === 'left' ? -280 : 280;
      triageTrackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleTriggerScan = () => {
    setIsScanning(true);
    onRefresh();
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  };

  // Filter & Sort Logic
  const filteredAndSortedPeople = useMemo(() => {
    let result = [...people];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Category filter
    if (categoryFilter === 'favorites') {
      result = result.filter((p) => favoriteIds.has(String(p.uuid || p.id)) || p.is_favorite);
    } else if (categoryFilter === 'family') {
      result = result.filter(
        (p) =>
          p.category === 'family' ||
          p.name.toLowerCase().includes('manvik') ||
          p.name.toLowerCase().includes('pulkit')
      );
    } else if (categoryFilter === 'studio') {
      result = result.filter(
        (p) =>
          p.category === 'studio' ||
          p.name.toLowerCase().includes('elena') ||
          p.name.toLowerCase().includes('marco') ||
          p.name.toLowerCase().includes('sofia')
      );
    } else if (categoryFilter === 'uncategorized') {
      result = result.filter(
        (p) =>
          p.name.startsWith('Person #') ||
          p.name.startsWith('Cluster #') ||
          p.category === 'uncategorized'
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortMode === 'most_photos') {
        return (b.photo_count || 0) - (a.photo_count || 0);
      }
      if (sortMode === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === 'recently_added') {
        const idA = typeof a.id === 'number' ? a.id : 0;
        const idB = typeof b.id === 'number' ? b.id : 0;
        return idB - idA;
      }
      return 0;
    });

    return result;
  }, [people, searchQuery, categoryFilter, sortMode, favoriteIds]);

  const sortLabel = useMemo(() => {
    switch (sortMode) {
      case 'most_photos':
        return 'Sort: Most Photos';
      case 'name_asc':
        return 'Sort: Name A-Z';
      case 'recently_added':
        return 'Sort: Recently Added';
    }
  }, [sortMode]);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#151312] overflow-y-auto px-4 md:px-8 py-6 select-none relative font-sans text-[#e7e1df]">
      {/* ── Atmospheric Ambient Canvas Backlights ── */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-[#2c2928]/25 blur-[130px]" />
        <div className="absolute top-[45%] -left-32 w-[600px] h-[600px] rounded-full bg-[#373433]/20 blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col gap-6 pb-12">
        {/* ── 1. Sticky Action & Telemetry Bar ── */}
        <section className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-[#151312]/90 backdrop-blur-2xl border-b border-white/[0.05] shadow-md transition-all">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Title & Identified Telemetry */}
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <h1 className="font-serif text-2xl md:text-3xl text-[#e7e1df] tracking-tight leading-none font-normal">
                  People
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-[#a8a29e] font-mono">
                  <span className="text-[#d0c4be]">{people.length} Identified</span>
                  <span className="text-[#998f8a] opacity-50">/</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#c6c6c7]/10 text-[#c6c6c7] text-[11px] font-medium border border-white/[0.06]">
                    {pendingTriage.length} Pending Triage
                  </span>
                </div>
              </div>
            </div>

            {/* Controls: Search, Sort, View Modes, Scan Library */}
            <div className="flex items-center gap-2.5 flex-wrap ml-auto">
              {/* Search Bar */}
              <div className="relative w-44 sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#998f8a] pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search people... ⌘K"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#100e0d] text-[#e7e1df] text-xs font-sans rounded-full pl-8 pr-3 py-1.5 border border-white/[0.08] focus:border-white/30 focus:bg-[#1d1b1a] outline-none transition-all placeholder:text-[#998f8a]"
                />
              </div>

              {/* Sort Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1d1b1a] text-[#e7e1df] text-xs font-medium hover:bg-[#211f1e] border border-white/[0.08] transition-colors"
                >
                  <span className="text-[12px]">{sortLabel}</span>
                  <ChevronDown size={14} className="text-[#998f8a]" />
                </button>

                {isSortDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsSortDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#2c2928] shadow-2xl p-1.5 z-50 border border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setSortMode('most_photos');
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          sortMode === 'most_photos'
                            ? 'bg-[#373433] text-[#e7e1df] font-medium'
                            : 'text-[#d0c4be] hover:bg-[#373433]'
                        }`}
                      >
                        Most Photos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortMode('name_asc');
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          sortMode === 'name_asc'
                            ? 'bg-[#373433] text-[#e7e1df] font-medium'
                            : 'text-[#d0c4be] hover:bg-[#373433]'
                        }`}
                      >
                        Name A-Z
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortMode('recently_added');
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          sortMode === 'recently_added'
                            ? 'bg-[#373433] text-[#e7e1df] font-medium'
                            : 'text-[#d0c4be] hover:bg-[#373433]'
                        }`}
                      >
                        Recently Added
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center p-0.5 rounded-full bg-[#100e0d] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-full transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#2c2928] text-[#e7e1df]'
                      : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-full transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[#2c2928] text-[#e7e1df]'
                      : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                  title="List View"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cluster')}
                  className={`p-1.5 rounded-full transition-colors ${
                    viewMode === 'cluster'
                      ? 'bg-[#2c2928] text-[#e7e1df]'
                      : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                  title="Cluster Topology"
                >
                  <Network size={14} />
                </button>
              </div>

              {/* Scan Library Action */}
              <button
                type="button"
                onClick={handleTriggerScan}
                disabled={isScanning || isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#c6c6c7] text-[#2f3131] hover:bg-[#e2e2e2] text-xs font-medium transition-all shadow-sm group disabled:opacity-50 cursor-pointer"
              >
                <Radio
                  size={14}
                  className={`transition-transform duration-700 ${
                    isScanning ? 'animate-spin text-[#151312]' : 'group-hover:rotate-180'
                  }`}
                />
                <span className="leading-none text-[12px] font-medium">Scan Library</span>
                <span className="text-[9px] opacity-75 font-mono px-1 py-0.5 rounded bg-black/10 leading-none">
                  {isScanning ? 'Scanning...' : 'Idle'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. Main Section: Confirmed People Grid ── */}
        <section className="flex flex-col gap-4">
          {/* Sub-Header & Category Filter Rail */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                Confirmed Identities
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#211f1e] text-[#a8a29e] text-xs font-mono border border-white/[0.04]">
                {filteredAndSortedPeople.length} People
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'favorites', label: 'Favorites ⭐' },
                  { id: 'family', label: 'Family' },
                  { id: 'studio', label: 'Clients & Studio' },
                  { id: 'uncategorized', label: 'Uncategorized' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm border border-white/[0.08]'
                      : 'bg-[#1d1b1a] text-[#998f8a] hover:text-[#e7e1df] hover:bg-[#211f1e] border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Render */}
          {isLoading && people.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/20 border-t-[#c6c6c7] rounded-full animate-spin mb-4" />
              <p className="text-xs font-mono text-[#998f8a]">Detecting and clustering faces...</p>
            </div>
          ) : filteredAndSortedPeople.length === 0 ? (
            <div className="py-16 text-center text-[#998f8a] text-xs font-mono bg-[#100e0d] border border-white/[0.04] rounded-2xl p-8">
              No identities matching "{searchQuery}" under {categoryFilter}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              <AnimatePresence>
                {filteredAndSortedPeople.map((person) => {
                  const personKey = person.uuid || person.id;
                  const isEdit = editingId === person.id || (person.uuid && editingId === person.uuid);
                  const isFav = favoriteIds.has(String(personKey)) || Boolean(person.is_favorite);

                  return (
                    <PersonCard
                      key={personKey}
                      person={person}
                      isEditing={Boolean(isEdit)}
                      editName={isEdit ? editName : ''}
                      isFavorite={isFav}
                      onToggleFavorite={toggleFavorite}
                      onClick={() => onPersonClick(person)}
                      onStartRename={(e) => {
                        e.stopPropagation();
                        onStartRename(person);
                      }}
                      onCancelRename={(e) => {
                        e.stopPropagation();
                        onCancelRename();
                      }}
                      onSaveRename={(e) => {
                        e.stopPropagation();
                        onSaveRename(personKey);
                      }}
                      onEditNameChange={onEditNameChange}
                      onMerge={(p) => {
                        console.log('Merge requested for', p.name);
                      }}
                      onSetCover={(p) => {
                        console.log('Set cover requested for', p.name);
                      }}
                      onHide={(p) => {
                        console.log('Hide requested for', p.name);
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ── 3. Pending Face Clusters: Requires Confirmation (Triage Section) ── */}
        {pendingTriage.length > 0 && (
          <section className="flex flex-col gap-3 p-5 rounded-2xl bg-[#100e0d] border border-white/[0.05] shadow-xl relative overflow-hidden mt-4">
            {/* Ambient light bloom inside card */}
            <div className="absolute -top-24 right-1/3 w-80 h-40 bg-[#2c2928]/30 rounded-full blur-[80px] pointer-events-none" />

            {/* Triage Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif text-lg md:text-xl text-[#e7e1df] tracking-tight font-normal">
                    Pending Face Clusters
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#c6c6c7]/10 text-[#c6c6c7] text-[11px] font-mono border border-white/[0.06]">
                    {pendingTriage.length} Pending Triage
                  </span>
                </div>
                <p className="text-xs text-[#a8a29e] mt-1 max-w-2xl leading-relaxed">
                  Review clustered faces detected across recent imports and assign or merge them with confirmed people.
                </p>
              </div>

              {/* Triage Header Actions */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleAcceptAllHighConfidence}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium transition-colors border border-white/[0.06] cursor-pointer"
                >
                  <CheckCheck size={14} className="text-[#c6c6c7]" />
                  <span>Accept High Confidence</span>
                </button>

                {/* Micro-scroll pagination */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleScrollTriage('left')}
                    className="w-7 h-7 rounded-full bg-[#1d1b1a] hover:bg-[#211f1e] flex items-center justify-center text-[#e7e1df] transition-colors border border-white/[0.04]"
                    title="Previous"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollTriage('right')}
                    className="w-7 h-7 rounded-full bg-[#1d1b1a] hover:bg-[#211f1e] flex items-center justify-center text-[#e7e1df] transition-colors border border-white/[0.04]"
                    title="Next"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Collapse / Expand Toggle */}
                <button
                  type="button"
                  onClick={() => setIsTriageCollapsed((prev) => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1d1b1a] hover:bg-[#211f1e] text-[#a8a29e] hover:text-[#e7e1df] text-xs font-medium transition-colors border border-white/[0.06] cursor-pointer"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      isTriageCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <span>{isTriageCollapsed ? 'Expand' : 'Collapse'}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Container */}
            {!isTriageCollapsed && (
              <div
                ref={triageTrackRef}
                className="z-10 pt-2 flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none"
              >
                {pendingTriage.map((card) => (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-[210px] shrink-0 flex flex-col p-2.5 rounded-xl bg-[#1d1b1a] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                  >
                    {/* Card 4:5 Thumbnail with confidence pill */}
                    <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden bg-[#2c2928]">
                      <img
                        src={card.thumbnail}
                        alt={card.candidateName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/85 backdrop-blur-md text-[10px] font-mono text-[#c6c6c7] flex items-center gap-1 border border-white/[0.08]">
                        <Sparkles size={11} className="text-[#c6c6c7]" />
                        <span>{card.matchScore}% Match</span>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/85 backdrop-blur-md text-[10px] font-mono text-[#e7e1df] truncate max-w-[90%] border border-white/[0.06]">
                        {card.contextTag} · {card.shotCount} shots
                      </div>
                    </div>

                    {/* Candidate Identity Prompt */}
                    <div className="flex flex-col mt-2.5">
                      <div className="flex items-center justify-between w-full px-2 py-1 rounded-md bg-[#2c2928] text-[#e7e1df] text-xs font-serif">
                        <span className="truncate">Is this {card.candidateName}?</span>
                        <ChevronDown size={14} className="text-[#998f8a] shrink-0 ml-1" />
                      </div>

                      {/* Confirm / Reject Actions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmTriage(card.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-[#c6c6c7] text-[#2f3131] hover:bg-[#e2e2e2] text-xs font-medium transition-colors shadow-sm cursor-pointer"
                          title="Confirm Identity"
                        >
                          <Check size={13} />
                          <span>Confirm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissTriage(card.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-[#2c2928] hover:bg-[#93000a]/20 text-[#998f8a] hover:text-[#ffb4ab] transition-colors cursor-pointer"
                          title="Reject Match"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Unidentified Cluster Card */}
                <div className="w-[210px] shrink-0 flex flex-col p-2.5 rounded-xl bg-[#151312] border border-dashed border-white/[0.1] hover:border-white/[0.2] transition-all justify-between">
                  <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden bg-[#1d1b1a] flex flex-col items-center justify-center text-center p-3">
                    <div className="w-12 h-12 rounded-full bg-[#2c2928] flex items-center justify-center mb-2 text-[#998f8a]">
                      <UserPlus size={22} />
                    </div>
                    <span className="text-xs font-serif text-[#e7e1df] leading-tight">
                      Unidentified Cluster
                    </span>
                    <span className="text-[10px] font-mono text-[#a8a29e] mt-1">
                      15 unassigned faces in Import #409
                    </span>
                  </div>

                  <div className="flex flex-col mt-2.5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Create identity clicked');
                      }}
                      className="flex items-center justify-center gap-1 w-full px-2 py-1 rounded-md bg-[#2c2928] text-[#e7e1df] text-xs font-medium hover:bg-[#373433] transition-colors border border-white/[0.06] cursor-pointer"
                    >
                      <UserPlus size={13} className="text-[#c6c6c7]" />
                      <span>Create Identity</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Ignore cluster clicked');
                      }}
                      className="flex items-center justify-center gap-1 w-full py-1 rounded-md bg-transparent hover:bg-[#211f1e] text-[#998f8a] hover:text-[#e7e1df] text-xs transition-colors cursor-pointer"
                    >
                      <EyeOff size={13} />
                      <span>Ignore</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
