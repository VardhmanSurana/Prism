import React from 'react';
import { Trash2 } from 'lucide-react';
import { resolveUrl } from '../../../constants';
import { PhotoCardProps } from './types';

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onDelete, variant }) => {
  const isBlurry = variant === 'blurry';
  const isDocument = variant === 'document';
  const isDuplicate = variant === 'duplicate';

  return (
    <div className={`relative overflow-hidden border border-white/5 group bg-surfaceHover shadow
      ${isDuplicate ? 'aspect-square rounded-2xl' : 'aspect-[4/3] rounded-2xl'}`}>
      <img 
        src={resolveUrl(photo.url)} 
        alt="preview" 
        className="w-full h-full object-cover" 
      />
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3
        ${isDocument ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
        
        {isBlurry && photo.blur_score !== undefined && (
          <span className="text-[9px] uppercase font-mono tracking-widest text-yellow-400 font-bold mb-1">
            Score: {photo.blur_score}
          </span>
        )}
        
        {isDocument && photo.ai_summary && (
          <p className="text-[10px] text-gray-300 italic mb-2 line-clamp-2">
            "{photo.ai_summary}"
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{photo.filename}</span>
          <button 
            onClick={() => onDelete(photo.id)}
            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 rounded-lg hover:scale-105 transition-all"
            title="Trash"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
