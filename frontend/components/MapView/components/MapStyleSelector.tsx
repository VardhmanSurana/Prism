import React from 'react';
import { MAP_STYLES } from '../constants';

interface MapStyleSelectorProps {
  selectedStyleId: string;
  onStyleChange: (styleId: string) => void;
}

export const MapStyleSelector: React.FC<MapStyleSelectorProps> = ({ 
  selectedStyleId, 
  onStyleChange 
}) => {
  return (
    <div className="absolute top-6 right-6 z-[1000]">
      <div className="bg-surface/85 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl flex flex-col gap-2 min-w-[200px]">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Map Style</span>
        <div className="flex flex-col gap-1.5">
          {MAP_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onStyleChange(style.id)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border text-left ${
                selectedStyleId === style.id
                  ? 'bg-primary text-black border-primary font-bold shadow-lg shadow-primary/10'
                  : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10'
              }`}
            >
              <span>{style.name}</span>
              {selectedStyleId === style.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
