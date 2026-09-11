import React from 'react';
import {
  Image as ImageIcon,
  Compass,
  Map as MapIcon,
  Trash2,
  Settings,
  Lock,
  Users,
  Bot,
  Palette,
  Wrench,
  Flame,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { GlassMaterial, GlassEffectContainer } from '@/components/ui/GlassMaterial';
import { useSettingsStore } from '@/store';
import { NavItem } from './NavItem';
import { SectionHeader } from './SectionHeader';
import { SidebarTree } from './SidebarTree';

type NavItemData = {
  view: ViewMode;
  icon: React.ElementType;
  label: string;
};

const MAIN_NAV: NavItemData[] = [
  { view: 'gallery', icon: ImageIcon, label: 'Gallery' },
  { view: 'explore', icon: Compass, label: 'Explore' },
  { view: 'map', icon: MapIcon, label: 'Map' },
  { view: 'toolbox', icon: Wrench, label: 'Toolbox' },
  { view: 'agent', icon: Bot, label: 'Prism AI' },
];

const LIBRARY_NAV: NavItemData[] = [
  { view: 'cull', icon: Flame, label: 'Cull' },
  { view: 'people', icon: Users, label: 'People' },
  { view: 'trash', icon: Trash2, label: 'Trash' },
];

const UTILITY_NAV: NavItemData[] = [
  { view: 'appearance', icon: Palette, label: 'Appearance' },
  { view: 'utilities', icon: Settings, label: 'Utilities' },
  { view: 'locked', icon: Lock, label: 'Locked Folder' },
];

// ponytail: removed Apple Photos iPadOS sidebar clone, standardized on signature Prism sidebar
/**
 * Sidebar - Renders sidebar.
 */
export const Sidebar: React.FC<{
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}> = ({ currentView, onChangeView }) => {
  /**
   * isAgentEnabled - Performs is agent enabled.
   */
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);

  const visibleMainNav = MAIN_NAV.filter(item => item.view !== 'agent' || isAgentEnabled);

  return (
    <aside className="w-64 h-screen bg-transparent flex flex-col shrink-0 z-30 relative">
      <GlassMaterial intensity="prominent" borderRadius="0" className="h-full border-r border-white-[0.03] shadow-2xl">
        <div className="h-20 flex items-center px-8 gap-3 relative z-20">
          <div className="w-9 h-9 bg-black/60 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center shadow-2xl shrink-0">
            <img src="/prism-logo.png" alt="Prism Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-2xl font-serif italic tracking-wide text-white">Prism</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar relative z-20">
          <GlassEffectContainer>
            {visibleMainNav.map((item) => (
              <NavItem
                key={item.view}
                {...item}
                currentView={currentView}
                onChangeView={onChangeView}
              />
            ))}

            <SectionHeader label="Library" />
            <SidebarTree
              type="albums"
              onViewAll={() => onChangeView('albums')}
              onSelectItem={() => onChangeView('albums')}
            />
            {LIBRARY_NAV.map((item) => (
              <NavItem key={item.view} {...item} currentView={currentView} onChangeView={onChangeView} />
            ))}
            <SidebarTree
              type="projects"
              onViewAll={() => onChangeView('projects')}
              onSelectItem={() => onChangeView('projects')}
            />

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
