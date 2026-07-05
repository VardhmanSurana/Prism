import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Check, X } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Person } from './types';

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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveRename(e as unknown as React.MouseEvent);
    }
    if (e.key === 'Escape') {
      onCancelRename(e as unknown as React.MouseEvent);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className="group relative cursor-pointer bg-surface border border-white/5 rounded-3xl p-5 hover:bg-surfaceHover hover:border-white/10 hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center text-center"
    >
      {/* Circular Avatar with Glowing Edge */}
      <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--color-primary),0.3)] transition-all duration-500 shadow-2xl relative mb-4">
        <img
          src={resolveUrl(person.cover_face_thumbnail)}
          alt={person.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
      </div>

      {/* Inline Renaming Box */}
      <div className="w-full px-1" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <div className="flex items-center gap-1.5 bg-[#111] border border-white/10 rounded-xl p-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="w-full bg-transparent text-white text-xs font-semibold py-1 px-2 border-0 outline-none focus:ring-0"
              autoFocus
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={onSaveRename}
              className="p-1 text-primary hover:bg-white/5 rounded-lg transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onCancelRename}
              className="p-1 text-gray-500 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 group/name">
            <span className="font-bold text-white text-sm tracking-tight truncate max-w-[120px] group-hover:text-primary transition-colors">
              {person.name}
            </span>
            <button
              onClick={onStartRename}
              className="opacity-0 group-hover/name:opacity-100 p-1 text-gray-500 hover:text-white rounded-lg transition-all"
              title="Rename Person"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
      </div>

      <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase mt-1">
        {person.photo_count} {person.photo_count === 1 ? 'photo' : 'photos'}
      </span>
    </motion.div>
  );
};
