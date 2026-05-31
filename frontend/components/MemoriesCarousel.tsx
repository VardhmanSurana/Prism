import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, MapPin } from 'lucide-react';
import { API_BASE, resolveUrl } from '../constants';
import { Photo } from '../types';
import { StoryViewer } from './StoryViewer';

interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  photo_count: number;
  cover_url: string | null;
  photos: Photo[];
}

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
      <div className="px-8 pt-6 pb-2 shrink-0 animate-pulse">
        <div className="h-4 w-40 bg-white/5 rounded mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-44 h-56 rounded-3xl bg-white/5 border border-white/5 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (highlights.length === 0) return null;

  return (
    <div className="px-8 pt-6 pb-2 shrink-0 select-none">
      <h3 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 flex items-center gap-1.5">
        <Sparkles size={12} className="text-yellow-500 animate-pulse" />
        Memories & Highlights
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-3 custom-scrollbar scroll-smooth">
        {highlights.map((highlight) => (
          <div 
            key={highlight.id}
            onClick={() => setSelectedHighlight(highlight)}
            className="relative w-44 h-56 rounded-3xl overflow-hidden cursor-pointer group shrink-0 border border-white/5 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            {highlight.cover_url ? (
              <img 
                src={resolveUrl(highlight.cover_url)} 
                alt={highlight.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surfaceHover text-gray-500 gap-2">
                {highlight.type === 'on_this_day' ? <Calendar size={24} /> : <MapPin size={24} />}
                <span className="text-[10px] font-mono tracking-widest uppercase">Memory</span>
              </div>
            )}
            
            {/* Ambient Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Badge Icon */}
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 group-hover:text-primary transition-all">
              {highlight.type === 'on_this_day' ? <Calendar size={12} /> : <MapPin size={12} />}
            </div>

            {/* Meta Text */}
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[9px] uppercase tracking-wider font-bold text-yellow-500 mb-0.5">
                {highlight.type === 'on_this_day' ? 'Retro' : 'Trip'} • {highlight.photo_count} items
              </p>
              <h4 className="text-xs font-bold text-white leading-tight group-hover:text-primary transition-colors truncate">
                {highlight.title}
              </h4>
              <p className="text-[9px] text-gray-400 font-mono mt-0.5 truncate">{highlight.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedHighlight && (
        <StoryViewer 
          highlight={selectedHighlight} 
          onClose={() => setSelectedHighlight(null)} 
        />
      )}
    </div>
  );
};
