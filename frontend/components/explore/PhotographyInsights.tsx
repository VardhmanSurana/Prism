import React, { useEffect, useState } from 'react';
import { Aperture, ScanLine } from 'lucide-react';
import { API_BASE } from '@/constants';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { ExploreHeader } from './ExploreHeader';

interface RankedInsight {
  label: string;
  count: number;
}

interface PhotographyInsightsData {
  photo_count: number;
  cameras: RankedInsight[];
  locations: RankedInsight[];
  average_iso: number | null;
  average_focal_length: number | null;
  favorite_focal_length: number | null;
  metadata_coverage: Record<'camera' | 'focal_length' | 'iso' | 'location', number>;
}

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const RankingList: React.FC<{ items: RankedInsight[]; emptyLabel: string }> = ({ items, emptyLabel }) => {
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  if (!items.length) return <p className="text-sm text-gray-500 py-3">{emptyLabel}</p>;

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
          <div className="min-w-0">
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate text-gray-200">{item.label}</span>
              <span className="shrink-0 text-gray-500">{formatCount(item.count)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary/80" style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

export const PhotographyInsights: React.FC = () => {
  const [insights, setInsights] = useState<PhotographyInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const loadInsights = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/explore/insights`);
        if (response.ok && isCurrent) setInsights(await response.json());
      } catch (error) {
        console.error('Failed to fetch photography insights:', error);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void loadInsights();
    return () => { isCurrent = false; };
  }, []);

  if (isLoading) {
    return <div className="mx-10 my-6 h-64 animate-pulse rounded-xl bg-white/5" aria-label="Loading photography insights" />;
  }

  if (!insights || insights.photo_count === 0) return null;

  const hasTechnicalData = insights.metadata_coverage.camera || insights.metadata_coverage.focal_length || insights.metadata_coverage.iso;
  return (
    <section className="px-10 py-6 shrink-0" aria-labelledby="photography-insights-title">
      <ExploreHeader headingId="photography-insights-title" icon={<Aperture size={14} />} title="Your photography, in focus" subtitle={`${formatCount(insights.photo_count)} photos analysed`} />
      {!hasTechnicalData ? (
        <GlassMaterial intensity="subtle" className="p-6 border border-white/5">
          <div className="flex gap-3">
            <ScanLine size={20} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h4 className="font-medium text-white">Add a camera roll to reveal your shooting habits</h4>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">These photos do not include usable camera EXIF data yet. New imports with camera metadata will surface lens, ISO, and camera insights here.</p>
            </div>
          </div>
        </GlassMaterial>
      ) : (
        <div className="space-y-4">
          <div className="bg-surface border border-white/5 rounded-xl p-5">
            <div className="mb-5 text-sm font-medium text-white">How you shoot</div>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <div><dt className="text-xs text-gray-500">Favourite focal length</dt><dd className="mt-1 text-2xl font-medium text-white">{insights.favorite_focal_length ? `${insights.favorite_focal_length} mm` : '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Average ISO</dt><dd className="mt-1 text-2xl font-medium text-white">{insights.average_iso ? formatCount(insights.average_iso) : '—'}</dd></div>
              <div className="col-span-2 border-t border-white/10 pt-4"><dt className="text-xs text-gray-500">Average focal length</dt><dd className="mt-1 text-base text-gray-200">{insights.average_focal_length ? `${insights.average_focal_length} mm` : 'No lens metadata yet'}</dd></div>
            </dl>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3 bg-surface border border-white/5 rounded-xl p-5">
              <div className="mb-5 text-sm font-medium text-white">Most-used cameras</div>
              <RankingList items={insights.cameras} emptyLabel="No camera metadata yet" />
            </div>
            <div className="lg:col-span-2 bg-surface border border-white/5 rounded-xl p-5">
              <div className="mb-5 text-sm font-medium text-white">Places photographed</div>
              <RankingList items={insights.locations} emptyLabel="No location metadata yet" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
