import React from 'react';
import { Photo } from '@/types';

interface PhotoMetadataDisplayProps {
  photo: Photo;
}

export const PhotoMetadataDisplay: React.FC<PhotoMetadataDisplayProps> = ({ photo }) => {
  return (
    <div className="max-w-2xl mx-auto text-center animate-in slide-in-from-bottom-4 duration-700">
      <h4 className="text-white text-5xl font-serif italic tracking-tight">
        {new Date(photo.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </h4>
      <div className="flex items-center justify-center gap-4 mt-6">
        <span className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.2em]">{new Date(photo.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
        {photo.location && (
          <>
            <span className="w-1 h-1 bg-white/10 rounded-full" />
            <span className="text-primary/70 text-[10px] font-mono uppercase tracking-[0.2em] font-medium hover:text-primary cursor-pointer transition-colors">{photo.location}</span>
          </>
        )}
      </div>
      {photo.caption && <p className="mt-8 text-white/40 font-serif italic text-lg tracking-wide">"{photo.caption}"</p>}
    </div>
  );
};
