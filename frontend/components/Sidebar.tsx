import React from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Compass,
  Map as MapIcon,
  FolderOpen,
  Trash2,
  Settings,
  Lock,
  HardDrive,
  Sparkles,
  Users,
  Bot,
} from 'lucide-react';
import { ViewMode } from '../types';
import { useStats } from '../hooks/useStats';

// Data

type NavItemData = {
  view: ViewMode;
  icon: React.ElementType;
  label: string;
};

const MAIN_NAV: NavItemData[] = [
  { view: 'gallery', icon: ImageIcon, label: 'Gallery' },
  { view: 'explore', icon: Compass, label: 'Explore' },
  { view: 'map', icon: MapIcon, label: 'Map' },
  { view: 'agent', icon: Bot, label: 'Prism AI' },
];

const LIBRARY_NAV: NavItemData[] = [
  { view: 'albums', icon: FolderOpen, label: 'Albums' },
  { view: 'people', icon: Users, label: 'People' },
  { view: 'trash', icon: Trash2, label: 'Trash' },
];

const UTILITY_NAV: NavItemData[] = [
  { view: 'utilities', icon: Settings, label: 'Utilities' },
  { view: 'locked', icon: Lock, label: 'Locked Folder' },
];

// Helpers

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

// Sub-components

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: ViewMode;
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onMouseEnter?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, view, currentView, onChangeView, onMouseEnter }) => {
  const isActive = currentView === view;

  return (
    <button
      onClick={() => onChangeView(view)}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-4 px-6 py-3.5 text-sm transition-all duration-300 relative group
        ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'}`}
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
};

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-6 pt-10 pb-3 text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.3em]">
    {label}
  </div>
);

// Sidebar

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const { stats } = useStats();
  const totalBytes = stats?.total_size_bytes ?? 0;
  const usedLabel = formatBytes(totalBytes);

  const handlePreloadAgent = async () => {
    try {
      await fetch('/api/v1/agent/preload', { method: 'POST' });
    } catch (e) {
      console.warn('Silent preload failed:', e);
    }
  };

  return (
    <aside className="w-64 h-screen bg-surface/50 backdrop-blur-3xl border-r border-white-[0.03] flex flex-col shrink-0 z-30">
      <div className="h-20 flex items-center px-8 gap-3">
        <div className="w-9 h-9 bg-black border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl">
          <Sparkles size={18} className="text-primary animate-pulse" />
        </div>
        <span className="text-2xl font-serif italic tracking-wide text-white">Prism</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {MAIN_NAV.map(item => (
          <NavItem 
            key={item.view} 
            {...item} 
            currentView={currentView} 
            onChangeView={onChangeView} 
            onMouseEnter={item.view === 'agent' ? handlePreloadAgent : undefined}
          />
        ))}

        <SectionHeader label="Library" />
        {LIBRARY_NAV.map(item => (
          <NavItem key={item.view} {...item} currentView={currentView} onChangeView={onChangeView} />
        ))}

        <SectionHeader label="Utilities" />
        {UTILITY_NAV.map(item => (
          <NavItem key={item.view} {...item} currentView={currentView} onChangeView={onChangeView} />
        ))}
      </div>

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
