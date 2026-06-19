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
import { GlassMaterial, GlassEffectContainer } from './GlassMaterial';

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
          className="absolute inset-y-1.5 left-2 right-2 bg-white/[0.05] rounded-xl border border-white/5 shadow-inner"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
           <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-full blur-[1px]" />
        </motion.div>
      )}
      <Icon size={18} className={`transition-all duration-300 relative z-10 ${isActive ? 'text-primary' : 'group-hover:text-primary/50'}`} />
      <span className={`tracking-tight relative z-10 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
};

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-6 pt-10 pb-3 text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.3em] relative z-20">
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
    <aside className="w-64 h-screen bg-transparent flex flex-col shrink-0 z-30 relative">
      <GlassMaterial intensity="prominent" borderRadius="0" className="h-full border-r border-white-[0.03] shadow-2xl">
        <div className="h-20 flex items-center px-8 gap-3 relative z-20">
          <div className="w-9 h-9 bg-black border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl">
            <Sparkles size={18} className="text-primary animate-pulse" />
          </div>
          <span className="text-2xl font-serif italic tracking-wide text-white">Prism</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar relative z-20">
          <GlassEffectContainer>
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
          </GlassEffectContainer>
        </div>

        <div className="px-4 pb-8 relative z-20">
          <GlassMaterial 
            intensity="subtle" 
            interactive 
            borderRadius="1.25rem" 
            className="p-4 group cursor-default"
          >
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-1.5 transition-colors duration-300 group-hover:text-white">
              <HardDrive size={16} className="text-gray-500 group-hover:text-primary transition-colors duration-300" />
              <span className="font-medium">Storage</span>
            </div>
            <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors duration-300">
              {totalBytes === 0
                ? stats === null
                  ? 'Calculating…'
                  : 'No media stored yet'
                : `${usedLabel} used`}
            </div>
          </GlassMaterial>
        </div>
      </GlassMaterial>
    </aside>
  );
};
