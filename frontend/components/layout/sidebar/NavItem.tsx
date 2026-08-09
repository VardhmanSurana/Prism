import React from 'react';
import type { NavItemData } from '../types/sidebar';
import { useGalleryLayout } from '@/hooks/useGalleryLayout';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: any;
  currentView: string;
  onChangeView: (view: any) => void;
  onMouseEnter?: () => void;
}

const MATERIAL_ICON_MAP: Record<string, string> = {
  gallery: 'photo_library',
  explore: 'explore',
  map: 'map',
  agent: 'auto_awesome',
  albums: 'photo_album',
  people: 'group',
  projects: 'movie',
  trash: 'delete',
  utilities: 'settings',
  locked: 'lock',
};

export const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, view, currentView, onChangeView, onMouseEnter }) => {
  const { galleryStyle } = useGalleryLayout();
  const isActive = currentView === view;

  if (galleryStyle === 'google') {
    const materialSymbol = MATERIAL_ICON_MAP[view] || 'circle';
    return (
      <button
        onClick={() => onChangeView(view)}
        onMouseEnter={onMouseEnter}
        className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-sans rounded-full transition-colors duration-150, background-color 150ms ease relative group select-none
          ${isActive ? 'bg-[#004A77] text-[#C2E7FF] font-medium shadow-sm' : 'text-[#C4C6D0] hover:bg-white/10 hover:text-white font-normal'}`}
      >
        <span className={`material-symbols-outlined text-[20px] leading-none ${isActive ? 'text-[#C2E7FF]' : 'text-[#C4C6D0] group-hover:text-white'}`}>
          {materialSymbol}
        </span>
        <span className="tracking-normal font-sans text-xs">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onChangeView(view)}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-4 px-6 py-3.5 text-sm transition-colors duration-300 relative group
        ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'}`}
    >
      <div
        className={`absolute inset-y-1.5 left-2 right-2 bg-white/[0.05] rounded-xl border border-white/5 shadow-inner
          transition-opacity duration-200 ease-out, transition-transform 200ms cubic-bezier(0.23, 1, 0.32, 1)
          ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-full blur-[1px]" />
      </div>
      <Icon size={18} className={`transition-colors duration-300 relative z-10 ${isActive ? 'text-primary' : 'group-hover:text-primary/50'}`} />
      <span className={`tracking-tight relative z-10 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
};
