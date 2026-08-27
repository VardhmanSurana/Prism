import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { API_BASE, resolveUrl, photoSrc } from '@/constants';
import { Photo } from '@/types';
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

/** Accent dot colours cycling through the palette */
const ACCENT_DOTS = [
  'bg-blue-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-purple-400',
  'bg-cyan-400',
];

/** Alternating widths for visual rhythm */
const CARD_WIDTHS = ['w-72', 'w-56', 'w-56', 'w-72', 'w-56'];

const ThemeCard: React.FC<{
  theme: Theme;
  index: number;
  onClick: () => void;
}> = ({ theme, index, onClick }) => {
  const photo = theme.photos[0];
  const dotColor = ACCENT_DOTS[index % ACCENT_DOTS.length];
  const cardW = CARD_WIDTHS[index % CARD_WIDTHS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.08 } as any}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`snap-start shrink-0 ${cardW} h-80 rounded-3xl overflow-hidden relative group cursor-pointer border border-white/5 shadow-xl`}
    >
      {photo ? (
        <img
          src={photoSrc(photo, 512)}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <Sparkles size={32} className="text-white/20" />
        </div>
      )}

      {/* Gradient scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">AI Theme</span>
        </div>
        <h3 className="font-serif italic text-2xl text-white capitalize leading-tight">{theme.tag}</h3>
        <p className="text-xs text-white/30 mt-1">{theme.count} photos</p>
      </div>
    </motion.div>
  );
};

/**
 * AIThemeGrid - Renders aitheme grid.
 */
export const AIThemeGrid: React.FC<AIThemeGridProps> = ({ themes: propThemes }) => {
  const [themes, setThemes] = useState<Theme[]>(propThemes || []);
  const [isLoading, setIsLoading] = useState(!propThemes);

  useEffect(() => {
    if (propThemes) return;
    /**
     * fetchThemes - Retrieves fetch themes.
     */
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
        <ExploreHeader label="AI Discovered" title="Themes" />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`shrink-0 ${CARD_WIDTHS[i % CARD_WIDTHS.length]} h-80 rounded-3xl bg-white/5 border border-white/5 animate-pulse`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (themes.length === 0) return null;

  return (
    <div className="px-10 py-6 shrink-0">
      <ExploreHeader label="AI Discovered" title="Themes" />
      <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar scroll-smooth snap-x snap-mandatory">
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
