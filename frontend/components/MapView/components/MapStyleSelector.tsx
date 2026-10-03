import React from 'react';
import { MAP_STYLES } from '../constants';
import { Moon, Sun, Globe, Mountain, Bike, Layers } from 'lucide-react';

interface MapStyleSelectorProps {
  selectedStyleId: string;
  onStyleChange: (styleId: string) => void;
}

const STYLE_ICONS: Record<string, React.ElementType> = {
  dark: Moon,
  light: Sun,
  satellite: Globe,
  topo: Mountain,
  cycle: Bike,
};

/**
 * MapStyleSelector - Renders map style selector.
 */
export const MapStyleSelector: React.FC<MapStyleSelectorProps> = ({ 
  selectedStyleId, 
  onStyleChange 
}) => {
  return (
    <div className="absolute top-6 right-6 z-[1000]">
      <div className="bg-[#1d1b1a]/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[185px]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-[0.2em]">
          <Layers size={11} className="text-[#e5a93c]" />
          <span>Layer Style</span>
        </div>
        <div className="flex flex-col gap-1">
          {MAP_STYLES.map((style) => {
            const Icon = STYLE_ICONS[style.id] || Layers;
            const isSelected = selectedStyleId === style.id;
            return (
              <button
                key={style.id}
                onClick={() => onStyleChange(style.id)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs transition-all duration-200 border text-left ${
                  isSelected
                    ? 'bg-[#302d2c] text-white border-white/15 font-medium shadow-md shadow-black/20'
                    : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={13} className={isSelected ? 'text-[#e5a93c]' : 'text-zinc-500'} />
                  <span>{style.name}</span>
                </div>
                {isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e5a93c] shadow-[0_0_8px_rgba(229,169,60,0.8)] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
