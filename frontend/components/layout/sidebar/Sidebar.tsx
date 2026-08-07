import React, { useState } from 'react';
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
  Palette,
  ChevronRight,
  Heart,
  User,
  Sun,
  Crop,
  EyeOff,
  Download,
  Eye,
  QrCode,
  PenTool,
  Wrench,
} from 'lucide-react';
import { ViewMode } from '@/types';
import { API_BASE } from '@/constants';
import { GlassMaterial, GlassEffectContainer } from '@/components/ui/GlassMaterial';
import { useSettingsStore } from '@/store';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';
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
  { view: 'toolbox', icon: Wrench, label: 'Image Toolbox' },
  { view: 'agent', icon: Bot, label: 'Prism AI' },
];

const LIBRARY_NAV: NavItemData[] = [
  { view: 'people', icon: Users, label: 'People' },
  { view: 'trash', icon: Trash2, label: 'Trash' },
];

const UTILITY_NAV: NavItemData[] = [
  { view: 'toolbox', icon: Wrench, label: 'Image Toolbox' },
  { view: 'appearance', icon: Palette, label: 'Appearance' },
  { view: 'utilities', icon: Settings, label: 'Utilities' },
  { view: 'locked', icon: Lock, label: 'Locked Folder' },
];

const AppleSidebarContent: React.FC<{
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}> = ({ currentView, onChangeView }) => {
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [mediaTypesOpen, setMediaTypesOpen] = useState(true);
  const [utilitiesOpen, setUtilitiesOpen] = useState(true);

  return (
    <div className="px-3 py-4 space-y-4 text-xs font-sans text-zinc-300 select-none overflow-y-auto custom-scrollbar h-full">
      {/* Top Header / Brand (Apple HIG SF Symbols Header) */}
      <div className="px-2 py-1 flex items-center justify-between">
        <span className="text-xl font-sans font-bold text-white tracking-tight">Photos</span>
        <span className="text-[10px] font-mono text-[#0a84ff] bg-[#0a84ff]/15 px-2 py-0.5 rounded-full font-semibold">iPadOS 18 HIG</span>
      </div>

      {/* Main Top Item: Library */}
      <button
        type="button"
        onClick={() => onChangeView('gallery')}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all font-medium ${
          currentView === 'gallery'
            ? 'bg-[#0a84ff]/20 text-[#0a84ff] font-semibold'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <ImageIcon size={18} strokeWidth={2} className={currentView === 'gallery' ? 'text-[#0a84ff]' : 'text-[#0a84ff]'} />
        <span className="text-sm font-semibold">Library</span>
      </button>

      {/* Collections */}
      <button
        type="button"
        onClick={() => onChangeView('explore')}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all font-medium ${
          currentView === 'explore'
            ? 'bg-[#0a84ff]/20 text-[#0a84ff] font-semibold'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Compass size={18} strokeWidth={2} className={currentView === 'explore' ? 'text-[#0a84ff]' : 'text-zinc-400'} />
        <span className="text-sm font-medium">Collections</span>
      </button>

      {/* Pinned Section (Apple HIG Pinned Items) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setPinnedOpen(!pinnedOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-zinc-400 hover:text-white font-semibold text-[11px] uppercase tracking-wider"
        >
          <span>Pinned</span>
          <ChevronRight size={14} strokeWidth={2} className={`transition-transform duration-200 ${pinnedOpen ? 'rotate-90' : ''}`} />
        </button>

        {pinnedOpen && (
          <div className="space-y-0.5 pt-1 pl-1">
            <button
              type="button"
              onClick={() => onChangeView('favorites')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'favorites' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Heart size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Favourites</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('map')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'map' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <MapIcon size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Map</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('people')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'people' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Users size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>People & Pets</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('trash')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'trash' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Trash2 size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Recently Deleted</span>
            </button>
          </div>
        )}
      </div>

      {/* Media Types Section (Apple HIG SF Symbols) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setMediaTypesOpen(!mediaTypesOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-zinc-400 hover:text-white font-semibold text-[11px] uppercase tracking-wider"
        >
          <span>Media Types</span>
          <ChevronRight size={14} strokeWidth={2} className={`transition-transform duration-200 ${mediaTypesOpen ? 'rotate-90' : ''}`} />
        </button>

        {mediaTypesOpen && (
          <div className="space-y-0.5 pt-1 pl-1">
            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <User size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Selfies</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <Sun size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Live Photos</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <Crop size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Screenshots</span>
            </button>
          </div>
        )}
      </div>

      {/* Utilities Section (Apple HIG SF Symbols: Hidden, Recently Deleted, Handwriting, Illustrations, QR Codes, Map) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setUtilitiesOpen(!utilitiesOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-zinc-400 hover:text-white font-semibold text-[11px] uppercase tracking-wider"
        >
          <span>Utilities</span>
          <ChevronRight size={14} strokeWidth={2} className={`transition-transform duration-200 ${utilitiesOpen ? 'rotate-90' : ''}`} />
        </button>

        {utilitiesOpen && (
          <div className="space-y-0.5 pt-1 pl-1">
            <button
              type="button"
              onClick={() => onChangeView('locked')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'locked' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <EyeOff size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Hidden</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('trash')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'trash' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Trash2 size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Recently Deleted</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <PenTool size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Handwriting</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <Sparkles size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Illustrations</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <QrCode size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>QR Codes</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <Download size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Recently Saved</span>
            </button>

            <button type="button" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-white/10 transition-colors">
              <Eye size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Recently Viewed</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('appearance')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'appearance' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Palette size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>Appearance</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('utilities')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'utilities' ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Settings size={16} strokeWidth={2} className="text-[#0a84ff]" />
              <span>System Settings</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC<{
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}> = ({ currentView, onChangeView }) => {
  const isAgentEnabled = useSettingsStore((s) => s.isAgentEnabled);
  const { galleryStyle } = useGalleryLayout();

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

  const visibleMainNav = MAIN_NAV.filter(item => item.view !== 'agent' || isAgentEnabled);

  if (galleryStyle === 'apple') {
    return (
      <aside className="w-64 h-screen bg-[#1c1c1e]/90 backdrop-blur-2xl border-r border-white/10 flex flex-col shrink-0 z-30 relative shadow-2xl">
        <AppleSidebarContent currentView={currentView} onChangeView={onChangeView} />
      </aside>
    );
  }

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
            {visibleMainNav.map((item) => (
              <NavItem
                key={item.view}
                {...item}
                currentView={currentView}
                onChangeView={onChangeView}
                onMouseEnter={item.view === 'agent' ? handlePreloadAgent : undefined}
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
