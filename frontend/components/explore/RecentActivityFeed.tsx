import React, { useEffect, useState } from 'react';
import { Activity, Image, FolderPlus, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { API_BASE } from '@/constants';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { ExploreHeader } from './ExploreHeader';
import { Photo } from '@/types';

interface ActivityItem {
  id: string;
  type: 'import' | 'album' | 'ai_search';
  title: string;
  subtitle: string;
  timestamp: string;
  photo_count?: number;
  photos?: Photo[];
  cover_url?: string;
  session_id?: string;
}

const timeAgo = (isoString: string) => {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
};

export const RecentActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/activity`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity feed:', err);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void fetchActivity();
    return () => { isCurrent = false; };
  }, []);

  if (isLoading) {
    return <div className="mx-10 my-6 h-48 animate-pulse rounded-xl bg-white/5" aria-label="Loading activity feed" />;
  }

  if (!activities || activities.length === 0) return null;

  return (
    <section className="px-10 py-6 shrink-0" aria-labelledby="recent-activity-title">
      <ExploreHeader
        headingId="recent-activity-title"
        icon={<Activity size={14} />}
        title="Recent Activity"
        subtitle="Your latest imports, edits, and AI search sessions"
      />
      <div className="space-y-3">
        {activities.map((item) => (
          <GlassMaterial
            key={item.id}
            intensity="subtle"
            className="p-4 border border-white/5 hover:border-white/15 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-primary shrink-0 mt-0.5">
                  {item.type === 'import' && <Image size={18} />}
                  {item.type === 'album' && <FolderPlus size={18} />}
                  {item.type === 'ai_search' && <Sparkles size={18} />}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">{item.subtitle}</p>

                  {/* Optional photo thumbnails preview for import activity */}
                  {item.photos && item.photos.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
                      {item.photos.slice(0, 5).map((photo) => (
                        <div key={photo.id} className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                          <img
                            src={photo.url || `${API_BASE}/api/v1/photos/${photo.id}/file`}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                <Clock size={12} />
                <span>{timeAgo(item.timestamp)}</span>
              </div>
            </div>
          </GlassMaterial>
        ))}
      </div>
    </section>
  );
};
