import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronRight } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/GlassMaterial';
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

const YearCard: React.FC<{
  item: OnThisDayItem;
  index: number;
  onClick: () => void;
}> = ({ item, index, onClick }) => {
  const topPhotos = item.photos.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springs.bouncy, delay: index * 0.1 } as any}
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="shrink-0 w-52 h-64 cursor-pointer group relative"
    >
      <GlassMaterial intensity="regular" className="w-full h-full overflow-hidden border border-white/5">
        <div className="relative h-40 overflow-hidden">
          {topPhotos.length > 0 ? (
            <div className="absolute inset-0">
              {topPhotos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={resolveUrl(photo.url)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                  style={{
                    transform: `translateY(${i * 6}px) scale(${1 - i * 0.04})`,
                    opacity: 1 - i * 0.2,
                    zIndex: topPhotos.length - i,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5">
              <Calendar size={28} className="text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        <div className="p-4 flex flex-col justify-center h-24">
          <span className="text-3xl font-serif italic text-white group-hover:text-primary transition-colors">
            {item.year}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mt-1">
            {item.photo_count} photos
          </span>
        </div>
      </GlassMaterial>

      <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <GlassMaterial intensity="subtle" borderRadius="999px" className="p-2">
          <ChevronRight size={14} className="text-primary" />
        </GlassMaterial>
      </div>
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
        <ExploreHeader icon={<Calendar size={14} />} title="On This Day" subtitle={getTodayFormatted()} />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-52 h-64 rounded-2xl bg-white/5 border border-white/5 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader icon={<Calendar size={14} />} title="On This Day" subtitle={getTodayFormatted()} />
        <GlassMaterial intensity="subtle" className="p-8 text-center border border-white/5">
          <Calendar size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No memories on this day yet</p>
        </GlassMaterial>
      </div>
    );
  }

  return (
    <div className="px-10 py-6 shrink-0">
      <div className="flex items-end justify-between mb-8">
        <ExploreHeader icon={<Calendar size={14} />} title="On This Day" subtitle={getTodayFormatted()} />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
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
