import React, { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';
import { Person } from './types';

interface PersonDetailProps {
  person: Person;
  photos: Photo[];
  isLoading: boolean;
  onBack: () => void;
  onPhotoClick: (photo: Photo) => void;
}

export const PersonDetail: React.FC<PersonDetailProps> = ({
  person,
  photos,
  isLoading,
  onBack,
  onPhotoClick,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky Detail Header */}
      <div className="flex items-center justify-between p-6 sm:px-8 shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-20 border-b border-white/[0.03]">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-all shadow-inner border border-white/5"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg">
              <img
                src={resolveUrl(person.cover_face_thumbnail)}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{person.name}</h2>
              <p className="text-sm text-gray-400 font-medium">{photos.length} photos found</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Photos Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            onPhotoClick={onPhotoClick}
            selectedIds={new Set()}
            onToggleSelection={() => {}}
            onToggleGroupSelection={() => {}}
            scrollParentRef={scrollRef}
          />
        )}
      </div>
    </div>
  );
};
