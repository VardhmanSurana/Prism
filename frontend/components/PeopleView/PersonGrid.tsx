import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, RefreshCw, EyeOff } from 'lucide-react';
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

  if (isLoading && people.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-white/10 rounded-3xl bg-surface p-8">
        <Users size={48} className="text-gray-600 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-white mb-1">No People Discovered Yet</h3>
        <p className="text-sm text-gray-400 text-center max-w-sm">
          Import photos in your library. Faces will be detected and clustered automatically here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 h-full flex flex-col overflow-hidden font-sans">
      {/* Title & Controller */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-sans font-normal text-white tracking-tight flex items-center gap-3">
            <span>{galleryStyle === 'google' ? 'People & Pets' : 'People Albums'}</span>
          </h1>
          {galleryStyle !== 'google' && (
            <p className="text-sm text-gray-400 font-medium mt-1">
              Clustered automatically using InspireFace detection
            </p>
          )}
        </div>
        {galleryStyle === 'google' ? (
          <button className="flex items-center gap-2 text-xs font-sans text-gray-300 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">
            <EyeOff size={16} />
            <span>Hide faces from memories</span>
          </button>
        ) : (
          <button
            onClick={onRefresh}
            className="p-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg flex items-center justify-center"
            title="Rescan & Refresh People"
          >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <motion.div
          layout
          className={galleryStyle === 'google' ? 
            "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3" :
            "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
          }
        >
          <AnimatePresence>
            {people.map((person) => {
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
      </div>
    </div>
  );
};
