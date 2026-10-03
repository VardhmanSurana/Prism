import React from 'react';
import {
  Image as GalleryIcon,
  Compass,
  Map as MapIcon,
  LayoutPanelLeft,
  BookOpen,
  Users,
  Clapperboard,
  Trash2,
  Palette,
  SlidersHorizontal,
  Lock,
  Bot,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { useSettingsStore } from '@/store';
import { NavItem } from './NavItem';
import { SectionHeader } from './SectionHeader';

/**
 * ToolboxIcon - Crossed tools icon matching the design specification.
 */
const ToolboxIcon: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({
  size = 18,
  className = '',
  strokeWidth = 1.75,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.7 10.7 20 5.4a2.4 2.4 0 0 0-3.4-3.4l-5.3 5.3" />
    <path d="M14.7 10.7 7 18.4l-4.2-.7.7-4.2 7.7-7.7" />
    <path d="m3.5 20.5 4-4" />
    <path d="m15.5 8.5 4 4" />
  </svg>
);

type NavItemData = {
  view: ViewMode;
  icon: React.ElementType;
  label: string;
};

const COLLECTION_ITEMS: NavItemData[] = [
  { view: 'gallery', icon: GalleryIcon, label: 'Gallery' },
  { view: 'explore', icon: Compass, label: 'Explore' },
  { view: 'map', icon: MapIcon, label: 'Map' },
  { view: 'dashboard', icon: LayoutPanelLeft, label: 'Dashboard' },
  { view: 'toolbox', icon: ToolboxIcon, label: 'Toolbox' },
];

const LIBRARY_ITEMS: NavItemData[] = [
  { view: 'albums', icon: BookOpen, label: 'Albums' },
  { view: 'people', icon: Users, label: 'People' },
  { view: 'projects', icon: Clapperboard, label: 'Video Projects' },
  { view: 'trash', icon: Trash2, label: 'Trash' },
];

const UTILITIES_ITEMS: NavItemData[] = [
  { view: 'appearance', icon: Palette, label: 'Appearance' },
  { view: 'utilities', icon: SlidersHorizontal, label: 'Utilities' },
  { view: 'locked', icon: Lock, label: 'Locked Folder' },
];

/**
 * Sidebar - Studio sidebar navigation with #171615 canvas and pill navigation.
 */
export const Sidebar: React.FC<{
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}> = ({ currentView, onChangeView }) => {
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);

  const collectionItems = [
    ...COLLECTION_ITEMS,
    ...(isAgentEnabled ? [{ view: 'agent' as ViewMode, icon: Bot, label: 'Prism AI' }] : []),
  ];

  return (
    <aside className="w-60 h-screen bg-[#171615] border-r border-[#242220] flex flex-col shrink-0 z-30 select-none">
      {/* Studio Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 shrink-0">
        <div className="w-7 h-7 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
          <img src="/prism-logo.png" alt="Prism Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-xl font-serif tracking-tight text-[#f5f0ed]">Prism</span>
        <span className="text-[9px] font-mono font-medium uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#262422] text-[#998f8a] border border-white/5 ml-auto">
          STUDIO
        </span>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1 custom-scrollbar">
        {/* Collection Section */}
        <SectionHeader label="Collection" className="pt-2" />
        <nav className="flex flex-col gap-0.5">
          {collectionItems.map((item) => (
            <NavItem
              key={item.view}
              {...item}
              currentView={currentView}
              onChangeView={onChangeView}
            />
          ))}
        </nav>

        {/* Library Section */}
        <SectionHeader label="Library" className="pt-5" />
        <nav className="flex flex-col gap-0.5">
          {LIBRARY_ITEMS.map((item) => (
            <NavItem
              key={item.view}
              {...item}
              currentView={currentView}
              onChangeView={onChangeView}
            />
          ))}
        </nav>

        {/* Utilities Section */}
        <SectionHeader label="Utilities" className="pt-5" />
        <nav className="flex flex-col gap-0.5">
          {UTILITIES_ITEMS.map((item) => (
            <NavItem
              key={item.view}
              {...item}
              currentView={currentView}
              onChangeView={onChangeView}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
};

