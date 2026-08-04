import React, { useRef, useState } from 'react';
import { ArrowLeft, Check, X, Sparkles, HelpCircle } from 'lucide-react';
import { resolveUrl } from '../../constants';
import { Photo } from '../../types';
import { PhotoGrid } from '../PhotoGrid';
import { Person } from './types';
import { usePendingFaces } from './hooks';
import { useTelemetry } from '../../hooks/useTelemetry';

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
  const { logAction } = useTelemetry();

  const handleDecision = async (pendingId: number, decision: 'same' | 'different') => {
    setResolvingId(pendingId);
    logAction('PeopleView', 'face_decision', { personId: person.id, personName: person.name, decision });
    const success = await submitFeedback(pendingId, decision);
    if (success) {
      onRefreshPhotos?.();
    }
    setResolvingId(null);
  };

  const currentPending = pendingFaces[0];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#06080c] select-none font-sans">
      {/* Sticky Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-[#06080c]/90 backdrop-blur-md sticky top-0 z-20 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.08] transition-all"
            title="Back to all people"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500/40 shadow-lg bg-[#0a0c10]">
              <img
                src={resolveUrl(person.cover_face_thumbnail)}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">{person.name}</h2>
              <span className="text-xs font-mono text-white/40 tabular-nums">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'} found
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Face Reconciliation Prompt Banner */}
      {pendingFaces.length > 0 && currentPending && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-white/[0.02] to-white/[0.04] border border-blue-500/20 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 transition-all shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex items-center -space-x-3">
              {/* Existing Cover Portrait */}
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500/60 shadow-md z-10 bg-[#0a0c10]">
                <img
                  src={resolveUrl(person.cover_face_thumbnail)}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-7 h-7 rounded-full bg-[#06080c] border border-white/20 shadow-md flex items-center justify-center z-20 text-blue-400">
                <HelpCircle size={13} className="animate-pulse" />
              </div>

              {/* Candidate Face */}
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/30 shadow-md z-10 bg-[#0a0c10]">
                <img
                  src={resolveUrl(`/thumbnails/Face_Thumbnail/${currentPending.thumb_filename}`)}
                  alt="Candidate face match"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white tracking-tight">Same Person?</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {Math.round((currentPending.best_score || 0.85) * 100)}% match
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5 max-w-md">
                InspireFace detected an unverified match for <span className="text-blue-400 font-medium">{person.name}</span>. Confirm to train the cluster model.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleDecision(currentPending.id, 'different')}
              disabled={resolvingId !== null}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <X size={14} />
              <span>Different Person</span>
            </button>
            <button
              type="button"
              onClick={() => handleDecision(currentPending.id, 'same')}
              disabled={resolvingId !== null}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0a84ff] hover:bg-[#0077e6] transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={14} />
              <span>Yes, Same Person</span>
            </button>
          </div>
        </div>
      )}

      {/* Photo Grid Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-xs font-mono text-white/40">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="py-16 text-center text-white/40 text-xs font-mono">
            No photos found for {person.name}
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
