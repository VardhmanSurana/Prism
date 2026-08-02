import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, RefreshCw, Search, Sparkles, UserCheck, UserX, Heart } from 'lucide-react';
import { Person } from './types';
import { PersonCard } from './PersonCard';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

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
  const { galleryStyle } = useGalleryLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'named' | 'unnamed'>('all');

  // Filtered people by search query and category
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      const nameMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isUnnamed = p.name.startsWith('Person #') || p.name.startsWith('Cluster #');
      if (filterMode === 'named' && isUnnamed) return false;
      if (filterMode === 'unnamed' && !isUnnamed) return false;
      return nameMatch;
    });
  }, [people, searchQuery, filterMode]);

  // Named / Featured people for pinned top row
  const namedPeople = useMemo(() => {
    return people.filter((p) => !p.name.startsWith('Person #') && !p.name.startsWith('Cluster #'));
  }, [people]);

  if (isLoading && people.length === 0) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#06080c]">
        <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-white/40">Detecting and clustering faces...</p>
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-[#06080c] select-none">
        <div className="min-h-[400px] w-full max-w-md flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-white/[0.015] border border-white/[0.04]">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4 text-white/30">
            <Users size={28} />
          </div>
          <h3 className="text-base font-medium text-white/90 mb-1">
            No People Discovered Yet
          </h3>
          <p className="text-xs text-white/40 leading-relaxed mb-6">
            Import photos into your library. Faces will be detected and clustered automatically using local AI face recognition.
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0a84ff] hover:bg-[#0077e6] transition-all shadow-md"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Scan Library for Faces</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#06080c] overflow-y-auto px-4 md:px-8 py-6 select-none font-sans">
      {/* Top Header & Search Bar */}
      <div className="max-w-7xl mx-auto w-full mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
                People & Pets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono tabular-nums bg-white/[0.06] text-white/60 border border-white/[0.08]">
                {people.length} {people.length === 1 ? 'person' : 'people'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles size={12} />
                <span>InspireFace AI</span>
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1.5">
              Faces are automatically clustered on-device. Tap any person to view their photos or assign a name.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] text-white text-xs font-sans rounded-xl pl-9 pr-3 py-2 border border-white/[0.08] focus:border-white/30 focus:bg-white/[0.06] outline-none transition-all placeholder:text-white/30"
              />
            </div>

            {/* Filter Pill Toggle */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMode === 'all'
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('named')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMode === 'named'
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                Named ({namedPeople.length})
              </button>
            </div>

            {/* Rescan Button */}
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.08] transition-all"
              title="Rescan & Refresh People"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>
        </div>

        {/* Featured Named People Carousel (Apple Photos style top section) */}
        {!searchQuery && filterMode === 'all' && namedPeople.length > 0 && (
          <div className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Heart size={12} className="text-rose-400 fill-rose-400/20" />
                <span>Pinned & Named</span>
              </span>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              {namedPeople.map((person) => {
                const personKey = person.uuid || person.id;
                return (
                  <motion.div
                    key={`featured-${personKey}`}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onPersonClick(person)}
                    className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-blue-400/80 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 relative bg-[#0a0c10]">
                      <img
                        src={person.cover_face_thumbnail ? `${person.cover_face_thumbnail}` : ''}
                        alt={person.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/80 group-hover:text-white truncate max-w-[90px] text-center">
                      {person.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Container */}
      <div className="max-w-7xl mx-auto w-full flex-1">
        {filteredPeople.length === 0 ? (
          <div className="py-12 text-center text-white/40 text-xs font-mono">
            No people matching "{searchQuery}"
          </div>
        ) : (
          <motion.div
            layout
            className={
              galleryStyle === 'google'
                ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3.5 pb-12'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-12'
            }
          >
            <AnimatePresence>
              {filteredPeople.map((person) => {
                const personKey = person.uuid || person.id;
                const isEdit = editingId === person.id || (person.uuid && editingId === person.uuid);
                return (
                  <PersonCard
                    key={personKey}
                    person={person}
                    isEditing={!!isEdit}
                    editName={isEdit ? editName : ''}
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
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};
