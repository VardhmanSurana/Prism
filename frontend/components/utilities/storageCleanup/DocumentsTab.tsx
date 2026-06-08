import React from 'react';
import { Sparkles } from 'lucide-react';
import { Photo } from '../../../types';
import { PhotoCard } from './PhotoCard';

interface DocumentsTabProps {
  photos: Photo[];
  onDelete: (id: number) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ photos, onDelete }) => {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm italic">
        No screenshots or receipts classified in your library yet!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-4 flex gap-3 text-yellow-400 text-xs leading-relaxed max-w-2xl">
        <Sparkles size={18} className="shrink-0 mt-0.5 animate-pulse" />
        <p>
          These photos were categorized as screenshots, receipts, invoices, or paper documents using visual keywords found inside your local <strong>Ollama AI Descriptions</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.id} 
            photo={{
              id: photo.id as number,
              url: photo.url,
              filename: photo.filename,
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
