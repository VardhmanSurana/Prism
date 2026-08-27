import React from 'react';
import { Image as ImageIcon, Compass, MapPin, Settings } from 'lucide-react';
import type { ViewMode } from '@/types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

/**
 * MobileBottomNav - Renders mobile bottom nav.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onChangeView }) => {
  const tabs: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: 'gallery', label: 'Library', icon: ImageIcon },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'utilities', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12151e]/90 backdrop-blur-2xl pb-safe pt-2 px-6 border-t border-white/10 flex items-center justify-around select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeView(tab.id)}
            className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all duration-200 active:scale-90 ${
              isActive ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
              )}
            </div>
            <span className="text-[10px] font-sans tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
