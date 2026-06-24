import React from 'react';
import { motion } from 'framer-motion';
import type { NavItemData } from '../types/sidebar';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: string;
  currentView: string;
  onChangeView: (view: string) => void;
  onMouseEnter?: () => void;
}

export const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, view, currentView, onChangeView, onMouseEnter }) => {
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
