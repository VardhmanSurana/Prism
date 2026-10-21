import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Star, MoreVertical, Edit2, Layers, Image as ImageIcon, EyeOff } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Person } from './types';

interface PersonCardProps {
  person: Person;
  isEditing: boolean;
  editName: string;
  isFavorite?: boolean;
  onToggleFavorite?: (personId: number | string) => void;
  onClick: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onCancelRename: (e: React.MouseEvent) => void;
  onSaveRename: (e: React.MouseEvent) => void;
  onEditNameChange: (value: string) => void;
  onMerge?: (person: Person) => void;
  onSetCover?: (person: Person) => void;
  onHide?: (person: Person) => void;
}

/**
 * PersonCard - Prism 4:5 Editorial Portrait Card
 */
export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  isEditing,
  editName,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onEditNameChange,
  onMerge,
  onSetCover,
  onHide,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveRename(e as unknown as React.MouseEvent);
    }
    if (e.key === 'Escape') {
      onCancelRename(e as unknown as React.MouseEvent);
    }
  };

  const isUnnamed = person.name.startsWith('Person #') || person.name.startsWith('Cluster #');
  const personKey = person.uuid || person.id;
  const photoCount = person.photo_count || 0;
  const videoCount = person.video_count !== undefined ? person.video_count : Math.max(0, Math.floor(photoCount * 0.05));
  const location = person.primary_location;
  const yearsSpan = person.years_span || '2022 – 2024';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className="group flex flex-col rounded-xl bg-[#100e0d] hover:bg-[#211f1e] transition-all duration-300 cursor-pointer overflow-hidden p-2 select-none border border-white/[0.04] hover:border-white/[0.1] shadow-sm hover:shadow-lg relative"
    >
      {/* 4:5 Aspect Ratio Portrait Container */}
      <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden bg-[#2c2928]">
        {person.cover_face_thumbnail ? (
          <img
            src={resolveUrl(person.cover_face_thumbnail)}
            alt={person.name}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#998f8a] bg-gradient-to-b from-[#211f1e] to-[#151312]">
            <span className="text-3xl font-serif text-[#d0c4be]">
              {person.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(personKey);
          }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-[#100e0d]/80 backdrop-blur-md flex items-center justify-center transition-all duration-200 border border-white/[0.06] ${
            isFavorite
              ? 'text-[#c6c6c7] opacity-100'
              : 'text-[#998f8a] opacity-0 group-hover:opacity-100 hover:text-[#e7e1df]'
          }`}
          title={isFavorite ? 'Favorited' : 'Add to Favorites'}
        >
          <Star
            size={14}
            className={isFavorite ? 'fill-[#c6c6c7] text-[#c6c6c7]' : 'text-current'}
          />
        </button>

        {/* Location Tag Pill */}
        {location && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/85 backdrop-blur-md text-[10px] font-mono text-[#e7e1df] border border-white/[0.08] shadow-sm">
            {location}
          </div>
        )}
      </div>

      {/* Card Info & Actions */}
      <div className="flex items-start justify-between mt-2.5 px-1 pb-0.5">
        <div className="flex flex-col min-w-0 pr-1 flex-1">
          {isEditing ? (
            <div
              className="flex items-center gap-1 bg-[#1d1b1a] border border-white/20 rounded-lg p-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                className="w-full bg-transparent text-[#e7e1df] text-xs font-serif py-0.5 px-1.5 border-0 outline-none focus:ring-0 placeholder:text-[#998f8a]"
                placeholder="Enter identity name..."
                autoFocus
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                onClick={onSaveRename}
                className="p-1 text-emerald-400 hover:bg-white/10 rounded transition-colors"
                title="Save"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={onCancelRename}
                className="p-1 text-[#998f8a] hover:bg-white/10 rounded transition-colors"
                title="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <h3
                className={`font-serif text-[15px] tracking-tight truncate leading-snug transition-colors ${
                  isUnnamed
                    ? 'text-[#998f8a] italic group-hover:text-[#e7e1df]'
                    : 'text-[#e7e1df] group-hover:text-[#c6c6c7]'
                }`}
                title={person.name}
              >
                {person.name}
              </h3>
              <p className="text-[11px] font-mono text-[#998f8a] truncate mt-0.5">
                {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                {videoCount > 0 && ` · ${videoCount} ${videoCount === 1 ? 'Video' : 'Videos'}`}
              </p>
              <span className="text-[10px] font-mono text-[#7d7e7f] mt-0.5">
                {yearsSpan}
              </span>
            </>
          )}
        </div>

        {/* More Actions Dropdown */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu((prev) => !prev);
            }}
            className="w-6 h-6 rounded-full hover:bg-[#373433] flex items-center justify-center text-[#998f8a] hover:text-[#e7e1df] transition-colors mt-0.5"
            title="Options"
          >
            <MoreVertical size={16} />
          </button>

          {showContextMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(false);
                }}
              />
              <div className="absolute right-0 bottom-full mb-1.5 w-44 rounded-xl bg-[#2c2928] shadow-2xl p-1 z-50 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={(e) => {
                    setShowContextMenu(false);
                    onStartRename(e);
                  }}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#e7e1df] hover:bg-[#373433] transition-colors"
                >
                  <Edit2 size={13} className="text-[#998f8a]" />
                  <span>Rename Identity</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu(false);
                    onMerge?.(person);
                  }}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#e7e1df] hover:bg-[#373433] transition-colors"
                >
                  <Layers size={13} className="text-[#998f8a]" />
                  <span>Merge with Another</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu(false);
                    onSetCover?.(person);
                  }}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#e7e1df] hover:bg-[#373433] transition-colors"
                >
                  <ImageIcon size={13} className="text-[#998f8a]" />
                  <span>Set Cover Photo</span>
                </button>
                <div className="h-px bg-white/[0.06] my-1" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu(false);
                    onHide?.(person);
                  }}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12px] text-[#ffb4ab] hover:bg-[#93000a]/20 transition-colors"
                >
                  <EyeOff size={13} className="text-[#ffb4ab]" />
                  <span>Hide Person</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
