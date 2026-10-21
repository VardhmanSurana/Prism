import React from 'react';
import { resolveUrl } from '../../../constants';
import { PhotoCardProps } from './types';
import { Trash2 } from 'lucide-react';

/**
 * Photo card for cleanup results supporting blurry/document variants in Dark Basalt.
 */
export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onDelete, variant }) => {
  const isBlurry = variant === 'blurry';
  const isDocument = variant === 'document';

  return (
    <div className="group bg-[#211f1e] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all duration-200 flex flex-col justify-between shadow-sm">
      <div className="aspect-square overflow-hidden bg-[#100e0d] relative">
        <img 
          src={resolveUrl(photo.url)} 
          alt="preview" 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
        />
        <button 
          onClick={() => onDelete(photo.id)}
          title="Move to trash"
          className="absolute top-2 right-2 p-2 bg-[#171615]/80 hover:bg-rose-900 border border-white/10 hover:border-rose-500/40 text-[#a8a29e] hover:text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-md cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="p-3.5 space-y-2">
        {isBlurry && photo.blur_score !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-mono text-amber-300">
              Blur Score: {photo.blur_score}
            </span>
          </div>
        )}
        
        {isDocument && photo.ai_summary && (
          <p className="text-[11px] text-[#a8a29e] italic line-clamp-2 leading-relaxed">
            &ldquo;{photo.ai_summary}&rdquo;
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <span className="text-[11px] font-mono text-[#78716c] truncate" title={photo.filename}>
            {photo.filename}
          </span>
          <span className="text-[10px] font-mono text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Move to Trash
          </span>
        </div>
      </div>
    </div>
  );
};
