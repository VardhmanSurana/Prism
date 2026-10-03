import React, { useRef, useState } from 'react';
import { ArrowLeft, Check, X, HelpCircle } from 'lucide-react';
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

/**
 * PersonDetail - Prism Editorial Individual Portfolio
 */
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
    <div className="flex flex-col h-full overflow-hidden bg-[#151312] select-none font-sans text-[#e7e1df]">
      {/* Sticky Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-[#151312]/90 backdrop-blur-md sticky top-0 z-20 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-full bg-[#1d1b1a] hover:bg-[#2c2928] text-[#e7e1df] border border-white/[0.06] transition-colors cursor-pointer"
            title="Back to all people"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/10 shadow-lg bg-[#2c2928]">
              {person.cover_face_thumbnail ? (
                <img
                  src={resolveUrl(person.cover_face_thumbnail)}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#998f8a] text-lg font-serif">
                  {person.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl md:text-2xl font-serif text-[#e7e1df] tracking-tight font-normal">
                  {person.name}
                </h2>
                <span className="text-xs font-mono text-[#a8a29e] tabular-nums">
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#7d7e7f] mt-0.5">
                Archival Identity Portfolio · On-device biometric cluster
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Face Reconciliation Prompt Banner */}
      {pendingFaces.length > 0 && currentPending && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-[#1d1b1a] border border-white/[0.08] shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="flex items-center -space-x-3">
              {/* Existing Cover Portrait */}
              <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/20 shadow-md z-10 bg-[#2c2928]">
                <img
                  src={resolveUrl(person.cover_face_thumbnail)}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-6 h-6 rounded-full bg-[#151312] border border-white/20 shadow-md flex items-center justify-center z-20 text-[#c6c6c7]">
                <HelpCircle size={12} className="animate-pulse" />
              </div>

              {/* Candidate Face */}
              <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/30 shadow-md z-10 bg-[#2c2928]">
                <img
                  src={resolveUrl(`/thumbnails/Face_Thumbnail/${currentPending.thumb_filename}`)}
                  alt="Candidate face match"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-serif text-[#e7e1df] tracking-tight">Same Identity?</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#c6c6c7]/10 text-[#c6c6c7] border border-white/[0.08]">
                  {Math.round((currentPending.best_score || 0.85) * 100)}% match
                </span>
              </div>
              <p className="text-xs text-[#a8a29e] mt-0.5 max-w-md">
                InspireFace detected an unverified cluster match for <span className="text-[#e7e1df] font-serif">{person.name}</span>. Confirm to train the identity model.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleDecision(currentPending.id, 'different')}
              disabled={resolvingId !== null}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#d0c4be] hover:text-[#e7e1df] bg-[#2c2928] hover:bg-[#373433] border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <X size={13} />
              <span>Different Person</span>
            </button>
            <button
              type="button"
              onClick={() => handleDecision(currentPending.id, 'same')}
              disabled={resolvingId !== null}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#2f3131] bg-[#c6c6c7] hover:bg-[#e2e2e2] transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check size={13} />
              <span>Yes, Same Person</span>
            </button>
          </div>
        </div>
      )}

      {/* Photo Grid Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#c6c6c7] rounded-full animate-spin mb-3" />
            <p className="text-xs font-mono text-[#998f8a]">Loading archival plates...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="py-16 text-center text-[#998f8a] text-xs font-mono">
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
