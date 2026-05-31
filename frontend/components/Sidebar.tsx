import React from 'react';
import { motion } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Compass, 
  Map as MapIcon, 
  Heart, 
  FolderOpen, 
  Archive, 
  Trash2, 
  Settings,
  Lock,
  HardDrive,
  Sparkles,
  Users
} from 'lucide-react';
import { ViewMode } from '../types';
import { useStats } from '../hooks/useStats';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

/** Format raw bytes into a compact, human-readable string (e.g. 2.3 GB). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

const NavItem: React.FC<{ 
  icon: React.ElementType, 
  label: string, 
  isActive?: boolean, 
  onClick?: () => void 
}> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-3.5 text-sm transition-all duration-300 relative group
      ${isActive 
        ? 'text-white' 
        : 'text-gray-500 hover:text-white'
      }`}
  >
    {isActive && (
      <motion.div 
        layoutId="activeIndicator"
        className="absolute left-2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--color-primary),0.8)]"
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      />
    )}
    <Icon size={18} className={`transition-all duration-300 ${isActive ? 'text-primary' : 'group-hover:text-primary/50'}`} />
    <span className={`tracking-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
  </button>
);

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-6 pt-10 pb-3 text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.3em]">
    {label}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const { stats } = useStats();

  const totalBytes = stats?.total_size_bytes ?? 0;
  const usedLabel = formatBytes(totalBytes);

  return (
    <aside className="w-64 h-screen bg-surface/50 backdrop-blur-3xl border-r border-white-[0.03] flex flex-col shrink-0 z-30">
      {/* Logo Area */}
      <div className="h-20 flex items-center px-8 gap-3">
        <div className="w-9 h-9 bg-black border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl">
          <Sparkles size={18} className="text-primary animate-pulse" />
        </div>
        <span className="text-2xl font-serif italic tracking-wide text-white">Prism</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        <NavItem 
          icon={ImageIcon} 
          label="Photos" 
          isActive={currentView === 'photos'} 
          onClick={() => onChangeView('photos')} 
        />
        <NavItem 
          icon={Compass} 
          label="Explore" 
          isActive={currentView === 'explore'} 
          onClick={() => onChangeView('explore')} 
        />
        <NavItem 
          icon={MapIcon} 
          label="Map" 
          isActive={currentView === 'map'} 
          onClick={() => onChangeView('map')}
        />

        <SectionHeader label="Library" />
        <NavItem 
          icon={Heart} 
          label="Favorites" 
          isActive={currentView === 'favorites'} 
          onClick={() => onChangeView('favorites')}
        />
        <NavItem 
          icon={FolderOpen} 
          label="Albums" 
          isActive={currentView === 'albums'} 
          onClick={() => onChangeView('albums')} 
        />
        <NavItem 
          icon={Users} 
          label="People" 
          isActive={currentView === 'people'} 
          onClick={() => onChangeView('people')} 
        />
        <NavItem 
          icon={Archive} 
          label="Archive" 
          isActive={currentView === 'archived'} 
          onClick={() => onChangeView('archived')}
        />
        <NavItem 
          icon={Trash2} 
          label="Trash" 
          isActive={currentView === 'trash'}
          onClick={() => onChangeView('trash')}
        />

        <SectionHeader label="Utilities" />
        <NavItem 
          icon={Settings} 
          label="Utilities" 
          isActive={currentView === 'utilities'}
          onClick={() => onChangeView('utilities')}
        />
        <NavItem 
          icon={Lock} 
          label="Locked Folder" 
          isActive={currentView === 'locked'}
          onClick={() => onChangeView('locked')}
        />
      </div>

      {/* Storage Status */}
      <div className="p-6 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
          <HardDrive size={16} />
          <span>Storage</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
          {totalBytes > 0 && (
            <motion.div
              className="bg-primary h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
        </div>
        <div className="text-xs text-gray-500">
          {totalBytes === 0
            ? stats === null
              ? 'Calculating…'
              : 'No media stored yet'
            : `${usedLabel} used`}
        </div>
      </div>
    </aside>
  );
};
