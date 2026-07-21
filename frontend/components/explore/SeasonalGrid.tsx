import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Sun, Wind, Snowflake } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { springs } from '@/lib/motion-tokens';
import { ExploreHeader } from './ExploreHeader';

interface Season {
  label: string;
  season: string;
  year: number;
  photo_count: number;
  photos: Photo[];
}

interface SeasonalGridProps {
  seasons?: Season[];
}

const SEASON_CONFIG: Record<string, { icon: React.ReactNode; accent: string; gradient: string }> = {
  spring: {
    icon: <Leaf size={16} />,
    accent: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-900/5',
  },
  summer: {
    icon: <Sun size={16} />,
    accent: 'text-amber-400',
    gradient: 'from-amber-500/20 to-amber-900/5',
  },
  autumn: {
    icon: <Wind size={16} />,
    accent: 'text-orange-400',
    gradient: 'from-orange-500/20 to-orange-900/5',
  },
  winter: {
    icon: <Snowflake size={16} />,
    accent: 'text-blue-400',
    gradient: 'from-blue-500/20 to-blue-900/5',
  },
};

const DEFAULT_CONFIG = {
  icon: <Sun size={16} />,
  accent: 'text-gray-400',
  gradient: 'from-gray-500/20 to-gray-900/5',
};

const SeasonCard: React.FC<{
  season: Season;
  index: number;
  onClick: () => void;
}> = ({ season, index, onClick }) => {
  const config = SEASON_CONFIG[season.season] || DEFAULT_CONFIG;
  const photo = season.photos[0];

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
          <span className={config.accent}>{config.icon}</span>
        </div>
      )}

      {/* Black blurred bar overlay at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/5 py-4 px-4 flex flex-col items-center justify-center">
        <h4 className="text-white font-sans text-base font-bold capitalize tracking-wide select-none">
          {season.label}
        </h4>
        <span className="text-[11px] font-sans font-semibold text-white/50 tracking-wider mt-1 select-none">
          {season.photo_count}
        </span>
      </div>
    </motion.div>
  );
};

export const SeasonalGrid: React.FC<SeasonalGridProps> = ({ seasons: propSeasons }) => {
  const [seasons, setSeasons] = useState<Season[]>(propSeasons || []);
  const [isLoading, setIsLoading] = useState(!propSeasons);

  useEffect(() => {
    if (propSeasons) return;
    const fetchSeasons = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/seasons`);
        if (res.ok) {
          const data = await res.json();
          setSeasons(data.seasons || []);
        }
      } catch (e) {
        console.error('Failed to fetch seasons:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSeasons();
  }, [propSeasons]);

  if (isLoading) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader icon={<Sun size={14} />} title="Seasonal Collections" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (seasons.length === 0) return null;

  return (
    <div className="px-10 py-6 shrink-0">
      <ExploreHeader icon={<Sun size={14} />} title="Seasonal Collections" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {seasons.map((season, idx) => (
          <SeasonCard
            key={`${season.season}-${season.year}`}
            season={season}
            index={idx}
            onClick={() => console.log('Season clicked:', season.label)}
          />
        ))}
      </div>
    </div>
  );
};
