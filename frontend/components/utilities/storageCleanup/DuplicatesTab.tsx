import React from 'react';
import { DuplicateCluster } from './types';
import { PhotoCard } from './PhotoCard';

interface DuplicatesTabProps {
  clusters: DuplicateCluster[];
  onDelete: (id: number) => void;
}

/**
 * Tab rendering duplicate clusters with per-cluster delete.
 */
export const DuplicatesTab: React.FC<DuplicatesTabProps> = ({ clusters, onDelete }) => {
  const safeClusters = Array.isArray(clusters) ? clusters : [];

  if (safeClusters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#62666d]">No duplicate clusters detected.</p>
        <p className="text-xs text-[#8a8f98] mt-1">Your library is clean and efficient!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#1d1b1a] border border-white/5 rounded-xl px-4 py-3">
        <p className="text-xs text-[#a8a29e] leading-relaxed">
          These photos share identical pixel dimensions and similar file profiles. Verify and delete unwanted duplicates below to free up your physical disk space.
        </p>
      </div>

      {safeClusters.map((cluster) => (
        <div key={cluster.key}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-[#211f1e] border border-white/10 rounded-full text-[9px] font-mono text-[#a8a29e]">
              Group: {cluster.key}
            </span>
            <span className="text-[10px] font-mono text-[#78716c]">
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
