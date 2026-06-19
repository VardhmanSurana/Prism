import React from 'react';
import { resolveUrl } from '../../../constants';
import { PhotoCardProps } from './types';

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onDelete, variant }) => {
  const isBlurry = variant === 'blurry';
  const isDocument = variant === 'document';

  return (
    <div className="group bg-[#050505] border border-[#23252a] rounded-xl overflow-hidden hover:border-[#34343a] transition-all duration-200">
      <div className="aspect-square overflow-hidden bg-[#141516]">
        <img 
          src={resolveUrl(photo.url)} 
          alt="preview" 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
        />
      </div>
      <div className="p-3">
        {isBlurry && photo.blur_score !== undefined && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="px-1.5 py-0.5 bg-[#f5a623]/10 border border-[#f5a623]/20 rounded text-[9px] font-mono text-[#f5a623]">
              Score: {photo.blur_score}
            </span>
          </div>
        )}
        
        {isDocument && photo.ai_summary && (
          <p className="text-[10px] text-[#8a8f98] italic mb-2 line-clamp-2 leading-relaxed">
            &ldquo;{photo.ai_summary}&rdquo;
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-[#62666d] truncate" title={photo.filename}>
            {photo.filename}
          </span>
          <button 
            onClick={() => onDelete(photo.id)}
            title="Move to trash"
            className="shrink-0 px-2 py-1 bg-[#e5484d]/10 border border-[#e5484d]/20 text-[#e5484d] rounded-md text-[9px] font-bold uppercase tracking-wider hover:bg-[#e5484d]/20 opacity-0 group-hover:opacity-100 transition-all"
          >
            Trash
          </button>
        </div>
      </div>
    </div>
  );
};
