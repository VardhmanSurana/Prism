import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { StoryViewer } from '@/components/viewers/StoryViewer';
import { GlassMaterial, GlassEffectContainer } from '@/components/ui/GlassMaterial';
import { springs } from '@/lib/motion-tokens';

interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  photo_count: number;
  cover_url: string | null;
  photos: Photo[];
}

const MemoryCard: React.FC<{
  highlight: Highlight;
  index: number;
  onClick: () => void;
  isHero?: boolean;
}> = ({ highlight, index, onClick, isHero = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.06 } as any}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative rounded-[2.5rem] overflow-hidden cursor-pointer group shrink-0 border border-white/5 shadow-2xl transition-shadow duration-500 hover:shadow-primary/10
        ${isHero ? 'w-[28rem] h-[32rem]' : 'w-56 h-[24rem]'}`}
    >
      {highlight.cover_url ? (
        <motion.img
          src={resolveUrl(highlight.cover_url)}
          alt={highlight.title}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface/40 text-gray-500 gap-3">
          {highlight.type === 'on_this_day' ? <Calendar size={isHero ? 48 : 32} /> : <MapPin size={isHero ? 48 : 32} />}
          <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-50">Memory</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="absolute -inset-[100%] bg-[radial-gradient(circle_at_50%_50%,rgba(var(--color-primary),0.06),transparent_50%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {isHero && (
        <div className="absolute top-8 left-8 flex items-center gap-2">
          <GlassMaterial intensity="subtle" borderRadius="999px" className="px-3 py-1 flex items-center gap-2 border-primary/20">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),0.8)]" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Featured Story</span>
          </GlassMaterial>
        </div>
      )}

      <div className={`absolute rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/90 group-hover:text-primary transition-all duration-500 group-hover:border-primary/30 group-hover:scale-110 shadow-xl
        ${isHero ? 'top-8 right-8 w-12 h-12' : 'top-6 right-6 w-9 h-9'}`}>
        {highlight.type === 'on_this_day' ? <Calendar size={isHero ? 20 : 14} /> : <MapPin size={isHero ? 20 : 14} />}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-1`}>
        <motion.div
          initial={false}
          animate={{ x: 0 }}
          whileHover={{ x: 5 }}
          className="flex flex-col items-start"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary/80 mb-2 flex items-center gap-2">
            <span className="w-4 h-[1px] bg-primary/30" />
            {highlight.type === 'on_this_day' ? 'Retro Lookback' : 'Travel Log'} • {highlight.photo_count}
          </p>
          <h4 className={`text-white leading-tight font-serif italic tracking-normal transition-colors duration-500 group-hover:text-primary
            ${isHero ? 'text-4xl' : 'text-xl'}`}>
            {highlight.title}
          </h4>
          <p className="text-[11px] text-gray-400 font-medium mt-2 tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
            {highlight.subtitle}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export const MemoriesCarousel: React.FC = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchHighlights();
  }, []);

  const fetchHighlights = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/albums/memories/highlights`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(data);
      }
    } catch (e) {
      console.error("Failed to fetch memories highlights:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && highlights.length === 0) {
    return (
      <div className="px-10 pt-12 pb-6 shrink-0 animate-pulse">
        <div className="h-6 w-64 bg-white/5 rounded-full mb-8" />
        <div className="flex gap-8 overflow-x-auto pb-6">
          <div className="w-[28rem] h-[32rem] rounded-[2.5rem] bg-white/5 border border-white/5 shrink-0" />
          {[1, 2].map((i) => (
            <div key={i} className="w-56 h-[24rem] rounded-[2.5rem] bg-white/5 border border-white/5 mt-auto shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (highlights.length === 0) return null;

  return (
    <div className="px-10 pt-12 pb-6 shrink-0 select-none relative z-10">
      <div className="flex items-end justify-between mb-8">
        <div className="space-y-1">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-primary/60"
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.4em]">Curated</span>
          </motion.div>
          <h3 className="text-4xl font-serif italic text-white tracking-tight">Your Memories</h3>
        </div>
        <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-primary transition-colors group">
          View All Stories
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="flex gap-8 overflow-x-auto pb-10 custom-scrollbar scroll-smooth items-end snap-x snap-mandatory">
        <GlassEffectContainer className="flex gap-8 items-end">
          {highlights.map((highlight, idx) => (
            <div key={highlight.id} className="snap-start">
              <MemoryCard
                highlight={highlight}
                index={idx}
                isHero={idx === 0}
                onClick={() => setSelectedHighlight(highlight)}
              />
            </div>
          ))}
        </GlassEffectContainer>
      </div>

      <AnimatePresence>
        {selectedHighlight && (
          <StoryViewer
            highlight={selectedHighlight}
            onClose={() => setSelectedHighlight(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
