import React from 'react';
import { MapPin, Calendar, Plus } from 'lucide-react';
import { AlbumType } from './hooks/useAlbums';

interface AlbumTabsProps {
  activeTab: AlbumType;
  onTabChange: (tab: AlbumType) => void;
  onRefresh: () => void;
}

export const AlbumTabs: React.FC<AlbumTabsProps> = ({ activeTab, onTabChange, onRefresh }) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 shrink-0">
      <div className="flex items-center gap-1 bg-[#111] p-1.5 rounded-2xl border border-white/5 shadow-inner">
        <button 
          onClick={() => onTabChange('places')}
          className={`flex items-center gap-2.5 px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300
            ${activeTab === 'places' 
              ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
        >
          <MapPin size={18} />
          <span>Places</span>
        </button>

        <button 
          onClick={() => onTabChange('memories')}
          className={`flex items-center gap-2.5 px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300
            ${activeTab === 'memories' 
              ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
        >
          <Calendar size={18} />
          <span>Memories</span>
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={onRefresh}
          className="p-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:text-white hover:bg-white/10 transition-all"
          title="Refresh Albums"
        >
          <Plus size={20} className="rotate-45" />
        </button>
      </div>
    </div>
  );
};
