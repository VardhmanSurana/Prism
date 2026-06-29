import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, PartyPopper, Heart, Plane } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/GlassMaterial';
import { springs } from '@/lib/motion-tokens';
import { ExploreHeader } from './ExploreHeader';

interface TimelineEvent {
  id: number;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  photo_count: number;
  cover_photos: Photo[];
  summary: string | null;
}

interface EventTimelineProps {
  events?: TimelineEvent[];
}

const EVENT_STYLES: Record<string, { bg: string; dot: string; icon: React.ReactNode }> = {
  trip: {
    bg: 'bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]',
    icon: <Plane size={10} className="text-blue-400" />,
  },
  birthday: {
    bg: 'bg-pink-500/10 border-pink-500/20',
    dot: 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.5)]',
    icon: <PartyPopper size={10} className="text-pink-400" />,
  },
  holiday: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
    icon: <Heart size={10} className="text-emerald-400" />,
  },
  wedding: {
    bg: 'bg-purple-500/10 border-purple-500/20',
    dot: 'bg-purple-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]',
    icon: <Heart size={10} className="text-purple-400" />,
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-gray-500/10 border-gray-500/20',
  dot: 'bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.5)]',
  icon: <Calendar size={10} className="text-gray-400" />,
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const yearOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-US', yearOpts)} – ${e.toLocaleDateString('en-US', yearOpts)}`;
}

const EventCard: React.FC<{
  event: TimelineEvent;
  index: number;
  isLast: boolean;
  onClick: () => void;
}> = ({ event, index, isLast, onClick }) => {
  const style = EVENT_STYLES[event.event_type] || DEFAULT_STYLE;
  const coverPhotos = event.cover_photos.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springs.gentle, delay: index * 0.1 } as any}
      className="flex gap-6 group"
    >
      <div className="flex flex-col items-center shrink-0">
        <motion.div
          whileHover={{ scale: 1.3 }}
          className={`w-3 h-3 rounded-full ${style.dot} relative z-10`}
        />
        {!isLast && <div className="w-[1px] flex-1 bg-white/10 mt-1" />}
      </div>

      <GlassMaterial
        intensity="regular"
        className={`flex-1 p-5 border ${style.bg} cursor-pointer mb-4`}
        interactive
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${style.bg}`}>
                {style.icon}
                {event.event_type}
              </span>
            </div>
            <h4 className="text-white font-serif italic text-xl truncate">{event.title}</h4>
            <div className="flex items-center gap-3 text-gray-400 text-xs">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatDateRange(event.start_date, event.end_date)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {event.location}
                </span>
              )}
            </div>
            {event.summary && (
              <p className="text-gray-500 text-xs truncate">{event.summary}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
              {event.photo_count}
            </span>
            <span className="block text-[9px] text-gray-600 uppercase tracking-widest">photos</span>
          </div>
        </div>

        {coverPhotos.length > 0 && (
          <div className="flex gap-1.5 mt-4 overflow-hidden">
            {coverPhotos.map((photo) => (
              <div key={photo.id} className="relative h-16 flex-1 min-w-0 rounded-lg overflow-hidden">
                <img
                  src={resolveUrl(photo.url)}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            ))}
          </div>
        )}
      </GlassMaterial>
    </motion.div>
  );
};

export const EventTimeline: React.FC<EventTimelineProps> = ({ events: propEvents }) => {
  const [events, setEvents] = useState<TimelineEvent[]>(propEvents || []);
  const [isLoading, setIsLoading] = useState(!propEvents);

  useEffect(() => {
    if (propEvents) return;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/timeline`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error('Failed to fetch timeline:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, [propEvents]);

  if (isLoading) {
    return (
      <div className="px-10 py-6 shrink-0">
        <ExploreHeader icon={<Calendar size={14} />} title="Event Timeline" />
        <div className="space-y-4 ml-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="px-10 py-6 shrink-0">
      <ExploreHeader icon={<Calendar size={14} />} title="Event Timeline" />
      <div className="ml-4">
        {events.map((event, idx) => (
          <EventCard
            key={event.id}
            event={event}
            index={idx}
            isLast={idx === events.length - 1}
            onClick={() => console.log('Event clicked:', event.title)}
          />
        ))}
      </div>
    </div>
  );
};
