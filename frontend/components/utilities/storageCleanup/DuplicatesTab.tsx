import React from 'react';
import { DuplicateCluster } from './types';
import { PhotoCard } from './PhotoCard';

interface DuplicatesTabProps {
  clusters: DuplicateCluster[];
  onDelete: (id: number) => void;
}

export const DuplicatesTab: React.FC<DuplicatesTabProps> = ({ clusters, onDelete }) => {
  if (clusters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#62666d]">No duplicate clusters detected.</p>
        <p className="text-xs text-[#8a8f98] mt-1">Your library is clean and efficient!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#050505] border border-[#23252a] rounded-lg px-4 py-3">
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          These photos share identical pixel dimensions and similar file profiles. Verify and delete unwanted duplicates below to free up your physical disk space.
        </p>
      </div>

      {clusters.map((cluster) => (
        <div key={cluster.key}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-[#141516] border border-[#23252a] rounded-full text-[9px] font-mono text-[#8a8f98]">
              Group: {cluster.key}
            </span>
            <span className="text-[10px] font-mono text-[#62666d]">
              {cluster.photo_count} matches
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {cluster.photos.map((photo) => (
              <PhotoCard 
                key={photo.id} 
                photo={photo} 
                onDelete={onDelete} 
                variant="duplicate" 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
