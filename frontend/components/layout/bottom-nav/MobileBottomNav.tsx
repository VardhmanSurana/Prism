import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Image as ImageIcon,
  FolderHeart,
  Compass,
  Sparkles,
  LayoutGrid,
  Heart,
  Video,
  MapPin,
  Wand2,
  Copy,
  BarChart3,
  Lock,
  Trash2,
  Settings,
  X,
} from 'lucide-react';
import type { ViewMode } from '@/types';

type ExtendedViewMode = ViewMode | 'videos' | 'duplicates' | 'analytics';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

interface NavDestination {
  id: ExtendedViewMode;
  label: string;
  subtitle: string;
  icon: React.ElementType;
}

const PRIMARY_TABS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'gallery', label: 'Library', icon: ImageIcon },
  { id: 'albums', label: 'Albums', icon: FolderHeart },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'agent', label: 'Assistant', icon: Sparkles },
];

const MORE_DESTINATIONS: NavDestination[] = [
  { id: 'albums', label: 'Albums', subtitle: 'Collections & smart sets', icon: FolderHeart },
  { id: 'favorites', label: 'Favorites', subtitle: 'Starred photos & clips', icon: Heart },
  { id: 'videos', label: 'Videos', subtitle: 'Clips & NLE timeline', icon: Video },
  { id: 'map', label: 'Map', subtitle: 'Geotagged locations', icon: MapPin },
  { id: 'agent', label: 'AI Assistant', subtitle: 'Ask & curate with AI', icon: Sparkles },
  { id: 'toolbox', label: 'AI Toolbox', subtitle: 'Enhance, upscale & edit', icon: Wand2 },
  { id: 'duplicates', label: 'Duplicates', subtitle: 'Clean up similar shots', icon: Copy },
  { id: 'analytics', label: 'Analytics', subtitle: 'Library stats & insights', icon: BarChart3 },
  { id: 'locked', label: 'Private Vault', subtitle: 'Protected media', icon: Lock },
  { id: 'trash', label: 'Trash', subtitle: 'Recently deleted items', icon: Trash2 },
  { id: 'utilities', label: 'Settings', subtitle: 'Server, sync & preferences', icon: Settings },
];

const PRIMARY_TAB_IDS = new Set<string>(PRIMARY_TABS.map((t) => t.id));

/**
 * MobileBottomNav - Renders mobile bottom navigation bar and slide-up More drawer.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onChangeView }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isSecondaryViewActive = !PRIMARY_TAB_IDS.has(currentView);
  const isMoreHighlighted = isMoreOpen || isSecondaryViewActive;

  useEffect(() => {
    if (!isMoreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMoreOpen]);

  const handleSelectView = (view: ExtendedViewMode) => {
    onChangeView(view as ViewMode);
    setIsMoreOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              key="mobile-nav-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation destinations"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-[#141722]/95 backdrop-blur-2xl border-t border-white/15 rounded-t-3xl pt-3 pb-24 px-4 max-h-[82dvh] overflow-y-auto shadow-[0_-12px_40px_rgba(0,0,0,0.6)] select-none"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between px-1 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">All Destinations</h2>
                  <p className="text-[11px] text-gray-400">Jump to any workspace or utility</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close navigation menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MORE_DESTINATIONS.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectView(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                        isActive
                          ? 'bg-[#FCBC00]/15 border-[#FCBC00]/60 text-white shadow-[0_0_20px_rgba(252,188,0,0.18)]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-gray-200'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#FCBC00] text-black'
                            : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        <Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold truncate ${isActive ? 'text-[#FCBC00]' : 'text-white'}`}>
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#12151e]/90 backdrop-blur-2xl pb-safe pt-2 px-3 border-t border-white/10 flex items-center justify-around select-none">
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id && !isMoreOpen;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectView(tab.id)}
              className={`relative flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
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

        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          aria-expanded={isMoreOpen}
          aria-label="More destinations"
          className={`relative flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
            isMoreHighlighted ? 'text-black font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          {isMoreHighlighted && (
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
            <LayoutGrid size={20} strokeWidth={isMoreHighlighted ? 2.4 : 1.8} className={isMoreHighlighted ? 'text-black' : ''} />
          </div>
          <span className={`text-[10px] font-sans tracking-tight relative z-10 ${isMoreHighlighted ? 'text-black font-bold' : ''}`}>
            More
          </span>
        </button>
      </nav>
    </>
  );
};
