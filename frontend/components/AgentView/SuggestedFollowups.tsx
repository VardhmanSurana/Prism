import React from 'react';
import { Sparkles, FolderPlus, Heart, Video, Calendar } from 'lucide-react';
import { Photo } from '../../types';

interface SuggestedFollowupsProps {
  photos?: Photo[];
  onSelectFollowup: (prompt: string) => void;
  onCreateAlbum?: () => void;
}

export const SuggestedFollowups: React.FC<SuggestedFollowupsProps> = ({
  photos = [],
  onSelectFollowup,
  onCreateAlbum,
}) => {
  const hasPhotos = photos.length > 0;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/[0.04]">
      <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1 mr-1">
        <Sparkles size={10} className="text-purple-400" />
        Suggested:
      </span>

      {hasPhotos ? (
        <>
          {onCreateAlbum && (
            <button
              onClick={onCreateAlbum}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-sm"
            >
              <FolderPlus size={10} />
              <span>Create album ({photos.length})</span>
            </button>
          )}

          <button
            onClick={() => onSelectFollowup("Filter these results to only my favorites")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:bg-white/10 hover:text-white transition-all shadow-sm"
          >
            <Heart size={10} className="text-rose-400" />
            <span>Favorites only</span>
          </button>

          <button
            onClick={() => onSelectFollowup("Show only videos matching this search")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:bg-white/10 hover:text-white transition-all shadow-sm"
          >
            <Video size={10} className="text-blue-400" />
            <span>Videos only</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onSelectFollowup("Show my favorite photos")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:bg-white/10 hover:text-white transition-all shadow-sm"
          >
            <Heart size={10} className="text-rose-400" />
            <span>Show favorites</span>
          </button>

          <button
            onClick={() => onSelectFollowup("Find photos from 2024")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:bg-white/10 hover:text-white transition-all shadow-sm"
          >
            <Calendar size={10} className="text-amber-400" />
            <span>Photos from 2024</span>
          </button>
        </>
      )}
    </div>
  );
};
