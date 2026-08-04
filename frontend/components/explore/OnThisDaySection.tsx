import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronRight } from 'lucide-react';
import { API_BASE, resolveUrl, photoSrc } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { StoryViewer } from '@/components/viewers/StoryViewer';
import { springs } from '@/lib/motion-tokens';
import { ExploreHeader } from './ExploreHeader';

interface OnThisDayItem {
  year: number;
  photo_count: number;
  photos: Photo[];
}

interface OnThisDaySectionProps {
  items?: OnThisDayItem[];
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

/** Stagger offsets for cinematic card heights, matching the sketch design */
const CARD_MT = ['mt-0', 'mt-0', 'mt-10', 'mt-5', 'mt-14'];

const YearCard: React.FC<{
  item: OnThisDayItem;
  index: number;
  onClick: () => void;
}> = ({ item, index, onClick }) => {
  const topPhotos = item.photos.slice(0, 2);
  const stagger = CARD_MT[index % CARD_MT.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.08 } as any}
      whileHover={{ y: -6, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`shrink-0 w-52 cursor-pointer group ${stagger}`}
    >
      {/* Stacked photo block */}
      <div className="relative h-52 mb-3 rounded-[1.5rem] overflow-hidden">
        {/* Back photo (stacked peek) */}
        {topPhotos[1] && (
          <div
            className="absolute -inset-x-1 -bottom-1 h-52 rounded-[1.5rem] overflow-hidden border border-white/5 opacity-50 scale-[0.96]"
            style={{ zIndex: 0 }}
          >
            <img
              src={photoSrc(topPhotos[1], 512)}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {/* Front photo */}
        {topPhotos[0] ? (
          <div className="absolute inset-0 rounded-[1.5rem] overflow-hidden border border-white/5" style={{ zIndex: 1 }}>
            <img
              src={photoSrc(topPhotos[0], 512)}
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="absolute inset-0 rounded-[1.5rem] bg-white/5 border border-white/5 flex items-center justify-center" style={{ zIndex: 1 }}>
            <Calendar size={28} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" style={{ zIndex: 2 }} />
      </div>

      {/* Year + count */}
      <span className="font-serif italic text-3xl text-white group-hover:text-white/80 transition-colors block">
        {item.year}
      </span>
      <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-white/25 mt-1">
        {item.photo_count} photos
      </span>
    </motion.div>
  );
};

export const OnThisDaySection: React.FC<OnThisDaySectionProps> = ({ items: propItems }) => {
  const [items, setItems] = useState<OnThisDayItem[]>(propItems || []);
  const [isLoading, setIsLoading] = useState(!propItems);
  const [selectedYear, setSelectedYear] = useState<OnThisDayItem | null>(null);

  useEffect(() => {
    if (propItems) return;
    const fetchOnThisDay = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/on-this-day`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (e) {
        console.error('Failed to fetch on-this-day:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOnThisDay();
  }, [propItems]);

  const handleYearClick = useCallback((item: OnThisDayItem) => {
    if (item.photos.length > 0) {
      setSelectedYear(item);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader label="Retro" title="On This Day" subtitle={getTodayFormatted()} />
        <div className="flex gap-5 overflow-hidden items-end">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-52 rounded-[1.5rem] bg-white/5 border border-white/5 animate-pulse shrink-0 ${i === 1 ? 'h-52' : i === 2 ? 'h-44 mt-10' : i === 3 ? 'h-48 mt-5' : 'h-40 mt-14'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader label="Retro" title="On This Day" subtitle={getTodayFormatted()} />
        <GlassMaterial intensity="subtle" className="p-8 text-center border border-white/5">
          <Calendar size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No memories on this day yet</p>
        </GlassMaterial>
      </div>
    );
  }

  return (
    <div className="px-10 py-6 shrink-0">
      {/* Section header row */}
      <div className="flex items-end justify-between mb-8">
        <ExploreHeader label="Retro" title="On This Day" subtitle={getTodayFormatted()} />
        <button className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors flex items-center gap-2 group mb-8">
          View All
          <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Staggered card row — cards align from bottom */}
      <div className="flex gap-5 overflow-x-auto pb-8 custom-scrollbar scroll-smooth items-end">
        {items.map((item, idx) => (
          <YearCard
            key={item.year}
            item={item}
            index={idx}
            onClick={() => handleYearClick(item)}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedYear && (
          <StoryViewer
            highlight={{
              id: String(selectedYear.year),
              title: `${selectedYear.year}`,
              subtitle: `On This Day`,
              type: 'on_this_day',
              photo_count: selectedYear.photo_count,
              cover_url: selectedYear.photos[0]?.url || null,
              photos: selectedYear.photos,
            }}
            onClose={() => setSelectedYear(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
