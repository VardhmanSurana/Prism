import React, { useRef, useState } from 'react';
import { ArrowLeft, Check, X, HelpCircle } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';
import { Person } from './types';
import { usePendingFaces } from './hooks';

interface PersonDetailProps {
  person: Person;
  photos: Photo[];
  isLoading: boolean;
  onBack: () => void;
  onPhotoClick: (photo: Photo) => void;
  onRefreshPhotos?: () => void;
}

export const PersonDetail: React.FC<PersonDetailProps> = ({
  person,
  photos,
  isLoading,
  onBack,
  onPhotoClick,
  onRefreshPhotos,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pendingFaces, submitFeedback } = usePendingFaces(person.id);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const handleDecision = async (pendingId: number, decision: 'same' | 'different') => {
    setResolvingId(pendingId);
    const success = await submitFeedback(pendingId, decision);
    if (success) {
      onRefreshPhotos?.();
    }
    setResolvingId(null);
  };

  const currentPending = pendingFaces[0];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fadeIn">
      {/* Sticky Detail Header */}
      <div className="flex items-center justify-between p-6 sm:px-8 shrink-0 bg-background sticky top-0 z-20 border-b border-white/[0.03]">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-all shadow-inner border border-white/5"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg bg-surface">
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

      {/* Reconciliation Prompt Banner */}
      {pendingFaces.length > 0 && currentPending && (
        <div className="mx-6 sm:mx-8 mt-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-surface/40 to-surface/60 border border-white/[0.08] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 animate-fadeIn shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="flex items-center -space-x-3">
              {/* Existing Person Thumbnail */}
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 shadow-md z-10 bg-surface">
                <img
                  src={resolveUrl(person.cover_face_thumbnail)}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Comparison Arrow/Icon */}
              <div className="w-8 h-8 rounded-full bg-background border border-white/10 shadow-lg flex items-center justify-center z-20 text-primary">
                <HelpCircle size={14} className="animate-pulse" />
              </div>
              {/* Pending Face Thumbnail */}
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-md z-10 bg-surface">
                <img
                  src={resolveUrl(`/thumbnails/Face_Thumbnail/${currentPending.thumb_filename}`)}
                  alt="Uncertain match"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <h4 className="text-base font-semibold text-white tracking-tight">Same person?</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-md">
                Prism is uncertain if this face belongs to <span className="text-primary font-medium">{person.name}</span>. (Confidence: {Math.round(currentPending.best_score * 100)}%)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => handleDecision(currentPending.id, 'different')}
              disabled={resolvingId !== null}
              className="flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-gray-300 hover:text-white border border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <X size={14} />
              Different Person
            </button>
            <button
              onClick={() => handleDecision(currentPending.id, 'same')}
              disabled={resolvingId !== null}
              className="flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 active:scale-95 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={14} />
              Yes, Same Person
            </button>
          </div>
        </div>
      )}

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
