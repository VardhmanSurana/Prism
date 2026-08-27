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

/**
 * formatCount - Formats format count.
 */
const formatCount = (value: number) => new Intl.NumberFormat().format(value);

/**
 * RankingList - Renders ranking list.
 */
const RankingList: React.FC<{ items: RankedInsight[]; emptyLabel: string }> = ({ items, emptyLabel }) => {
  /**
   * maxCount - Performs max count.
   */
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

/**
 * PhotographyInsights - Renders photography insights.
 */
export const PhotographyInsights: React.FC = () => {
  const [insights, setInsights] = useState<PhotographyInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    /**
     * loadInsights - Performs load insights.
     */
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
      <ExploreHeader
        headingId="photography-insights-title"
        label="Analytics"
        title="Your photography, in focus"
        subtitle={`${formatCount(insights.photo_count)} photos analysed`}
      />
      {!hasTechnicalData ? (
        <GlassMaterial intensity="subtle" className="p-6 border border-white/5">
          <div className="flex gap-3">
            <ScanLine size={20} className="mt-0.5 shrink-0 text-white/40" />
            <div>
              <h4 className="font-medium text-white">Add a camera roll to reveal your shooting habits</h4>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/30">These photos do not include usable camera EXIF data yet. New imports with camera metadata will surface lens, ISO, and camera insights here.</p>
            </div>
          </div>
        </GlassMaterial>
      ) : (
        <div className="space-y-4">
          {/* Big stat row — glass cards with large numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">Favourite Lens</p>
              <p className="text-3xl font-sans font-semibold text-white">
                {insights.favorite_focal_length ? `${insights.favorite_focal_length}mm` : '—'}
              </p>
              <p className="text-[11px] text-white/25 mt-1">Prime</p>
            </div>
            <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">Average ISO</p>
              <p className="text-3xl font-sans font-semibold text-white">
                {insights.average_iso ? formatCount(insights.average_iso) : '—'}
              </p>
              <p className="text-[11px] text-white/25 mt-1">Low-light ready</p>
            </div>
            <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">Total Photos</p>
              <p className="text-3xl font-sans font-semibold text-white">{formatCount(insights.photo_count)}</p>
              <p className="text-[11px] text-white/25 mt-1">In your library</p>
            </div>
            <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">Avg Focal Length</p>
              <p className="text-3xl font-sans font-semibold text-white">
                {insights.average_focal_length ? `${insights.average_focal_length}mm` : '—'}
              </p>
              <p className="text-[11px] text-white/25 mt-1">All shots</p>
            </div>
          </div>

          {/* Camera ranking + locations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3 bg-white/[0.04] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-medium text-white mb-5">Most-used cameras</p>
              <RankingList items={insights.cameras} emptyLabel="No camera metadata yet" />
            </div>
            <div className="lg:col-span-2 bg-white/[0.04] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-medium text-white mb-5">Places photographed</p>
              <RankingList items={insights.locations} emptyLabel="No location metadata yet" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
