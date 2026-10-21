import React from 'react';
import { ViewMode } from '@/types';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: ViewMode;
  currentView: string;
  onChangeView: (view: ViewMode) => void;
  onMouseEnter?: () => void;
}

/**
 * NavItem - Renders a sleek pill nav item matching Prism Dark Basalt aesthetics.
 */
export const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  view,
  currentView,
  onChangeView,
  onMouseEnter,
}) => {
  const isActive = currentView === view;

  return (
    <button
      type="button"
      onClick={() => onChangeView(view)}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-full transition-colors duration-150 relative text-left cursor-pointer group ${
        isActive
          ? 'bg-[#302d2c] text-[#f5f0ed] font-medium'
          : 'text-[#aba19c] hover:text-[#f5f0ed] hover:bg-[#201e1d]/70'
      }`}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        className={`shrink-0 transition-colors duration-150 ${
          isActive ? 'text-[#f5f0ed]' : 'text-[#aba19c] group-hover:text-[#f5f0ed]'
        }`}
      />
      <span className="text-[13.5px] tracking-tight truncate leading-none">
        {label}
      </span>
    </button>
  );
};

