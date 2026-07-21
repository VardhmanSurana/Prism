import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { springs } from '@/lib/motion-tokens';
import { ExploreHeader } from './ExploreHeader';

interface Theme {
  tag: string;
  count: number;
  photos: Photo[];
}

interface AIThemeGridProps {
  themes?: Theme[];
}

const ACCENT_PALETTE = [
  'from-blue-500/20 to-blue-600/5',
  'from-purple-500/20 to-purple-600/5',
  'from-emerald-500/20 to-emerald-600/5',
  'from-amber-500/20 to-amber-600/5',
  'from-rose-500/20 to-rose-600/5',
  'from-cyan-500/20 to-cyan-600/5',
];

const ACCENT_DOTS = [
  'bg-blue-400',
  'bg-purple-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-cyan-400',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ThemeCard: React.FC<{
  theme: Theme;
  index: number;
  onClick: () => void;
}> = ({ theme, index, onClick }) => {
  const photo = theme.photos[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.08 } as any}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer group relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-[#0F1115] shadow-xl"
    >
      {photo ? (
        <img
          src={resolveUrl(photo.url)}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Sparkles size={32} className="text-primary/30" />
        </div>
      )}

      {/* Black blurred bar overlay at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/5 py-4 px-4 flex flex-col items-center justify-center">
        <h4 className="text-white font-sans text-base font-bold capitalize tracking-wide select-none">
          {theme.tag}
        </h4>
        <span className="text-[11px] font-sans font-semibold text-white/50 tracking-wider mt-1 select-none">
          {theme.count}
        </span>
      </div>
    </motion.div>
  );
};

export const AIThemeGrid: React.FC<AIThemeGridProps> = ({ themes: propThemes }) => {
  const [themes, setThemes] = useState<Theme[]>(propThemes || []);
  const [isLoading, setIsLoading] = useState(!propThemes);

  useEffect(() => {
    if (propThemes) return;
    const fetchThemes = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/themes`);
        if (res.ok) {
          const data = await res.json();
          setThemes(data.themes || []);
        }
      } catch (e) {
        console.error('Failed to fetch themes:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchThemes();
  }, [propThemes]);

  if (isLoading) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader icon={<Sparkles size={14} />} title="AI Themes" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (themes.length === 0) return null;

  return (
    <div className="px-10 py-6 shrink-0">
      <ExploreHeader icon={<Sparkles size={14} />} title="AI Themes" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme, idx) => (
          <ThemeCard
            key={theme.tag}
            theme={theme}
            index={idx}
            onClick={() => console.log('Theme clicked:', theme.tag)}
          />
        ))}
      </div>
    </div>
  );
};
