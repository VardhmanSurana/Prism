import React from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Compass, MapPin, Settings } from 'lucide-react';
import type { ViewMode } from '@/types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onChangeView }) => {
  const tabs: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: 'gallery', label: 'Library', icon: ImageIcon },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'utilities', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12151e]/90 backdrop-blur-2xl pb-safe pt-2 px-4 border-t border-white/10 flex items-center justify-around select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeView(tab.id)}
            className={`relative flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-2xl transition-all duration-200 active:scale-90 ${
              isActive ? 'text-black font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeMobileNavTab"
                className="absolute inset-0 rounded-2xl bg-[#FCBC00] shadow-[0_0_16px_rgba(252,188,0,0.45)] z-0"
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 32,
                }}
              />
            )}
            <div className="relative z-10">
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? 'text-black' : ''} />
            </div>
            <span className={`text-[10px] font-sans tracking-tight relative z-10 ${isActive ? 'text-black font-bold' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
