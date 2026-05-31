import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { BlurryPhoto } from './types';
import { PhotoCard } from './PhotoCard';

interface BlurryPhotosTabProps {
  photos: BlurryPhoto[];
  onDelete: (id: number) => void;
}

export const BlurryPhotosTab: React.FC<BlurryPhotosTabProps> = ({ photos, onDelete }) => {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm italic">
        No blurry photos detected in your recent imports! Your library looks incredibly sharp.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-4 flex gap-3 text-yellow-400 text-xs leading-relaxed max-w-2xl">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p>
          These photos were evaluated as out-of-focus or blurry using a local <strong>OpenCV Laplacian Variance</strong> filter. Higher values mean sharper images; typical camera photos show variance values above 150.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
