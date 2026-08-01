import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Sun, Wind, Snowflake } from 'lucide-react';
import { API_BASE, resolveUrl, photoSrc } from '@/constants';
import { Photo } from '@/types';
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

const SEASON_CONFIG: Record<
  string,
  { icon: React.ReactNode; accent: string; tint: string; emoji: string }
> = {
  spring: {
    icon: <Leaf size={16} />,
    accent: 'text-emerald-400',
    tint: 'from-emerald-900/40',
    emoji: '🌿',
  },
  summer: {
    icon: <Sun size={16} />,
    accent: 'text-amber-400',
    tint: 'from-amber-900/40',
    emoji: '☀️',
  },
  autumn: {
    icon: <Wind size={16} />,
    accent: 'text-orange-400',
    tint: 'from-orange-900/40',
    emoji: '🍂',
  },
  winter: {
    icon: <Snowflake size={16} />,
    accent: 'text-blue-400',
    tint: 'from-blue-900/40',
    emoji: '❄️',
  },
};

const DEFAULT_CONFIG = {
  icon: <Sun size={16} />,
  accent: 'text-gray-400',
  tint: 'from-gray-900/40',
  emoji: '📷',
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
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="aspect-[3/4] rounded-3xl overflow-hidden relative group cursor-pointer border border-white/5 shadow-xl"
    >
      {photo ? (
        <img
          src={photoSrc(photo, 512)}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <span className={config.accent}>{config.icon}</span>
        </div>
      )}

      {/* Season-tinted atmospheric gradient */}
      <div className={`absolute inset-0 bg-gradient-to-t ${config.tint} via-transparent to-transparent`} />
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Centered bottom label */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
        <span className={`${config.accent} text-lg`}>{config.emoji}</span>
        <h3 className="font-serif italic text-xl text-white mt-1 capitalize">{season.label}</h3>
        <p className="text-[10px] font-mono text-white/30 mt-1">{season.photo_count} photos</p>
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
        <ExploreHeader label="Collections" title="Seasonal" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (seasons.length === 0) return null;

  return (
    <div className="px-10 py-6 shrink-0">
      <ExploreHeader label="Collections" title="Seasonal" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
