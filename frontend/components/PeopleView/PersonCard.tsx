import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Check, X, User } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Person } from './types';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

interface PersonCardProps {
  person: Person;
  isEditing: boolean;
  editName: string;
  onClick: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onCancelRename: (e: React.MouseEvent) => void;
  onSaveRename: (e: React.MouseEvent) => void;
  onEditNameChange: (value: string) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  isEditing,
  editName,
  onClick,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onEditNameChange,
}) => {
  const { galleryStyle } = useGalleryLayout();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveRename(e as unknown as React.MouseEvent);
    }
    if (e.key === 'Escape') {
      onCancelRename(e as unknown as React.MouseEvent);
    }
  };

  const isUnnamed = person.name.startsWith('Person #') || person.name.startsWith('Cluster #');

  if (galleryStyle === 'google') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={onClick}
        className="group relative cursor-pointer aspect-square rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0a0c10] hover:border-white/20 transition-all duration-200"
      >
        {person.cover_face_thumbnail ? (
          <img
            src={resolveUrl(person.cover_face_thumbnail)}
            alt={person.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.03] text-white/30">
            <User size={32} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-end pointer-events-none">
          <span className="font-sans font-medium text-white text-xs tracking-tight truncate drop-shadow-md">
            {person.name}
          </span>
          <span className="text-[10px] font-mono text-white/50 tabular-nums">
            {person.photo_count} {person.photo_count === 1 ? 'photo' : 'photos'}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className="group relative cursor-pointer bg-[#0a0c10] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03] rounded-2xl p-4.5 transition-all duration-200 flex flex-col items-center justify-center text-center select-none"
    >
      {/* Circular Avatar with Edge Glow */}
      <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-blue-400/70 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300 shadow-xl relative mb-3 bg-white/[0.03]">
        {person.cover_face_thumbnail ? (
          <img
            src={resolveUrl(person.cover_face_thumbnail)}
            alt={person.name}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <User size={32} />
          </div>
        )}
      </div>

      {/* Name / Inline Renaming */}
      <div className="w-full px-1" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <div className="flex items-center gap-1 bg-white/[0.06] border border-white/20 rounded-xl p-1 shadow-md">
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="w-full bg-transparent text-white text-xs font-medium py-1 px-2 border-0 outline-none focus:ring-0 placeholder:text-white/30"
              placeholder="Enter name..."
              autoFocus
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              onClick={onSaveRename}
              className="p-1 text-emerald-400 hover:bg-white/10 rounded-lg transition-colors"
              title="Save name"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="p-1 text-white/40 hover:bg-white/10 rounded-lg transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 group/name">
            <span
              className={`font-semibold text-xs sm:text-sm tracking-tight truncate max-w-[130px] transition-colors ${
                isUnnamed
                  ? 'text-white/50 group-hover:text-white/80 italic'
                  : 'text-white/90 group-hover:text-white'
              }`}
            >
              {person.name}
            </span>
            <button
              type="button"
              onClick={onStartRename}
              className="opacity-0 group-hover/name:opacity-100 p-1 text-white/40 hover:text-white rounded-lg transition-all"
              title="Rename Person"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Photo Count */}
      <span className="text-[10px] font-mono text-white/40 tabular-nums mt-1">
        {person.photo_count} {person.photo_count === 1 ? 'photo' : 'photos'}
      </span>
    </motion.div>
  );
};
