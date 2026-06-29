import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/GlassMaterial';
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
  const accentIndex = hashString(theme.tag) % ACCENT_PALETTE.length;
  const topPhotos = theme.photos.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.08 } as any}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer group"
    >
      <GlassMaterial intensity="regular" className="overflow-hidden border border-white/5">
        <div className={`relative h-48 bg-gradient-to-br ${ACCENT_PALETTE[accentIndex]}`}>
          {topPhotos.length > 0 ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px]">
              {topPhotos.map((photo, i) => (
                <div key={photo.id} className="relative overflow-hidden">
                  <img
                    src={resolveUrl(photo.url)}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
              ))}
              {topPhotos.length < 4 &&
                Array.from({ length: 4 - topPhotos.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-white/5" />
                ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles size={32} className="text-primary/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${ACCENT_DOTS[accentIndex]}`} />
            <h4 className="text-white font-serif italic text-lg capitalize">{theme.tag}</h4>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
            {theme.count}
          </span>
        </div>
      </GlassMaterial>
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
            <div key={i} className="h-64 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
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
