import React from 'react';
import {
  X,
  Heart,
  Info,
  ZoomIn,
  ZoomOut,
  Edit2,
} from 'lucide-react';
import { Photo } from '../../types';

interface ToolbarProps {
  photo: Photo;
  highResStatus: 'loading' | 'loaded' | 'error';
  zoomScale: number;
  showInfo: boolean;
  onClose: () => void;
  onSetZoomScale: (scale: number) => void;
  onResetInteraction: () => void;
  onToggleShowInfo: () => void;
  onEdit?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  photo,
  highResStatus,
  zoomScale,
  showInfo,
  onClose,
  onSetZoomScale,
  onResetInteraction,
  onToggleShowInfo,
  onEdit,
}) => {
  return (
    <div className="h-20 flex items-center justify-between px-8 shrink-0 z-20 bg-transparent font-sans">
      <div className="flex items-center gap-6">
        <button 
          onClick={onClose} 
          className="p-2 text-white/50 hover:text-white transition-all hover:scale-110"
          title="Close Lightbox"
        >
          <X size={28} strokeWidth={1.5} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${highResStatus === 'loaded' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`} />
          <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-gray-500">
            {highResStatus === 'loaded' ? 'Raw-Fidelity HD' : 'Optimizing Stream...'}
          </span>
        </div>

        {zoomScale > 1 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full border border-primary/30 text-primary animate-in zoom-in-95">
            <span className="text-[10px] font-bold uppercase tracking-widest">{zoomScale.toFixed(1)}x Zoom</span>
            <button onClick={onResetInteraction} className="hover:text-white" title="Reset Zoom"><X size={12}/></button>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-full p-1 mr-2 border border-white/10">
          <button 
            onClick={() => onSetZoomScale(Math.max(0.1, zoomScale - 0.5))} 
            className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut size={16}/>
          </button>
          <button 
            onClick={() => onSetZoomScale(Math.min(10, zoomScale + 0.5))} 
            className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn size={16}/>
          </button>
        </div>
        
        <div className="h-6 w-[1px] bg-white/10 mx-1 hidden sm:block" />
        
        <button 
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Favorite"
        >
          <Heart size={20} className={photo.isFavorite ? "fill-red-500 text-red-500" : ""} />
        </button>
        

        <button 
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Edit"
          onClick={onEdit}
        >
          <Edit2 size={20} />
        </button>
        
        <button 
          onClick={onToggleShowInfo}
          className={`p-2 transition-all rounded-full ${showInfo ? 'text-primary bg-primary/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
          title="Metadata Information"
        >
          <Info size={20} />
        </button>
      </div>
    </div>
  );
};
