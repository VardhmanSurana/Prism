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
  const topPhotos = season.photos.slice(0, 4);

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
        <div className={`relative h-48 bg-gradient-to-br ${config.gradient}`}>
          {topPhotos.length > 0 ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px]">
              {topPhotos.map((photo) => (
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
              <span className={config.accent}>{config.icon}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={config.accent}>{config.icon}</span>
            <div>
              <h4 className="text-white font-serif italic text-lg">{season.label}</h4>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
            {season.photo_count}
          </span>
        </div>
      </GlassMaterial>
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
            <div key={i} className="h-64 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
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
