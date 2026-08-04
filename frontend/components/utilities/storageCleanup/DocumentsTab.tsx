import React from 'react';
import { Photo } from '../../../types';
import { PhotoCard } from './PhotoCard';

interface DocumentsTabProps {
  photos: Photo[];
  onDelete: (id: number) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ photos, onDelete }) => {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#62666d]">No screenshots or receipts classified yet!</p>
        <p className="text-xs text-[#8a8f98] mt-1">Your library is free of document clutter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#050505] border border-[#23252a] rounded-lg px-4 py-3">
        <p className="text-xs text-[#8a8f98] leading-relaxed">
          These photos were categorized as screenshots, receipts, invoices, or paper documents using visual keywords found inside your local <strong className="text-[#d0d6e0]">Ollama AI Descriptions</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.id} 
            photo={{
              id: photo.id as number,
              url: photo.url,
              filename: photo.filename ?? 'unknown',
              ai_summary: photo.ai_summary
            }} 
            onDelete={onDelete} 
            variant="document" 
          />
        ))}
      </div>
    </div>
  );
};
