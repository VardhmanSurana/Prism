import React from 'react';
import { BlurryPhoto } from './types';
import { PhotoCard } from './PhotoCard';

interface BlurryPhotosTabProps {
  photos: BlurryPhoto[];
  onDelete: (id: number) => void;
}

export const BlurryPhotosTab: React.FC<BlurryPhotosTabProps> = ({ photos, onDelete }) => {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#62666d]">No blurry photos detected in your recent imports!</p>
        <p className="text-xs text-[#8a8f98] mt-1">Your library looks incredibly sharp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#050505] border border-[#23252a] rounded-lg px-4 py-3">
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          These photos were evaluated as out-of-focus or blurry using a local <strong className="text-[#d0d6e0]">OpenCV Laplacian Variance</strong> filter. Higher values mean sharper images; typical camera photos show variance values above 150.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.id} 
            photo={photo} 
            onDelete={onDelete} 
            variant="blurry" 
          />
        ))}
      </div>
    </div>
  );
};
