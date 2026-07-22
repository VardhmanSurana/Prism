import React, { useEffect, useState } from 'react';
import { Compass, UserCheck, FolderPlus, Trash2, MapPin, Sparkles } from 'lucide-react';
import { API_BASE } from '@/constants';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { ExploreHeader } from './ExploreHeader';

interface RediscoverData {
  unnamed_faces_count: number;
  unalbumed_count: number;
  blurry_count: number;
  missing_location_count: number;
}

export const RediscoverPrompts: React.FC = () => {
  const [data, setData] = useState<RediscoverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const fetchPrompts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/rediscover-prompts`);
        if (res.ok && isCurrent) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch rediscover prompts:', err);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void fetchPrompts();
    return () => { isCurrent = false; };
  }, []);

  if (isLoading) {
    return <div className="mx-10 my-6 h-48 animate-pulse rounded-xl bg-white/5" aria-label="Loading rediscover prompts" />;
  }

  if (!data) return null;

  const cards = [
    {
      id: 'faces',
      title: 'Tag Unnamed Faces',
      count: data.unnamed_faces_count,
      description: `${data.unnamed_faces_count} people clusters are waiting for names. Tagging helps AI search recognize family and friends.`,
      icon: <UserCheck size={20} className="text-blue-400" />,
      actionText: 'Review Faces',
      href: '#people',
    },
    {
      id: 'albums',
      title: 'Organise Un-albumed Photos',
      count: data.unalbumed_count,
      description: `${data.unalbumed_count} photos aren't in any album yet. Group them into custom collections for easy access.`,
      icon: <FolderPlus size={20} className="text-emerald-400" />,
      actionText: 'Create Album',
      href: '#albums',
    },
    {
      id: 'blurry',
      title: 'Review Blurry Clutter',
      count: data.blurry_count,
      description: `${data.blurry_count} low-sharpness photos detected. Clear out blurry shots to reclaim disk space.`,
      icon: <Trash2 size={20} className="text-rose-400" />,
      actionText: 'Open Storage Cleanup',
      href: '#cleanup',
    },
    {
      id: 'locations',
      title: 'Geotag Missing Locations',
      count: data.missing_location_count,
      description: `${data.missing_location_count} photos lack GPS coordinates. Add locations on the Map View for travel routes.`,
      icon: <MapPin size={20} className="text-amber-400" />,
      actionText: 'Open Map View',
      href: '#map',
    },
  ].filter(card => card.count > 0);

  if (cards.length === 0) return null;

  return (
    <section className="px-10 py-6 shrink-0" aria-labelledby="rediscover-title">
      <ExploreHeader
        headingId="rediscover-title"
        icon={<Compass size={14} />}
        title="Rediscover & Organise"
        subtitle="Quick micro-tasks to keep your photo library neat and searchable"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <GlassMaterial
            key={card.id}
            intensity="subtle"
            className="flex flex-col justify-between p-5 border border-white/5 hover:border-white/20 transition-all duration-200"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                  {card.icon}
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-semibold text-white">
                  {card.count} items
                </span>
              </div>
              <h4 className="text-base font-semibold text-white mb-1.5">{card.title}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{card.description}</p>
            </div>

            <a
              href={card.href}
              className="mt-5 w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5 text-center"
            >
              <Sparkles size={12} className="text-primary" />
              <span>{card.actionText}</span>
            </a>
          </GlassMaterial>
        ))}
      </div>
    </section>
  );
};
