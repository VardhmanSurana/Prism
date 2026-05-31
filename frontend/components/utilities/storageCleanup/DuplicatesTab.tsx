import React from 'react';
import { Layers } from 'lucide-react';
import { DuplicateCluster } from './types';
import { PhotoCard } from './PhotoCard';

interface DuplicatesTabProps {
  clusters: DuplicateCluster[];
  onDelete: (id: number) => void;
}

export const DuplicatesTab: React.FC<DuplicatesTabProps> = ({ clusters, onDelete }) => {
  if (clusters.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm italic">
        No duplicate clusters detected. Your library is clean and efficient!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-4 flex gap-3 text-yellow-400 text-xs leading-relaxed max-w-2xl">
        <Layers size={18} className="shrink-0 mt-0.5" />
        <p>
          These photos share identical pixel dimensions and similar file profiles. Verify and delete unwanted duplicates below to free up your physical disk space.
        </p>
      </div>

      <div className="space-y-6">
        {clusters.map((cluster) => (
          <div key={cluster.key} className="border border-white/5 bg-[#0a0a0a]/50 p-4 rounded-3xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-gray-500 font-bold">
                Group: {cluster.key} • {cluster.photo_count} matches
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
    </div>
  );
};
