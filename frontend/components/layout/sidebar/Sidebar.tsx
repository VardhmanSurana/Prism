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
  Sparkles,
  Users,
  Bot,
  Film,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { API_BASE } from '@/constants';
import { GlassMaterial, GlassEffectContainer } from '@/components/ui/GlassMaterial';
import { NavItem } from './NavItem';
import { SectionHeader } from './SectionHeader';

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
  { view: 'projects', icon: Film, label: 'Video Projects' },
  { view: 'trash', icon: Trash2, label: 'Trash' },
];

const UTILITY_NAV: NavItemData[] = [
  { view: 'utilities', icon: Settings, label: 'Utilities' },
  { view: 'locked', icon: Lock, label: 'Locked Folder' },
];

export const Sidebar: React.FC<{
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}> = ({ currentView, onChangeView }) => {

  const handlePreloadAgent = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/agent/preload`, { method: 'POST' });
      if (!response.ok) {
        console.warn(`Agent preload failed: ${response.status} ${response.statusText}`);
      }
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
            {MAIN_NAV.map((item) => (
              <NavItem
                key={item.view}
                {...item}
                currentView={currentView}
                onChangeView={onChangeView}
                onMouseEnter={item.view === 'agent' ? handlePreloadAgent : undefined}
              />
            ))}

            <SectionHeader label="Library" />
            {LIBRARY_NAV.map((item) => (
              <NavItem key={item.view} {...item} currentView={currentView} onChangeView={onChangeView} />
            ))}

            <SectionHeader label="Utilities" />
            {UTILITY_NAV.map((item) => (
              <NavItem key={item.view} {...item} currentView={currentView} onChangeView={onChangeView} />
            ))}
          </GlassEffectContainer>
        </div>
      </GlassMaterial>
    </aside>
  );
};
