import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, ShieldCheck, PlayCircle, Play,
  ChevronRight, ArrowRight, Calendar, Film, X, ScanLine, Users,
} from 'lucide-react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { API_BASE, resolveUrl, photoSrc } from '@/constants';
import { Photo, ViewMode } from '@/types';
import { StoryViewer } from '@/components/viewers/StoryViewer';
import { apiClient } from '@/services/apiClient';
import { formatBytes } from '@/components/layout/sidebar/useSidebar';

interface RankedInsight {
  label: string;
  count: number;
}

interface InsightsData {
  photo_count: number;
  cameras: RankedInsight[];
  locations: RankedInsight[];
  average_iso: number | null;
  average_focal_length: number | null;
  metadata_coverage?: { camera: number; focal_length: number; iso: number; location: number };
}

interface StatsData {
  total_photos: number;
  total_videos: number;
  favorites_count: number;
  storage_used_bytes: number;
}

interface ThemeCluster {
  tag: string;
  count: number;
  photos: Photo[];
}

interface OnThisDayItem {
  year: number;
  photo_count: number;
  photos: Photo[];
}

interface SeasonCard {
  label: string;
  season: string;
  year: number;
  photo_count: number;
  photos: Photo[];
}

interface SmartAlbumTile {
  id: number;
  name: string;
  smart_type?: string | null;
  photo_count: number;
  cover_url?: string | null;
}

interface HighlightReel {
  id: string;
  event_id: number;
  title: string;
  subtitle: string;
  location?: string | null;
  photo_count: number;
  cover_photos: Photo[];
  summary?: string | null;
}

interface PersonRow {
  id: number;
  name: string;
  cover_face_thumbnail?: string | null;
}

interface CaptureBucket {
  date: string;
  count: number;
}

interface HeatCell {
  date: string;
  count: number;
  level: number;
}

/** j - Fetches JSON from the backend, resolving null on failure. */
const j = async <T,>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.ok) return (await res.json()) as T;
  } catch (e) {
    console.error(`Explore fetch failed: ${path}`, e);
  }
  return null;
};

/** withUrls - Ensures every photo has a displayable thumbnail url for StoryViewer. */
const withUrls = (photos: Photo[]): Photo[] =>
  photos.map((p) =>
    p.url && p.url.trim().length > 0 ? p : { ...p, url: `/api/v1/photos/${p.uuid || p.id}/thumbnail` }
  );

/** cameraLine - Builds a real EXIF camera/lens caption, or null when absent. */
const cameraLine = (p?: Photo): string | null => {
  if (!p) return null;
  const body = [p.exif_make, p.exif_model].filter(Boolean).join(' ').trim();
  const parts: string[] = [];
  if (body) parts.push(body);
  if (p.exif_focal_length) parts.push(`${p.exif_focal_length}mm`);
  return parts.length ? parts.join(' · ') : null;
};

/** photoPlace - Builds a city/country caption from a photo, or null when absent. */
const photoPlace = (p?: Photo): string | null => {
  if (!p) return null;
  const place = [p.city, p.country].filter(Boolean).join(', ').trim();
  return place.length > 0 ? place : null;
};

/** buildHeatmap - Turns daily capture buckets into a weekday x week grid. */
const buildHeatmap = (buckets: CaptureBucket[], days: number): HeatCell[][] => {
  const counts = new Map(buckets.map((b) => [b.date, b.count]));
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 1);
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let start = end - (days > 0 ? days - 1 : 364) * 86400000;
  if (days <= 0 && buckets.length > 0) {
    const [y, m, d] = buckets[0].date.split('-').map(Number);
    start = Date.UTC(y, m - 1, d);
  }
  start -= new Date(start).getUTCDay() * 86400000; // align to Sunday
  const weeks: HeatCell[][] = [];
  let week: HeatCell[] = [];
  for (let t = start; t <= end; t += 86400000) {
    const dt = new Date(t);
    const date = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
      dt.getUTCDate()
    ).padStart(2, '0')}`;
    const count = counts.get(date) ?? 0;
    const level = count === 0 ? 0 : count <= max * 0.25 ? 1 : count <= max * 0.6 ? 2 : 3;
    week.push({ date, count, level });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
};

/** monthName - Formats a YYYY-MM string as a short month-year label. */
const monthName = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** smartIcon - Maps a smart album type to its tile emoji. */
const smartIcon = (smartType?: string | null): string => {
  if (smartType === 'screenshots') return '📱';
  if (smartType === 'documents') return '📄';
  if (smartType === 'places') return '🗺️';
  return '🗂️';
};

/**
 * ExploreView - Prism Semantic Discoveries & Intelligent Studio Core
 */
export const ExploreView: React.FC<{ onNavigate?: (v: ViewMode) => void }> = ({ onNavigate }) => {
  const { logAction } = useTelemetry();
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [retro, setRetro] = useState<OnThisDayItem[]>([]);
  const [seasons, setSeasons] = useState<SeasonCard[]>([]);
  const [themes, setThemes] = useState<ThemeCluster[]>([]);
  const [albums, setAlbums] = useState<SmartAlbumTile[]>([]);
  const [reels, setReels] = useState<HighlightReel[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [buckets, setBuckets] = useState<CaptureBucket[]>([]);
  const [timeframe, setTimeframe] = useState<'12m' | 'all'>('12m');

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [results, setResults] = useState<Photo[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [isDockVisible, setIsDockVisible] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [story, setStory] = useState<{ title: string; subtitle: string; photos: Photo[] } | null>(null);

  useEffect(() => {
    logAction('ExploreView', 'page_view', { studio: 'Prism Semantic Core' });
  }, [logAction]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [st, ins, otd, ss, th, al, hl, pp] = await Promise.all([
        j<StatsData>('/api/v1/photos/stats'),
        j<InsightsData>('/api/v1/explore/insights'),
        j<{ items: OnThisDayItem[] }>('/api/v1/explore/on-this-day'),
        j<{ seasons: SeasonCard[] }>('/api/v1/explore/seasons'),
        j<{ themes: ThemeCluster[] }>('/api/v1/explore/themes'),
        j<SmartAlbumTile[]>('/api/v1/albums/smart'),
        j<{ highlights: HighlightReel[] }>('/api/v1/explore/highlights'),
        j<PersonRow[]>('/api/v1/people'),
      ]);
      if (!alive) return;
      if (st) setStats(st);
      if (ins) setInsights(ins);
      setRetro(otd?.items ?? []);
      setSeasons((ss?.seasons ?? []).slice().sort((a, b) => b.year - a.year));
      setThemes(th?.themes ?? []);
      setAlbums(al ?? []);
      setReels(hl?.highlights ?? []);
      setPeople(pp ?? []);
      setIsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const days = timeframe === '12m' ? 365 : 0;
      const data = await j<{ buckets: CaptureBucket[] }>(`/api/v1/explore/capture-activity?days=${days}`);
      if (alive) setBuckets(data?.buckets ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [timeframe]);

  /** openPhotos - Opens the shared story viewer over a real photo set. */
  const openPhotos = useCallback((title: string, subtitle: string, photos: Photo[]) => {
    const normalized = withUrls(photos);
    if (normalized.length > 0) setStory({ title, subtitle, photos: normalized });
  }, []);

  /** runSearch - Runs a real caption/location/tag search against the explore endpoint. */
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setActiveQuery(null);
      setResults(null);
      return;
    }
    setSearching(true);
    setActiveQuery(trimmed);
    const photos = await j<Photo[]>(`/api/v1/explore?query=${encodeURIComponent(trimmed)}&limit=50`);
    setResults(photos ?? []);
    setSearching(false);
  }, []);

  /** openSmartAlbum - Fetches a smart album's photos and opens them in the viewer. */
  const openSmartAlbum = useCallback(
    async (album: SmartAlbumTile) => {
      const data = await j<{ photos: Photo[] }>(
        `/api/v1/albums/smart/photos?album_id=${album.id}&limit=100`
      );
      openPhotos(album.name, `${album.photo_count} photos`, data?.photos ?? []);
    },
    [openPhotos]
  );

  /** openInNLE - Generates a highlight reel project and opens it in the projects view. */
  const openInNLE = useCallback(
    async (reel: HighlightReel) => {
      setGeneratingId(reel.id);
      try {
        const gen = await apiClient.post<{
          name: string;
          tracks: { clips?: unknown[] }[];
          fps: number;
          width: number;
          height: number;
        }>('/api/v1/explore/highlights/generate', { event_id: reel.event_id });
        if (!gen?.tracks?.[0]?.clips?.length) return;
        const projectJson = JSON.stringify({
          tracks: gen.tracks,
          duration: 0,
          playheadPosition: 0,
          zoomLevel: 100,
          scrollOffset: 0,
        });
        const created = await apiClient.post<{ id: number }>('/api/v1/nle/projects', {
          name: gen.name,
          width: gen.width,
          height: gen.height,
          fps: gen.fps,
          project_json: projectJson,
        });
        onNavigate?.('projects');
        navigate(`/projects/${created.id}`);
      } catch (e) {
        console.error('Failed to generate highlight reel:', e);
      } finally {
        setGeneratingId(null);
      }
    },
    [navigate, onNavigate]
  );

  const chips = useMemo<{ label: string; value: string }[]>(() => {
    const list: { label: string; value: string }[] = [];
    for (const loc of insights?.locations ?? []) {
      if (loc.label) list.push({ label: loc.label, value: loc.label });
    }
    for (const t of themes.slice(0, 4)) {
      if (t.tag) list.push({ label: `#${t.tag}`, value: t.tag });
    }
    const seen = new Set<string>();
    const unique: { label: string; value: string }[] = [];
    for (const c of list) {
      if (!seen.has(c.value)) {
        seen.add(c.value);
        unique.push(c);
      }
    }
    return unique.slice(0, 6);
  }, [insights, themes]);

  const weeks = useMemo(() => buildHeatmap(buckets, timeframe === '12m' ? 365 : 0), [buckets, timeframe]);

  const topMonths = useMemo(() => {
    const agg = new Map<string, number>();
    for (const b of buckets) {
      const ym = b.date.slice(0, 7);
      agg.set(ym, (agg.get(ym) ?? 0) + b.count);
    }
    return Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([ym, count]) => ({ label: monthName(ym), count }));
  }, [buckets]);

  const cameraTotal = useMemo(
    () => (insights?.cameras ?? []).reduce((sum, c) => sum + c.count, 0),
    [insights]
  );

  const hero = retro[0] ?? null;
  const sideSeasons = seasons.slice(0, hero ? 2 : 3);
  const totalAssets = stats ? stats.total_photos + stats.total_videos : null;

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#151312] overflow-y-auto px-4 md:px-8 py-6 select-none relative font-sans text-[#e7e1df]">
      {/* ── Subtle Ambient Atmospheric Backlights ── */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-20 w-[520px] h-[520px] bg-[#c6c6c7]/5 rounded-full blur-[140px]" />
        <div className="absolute top-96 right-10 w-[420px] h-[420px] bg-[#484745]/15 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col gap-10 pb-16">
        {/* ── Section 1: Page Header & Real Library Telemetry ── */}
        <section className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 text-[#998f8a]">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#d0c4be]">
                  Intelligent Studio Core
                </span>
                <span className="w-1 h-1 rounded-full bg-[#998f8a]" />
                <span className="text-[11px] font-mono tracking-wider text-[#998f8a]">
                  INDEX://{stats ? 'READY' : 'LOADING'}
                </span>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl text-[#e7e1df] tracking-tight font-normal leading-tight">
                Explore & Semantic Discoveries
              </h1>
              <p className="text-[13px] text-[#a8a29e] leading-relaxed mt-1">
                Local machine intelligence, entirely on-device.
                {totalAssets !== null ? ` ${totalAssets.toLocaleString()} assets indexed with zero cloud ingestion.` : ''}
              </p>
            </div>

            {/* Library Telemetry Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d1b1a] border border-white/[0.05] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#86efac] shadow-[0_0_8px_#86efac]" />
                <span className="text-[11px] font-mono text-[#e7e1df]">
                  {totalAssets !== null ? `${totalAssets.toLocaleString()} assets indexed` : 'Indexing library…'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1d1b1a] border border-white/[0.05] shadow-sm">
                <Sparkles size={13} className="text-[#c6c6c7]" />
                <span className="text-[11px] font-mono text-[#d0c4be]">
                  {stats ? `${stats.favorites_count.toLocaleString()} favorites` : 'Favorites'}
                  {stats ? ` · ${formatBytes(stats.storage_used_bytes)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2c2928] text-[#e7e1df] border border-white/[0.08] shadow-sm">
                <ShieldCheck size={14} className="text-[#86efac]" />
                <span className="text-[11px] font-mono">Zero Cloud Upload Guaranteed</span>
              </div>
            </div>
          </div>

          {/* Real Search Prompt Chips */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a] font-semibold">
                Search Your Library
              </span>
              <span className="text-[10px] font-mono text-[#998f8a]">
                {searching
                  ? 'Searching…'
                  : results !== null
                  ? `${results.length} results for "${activeQuery}"`
                  : 'Matches captions · locations · auto-tags'}
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {chips.map((c) => {
                const isSelected = activeQuery === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setQuery(isSelected ? '' : c.value);
                      runSearch(isSelected ? '' : c.value);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shadow-sm group cursor-pointer border ${
                      isSelected
                        ? 'bg-[#c6c6c7] text-[#2f3131] border-white/20'
                        : 'bg-[#1d1b1a] hover:bg-[#211f1e] text-[#e7e1df] border-white/[0.05]'
                    }`}
                  >
                    <span className={isSelected ? 'text-[#2f3131] font-semibold' : 'group-hover:text-[#c6c6c7] transition-colors'}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch(query);
                }}
                placeholder="Custom search…"
                className="w-40 px-3.5 py-1.5 rounded-full bg-[#2c2928] hover:bg-[#373433] focus:bg-[#373433] text-[#c9c6c4] placeholder-[#78716c] text-xs font-medium transition-colors border border-white/[0.06] outline-none"
              />
            </div>

            {results !== null && !searching && (
              results.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 pt-1">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openPhotos(`Search: ${activeQuery}`, `${results.length} matches`, results)}
                      className="aspect-square rounded-lg overflow-hidden bg-[#2c2928] hover:ring-1 hover:ring-white/20 transition-all cursor-pointer"
                    >
                      <img src={photoSrc(p, 400)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#998f8a] pt-1">No matches for "{activeQuery}".</p>
              )
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-56 h-4 rounded-full bg-[#211f1e] animate-pulse" />
            <div className="w-72 h-3 rounded-full bg-[#211f1e] animate-pulse" />
            <div className="w-40 h-3 rounded-full bg-[#211f1e] animate-pulse" />
          </div>
        ) : (
          <>
            {/* ── Section 2: Flagship Retrospectives ("On This Day") ── */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-[#c6c6c7]" />
                  <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                    Temporal Retrospectives & Chronicles
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#998f8a]">
                  {retro.length + seasons.length} memories from your library
                </span>
              </div>

              {hero || sideSeasons.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Card 1: Hero Retrospective */}
                  {hero && (
                    <div className="lg:col-span-7 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="flex flex-col gap-2 z-10">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#2c2928] text-[#c9c6c4] border border-white/[0.04]">
                            {hero.year} · On This Day
                          </span>
                          <span className="text-[11px] font-mono text-[#998f8a]">{hero.photo_count} photos</span>
                        </div>
                        <div>
                          <h3 className="font-serif text-2xl text-[#e7e1df] tracking-tight group-hover:text-[#c6c6c7] transition-colors">
                            Remembered from {hero.year}
                          </h3>
                          {(photoPlace(hero.photos[0]) || cameraLine(hero.photos[0])) && (
                            <p className="text-xs text-[#a8a29e] flex items-center gap-1.5 pt-0.5">
                              {photoPlace(hero.photos[0]) && <span>{photoPlace(hero.photos[0])}</span>}
                              {photoPlace(hero.photos[0]) && cameraLine(hero.photos[0]) && (
                                <span className="opacity-40">·</span>
                              )}
                              {cameraLine(hero.photos[0]) && (
                                <span className="font-mono">{cameraLine(hero.photos[0])}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Mosaic Image Collage */}
                      <div className="grid grid-cols-3 gap-2 my-4 z-10">
                        <div className="col-span-2 h-64 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                          <img
                            src={photoSrc(hero.photos[0], 800)}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d]/80 via-transparent to-transparent" />
                          {(hero.photos[0]?.exif_iso || hero.photos[0]?.exif_focal_length) && (
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#100e0d]/90 text-[#e7e1df] backdrop-blur-md border border-white/[0.08]">
                                {[
                                  hero.photos[0]?.exif_iso ? `ISO ${hero.photos[0]?.exif_iso}` : '',
                                  hero.photos[0]?.exif_focal_length ? `${hero.photos[0]?.exif_focal_length}mm` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="col-span-1 flex flex-col gap-2 h-64">
                          <div className="h-1/2 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                            {hero.photos[1] && (
                              <img src={photoSrc(hero.photos[1], 400)} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="h-1/2 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                            {hero.photos[2] && (
                              <img src={photoSrc(hero.photos[2], 400)} alt="" className="w-full h-full object-cover" />
                            )}
                            {hero.photo_count > 3 && (
                              <div className="absolute inset-0 bg-[#100e0d]/70 backdrop-blur-sm flex items-center justify-center">
                                <span className="text-xs font-mono text-[#e7e1df] font-medium">
                                  +{hero.photo_count - 3} more
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center justify-between pt-1 z-10 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5 text-[#998f8a] text-[11px] font-mono">
                          <Sparkles size={13} className="text-[#c6c6c7]" />
                          <span>{hero.photo_count} photos in this retrospective</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPhotos(`Remembered from ${hero.year}`, `${hero.photo_count} photos`, hero.photos)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#e7e1df] text-[#151312] hover:bg-[#c6c6c7] text-xs font-medium transition-all shadow-sm cursor-pointer"
                        >
                          <PlayCircle size={15} />
                          <span>Relive Retrospective</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Split Cards: Seasons */}
                  <div className={`${hero ? 'lg:col-span-5' : 'lg:col-span-12'} flex flex-col gap-4`}>
                    {sideSeasons.map((s, i) => (
                      <div
                        key={`${s.season}-${s.year}`}
                        className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group"
                      >
                        <div className="flex items-center justify-between pb-1.5">
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#2c2928] text-[#d0c4be]">
                            {s.label}
                          </span>
                          <span className="text-[11px] font-mono text-[#998f8a]">{s.photo_count} photos</span>
                        </div>
                        <div className="flex gap-3.5 items-center py-1">
                          <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-inner bg-[#2c2928]">
                            {s.photos[0] && (
                              <img
                                src={photoSrc(s.photos[0], 400)}
                                alt=""
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <h3 className="font-serif text-lg text-[#e7e1df] truncate group-hover:text-[#c6c6c7] transition-colors leading-tight">
                              {s.label}
                            </h3>
                            <p className="text-xs text-[#a8a29e] truncate">
                              {photoPlace(s.photos[0]) || `${s.season} collection`}
                            </p>
                            {cameraLine(s.photos[0]) && (
                              <span className="text-[10px] font-mono text-[#c6c6c7] mt-0.5 truncate">
                                {cameraLine(s.photos[0])}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => openPhotos(s.label, `${s.photo_count} photos`, s.photos)}
                            className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium transition-all cursor-pointer border border-white/[0.04]"
                          >
                            <span>{i === 0 ? 'Inspect Memory' : 'View Collection'}</span>
                            {i === 0 ? <ChevronRight size={14} /> : <ArrowRight size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-8 text-center text-xs text-[#998f8a]">
                  No retrospectives yet — memories appear once your library spans past years and seasons.
                </div>
              )}
            </section>

            {/* ── Section 3: High-Dimensional Topological Projections (Bento Grid) ── */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a]">
                    High-Dimensional Topological Projections
                  </span>
                  <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                    Algorithmic Clusters & Semantic Landscapes
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#998f8a]">{themes.length} auto-tagged clusters</span>
              </div>

              {themes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {themes.map((t, idx) => {
                    const isLead = idx === 0;
                    const title = t.tag.charAt(0).toUpperCase() + t.tag.slice(1);
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => openPhotos(title, `${t.count} photos tagged ${t.tag}`, t.photos)}
                        className={`${
                          isLead ? 'lg:col-span-2' : ''
                        } bg-[#1d1b1a] hover:bg-[#211f1e] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group overflow-hidden text-left transition-colors cursor-pointer`}
                      >
                        <div className="flex items-center justify-between pb-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                              <span className="text-[10px] font-mono text-[#c6c6c7]">
                                #{t.tag.toUpperCase()} · {t.count} PHOTOS
                              </span>
                            </div>
                            <h3
                              className={`font-serif ${isLead ? 'text-2xl' : 'text-xl'} text-[#e7e1df] pt-0.5 group-hover:text-[#c6c6c7] transition-colors`}
                            >
                              {title}
                            </h3>
                          </div>
                          <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#2c2928] text-[#e7e1df] border border-white/[0.06]">
                            {t.count} assets
                          </span>
                        </div>

                        {isLead ? (
                          <div className="grid grid-cols-4 gap-2 my-2 h-44">
                            {[0, 1, 2, 3].map((i) => (
                              <div key={i} className="h-full rounded-xl overflow-hidden shadow-inner bg-[#2c2928]">
                                {t.photos[i] && (
                                  <img
                                    src={photoSrc(t.photos[i], 400)}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-40 rounded-xl overflow-hidden my-2 relative shadow-inner bg-[#2c2928]">
                            {t.photos[0] && (
                              <img
                                src={photoSrc(t.photos[0], 600)}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.04]">
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#211f1e] text-[#d0c4be]">
                            #{t.tag}
                          </span>
                          <span className="text-[10px] font-mono text-[#998f8a]">
                            {t.photos.length >= t.count ? `${t.count} photos` : `${t.count} photos · showing ${t.photos.length}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-8 text-center text-xs text-[#998f8a]">
                  No clusters yet — auto-tagged themes appear after AI classification runs on your library.
                </div>
              )}
            </section>

            {/* ── Section 4: Smart Albums & Highlight Reels ── */}
            <section className="flex flex-col gap-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Column A: Smart Albums */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScanLine size={18} className="text-[#c6c6c7]" />
                      <h2 className="font-serif text-xl text-[#e7e1df] tracking-tight font-normal">Smart Albums</h2>
                    </div>
                    <span className="text-[10px] font-mono text-[#998f8a]">Auto-classified</span>
                  </div>

                  {albums.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {albums.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openSmartAlbum(a)}
                          className="bg-[#1d1b1a] hover:bg-[#211f1e] border border-white/[0.05] hover:border-white/[0.1] p-3 rounded-xl flex flex-col justify-between transition-all cursor-pointer shadow-sm group text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-full bg-[#2c2928] flex items-center justify-center text-sm group-hover:bg-[#c6c6c7] transition-all">
                              {smartIcon(a.smart_type)}
                            </div>
                            <span className="text-[10px] font-mono text-[#998f8a]">{a.photo_count} photos</span>
                          </div>
                          <div className="pt-3">
                            <h4 className="text-xs font-medium text-[#e7e1df] leading-snug group-hover:text-[#c6c6c7] transition-colors">
                              {a.name}
                            </h4>
                            <p className="text-[10px] font-mono text-[#998f8a] pt-0.5">{a.smart_type ?? 'auto'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-6 text-center text-xs text-[#998f8a]">
                      No smart albums yet — run auto-classification from Utilities to create them.
                    </div>
                  )}
                </div>

                {/* Column B: Highlight Reels */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film size={18} className="text-[#c6c6c7]" />
                      <h2 className="font-serif text-xl text-[#e7e1df] tracking-tight font-normal">Highlight Reels</h2>
                    </div>
                    <span className="text-[10px] font-mono text-[#998f8a]">{reels.length} from detected events</span>
                  </div>

                  {reels.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {reels.map((reel) => {
                        const generating = generatingId === reel.id;
                        return (
                          <div
                            key={reel.id}
                            className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col md:flex-row gap-4 shadow-sm group"
                          >
                            <div className="w-full md:w-56 h-36 rounded-xl overflow-hidden relative shrink-0 shadow-inner bg-[#2c2928]">
                              {reel.cover_photos[0] && (
                                <img
                                  src={photoSrc(reel.cover_photos[0], 600)}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              )}
                              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/80 text-[#e7e1df] text-[10px] font-mono backdrop-blur-md border border-white/[0.06]">
                                {reel.photo_count} photos
                              </div>
                              <button
                                type="button"
                                onClick={() => openPhotos(reel.title, reel.subtitle, reel.cover_photos)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#100e0d]/70 backdrop-blur-md flex items-center justify-center text-[#e7e1df] hover:scale-110 transition-transform cursor-pointer"
                              >
                                <Play size={13} className="ml-0.5 fill-current" />
                              </button>
                            </div>

                            <div className="flex flex-col justify-between flex-1 min-w-0">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-[#c6c6c7]">HIGHLIGHT REEL</span>
                                  <span className="text-[10px] font-mono text-[#998f8a] truncate pl-2">
                                    {reel.location ?? reel.subtitle}
                                  </span>
                                </div>
                                <h3 className="font-serif text-lg text-[#e7e1df] leading-tight">{reel.title}</h3>
                                <p className="text-xs text-[#a8a29e] line-clamp-2">{reel.summary ?? reel.subtitle}</p>
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <span className="text-[10px] font-mono text-[#998f8a]">
                                  {reel.photo_count} photos · {reel.subtitle}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openPhotos(reel.title, reel.subtitle, reel.cover_photos)}
                                    className="flex items-center gap-1 text-xs font-medium text-[#e7e1df] hover:text-[#c6c6c7] transition-colors cursor-pointer"
                                  >
                                    <PlayCircle size={14} />
                                    <span>View Photos</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={generating}
                                    onClick={() => openInNLE(reel)}
                                    className="px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] disabled:opacity-60 text-[#e7e1df] text-xs font-medium transition-colors flex items-center gap-1 border border-white/[0.04] cursor-pointer disabled:cursor-wait"
                                  >
                                    <Film size={13} />
                                    <span>{generating ? 'Building…' : 'Open in NLE'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-6 text-center text-xs text-[#998f8a]">
                      No highlight reels yet — reels appear once events are detected in your library.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 5: Archival Library Analytics & Camera Telemetry ── */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a]">
                    METRICS://EXIF_DISTRIBUTION
                  </span>
                  <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                    Archival Library Analytics & Camera Telemetry
                  </h2>
                </div>

                {/* Timeframe Toggle */}
                <div className="flex items-center p-1 rounded-full bg-[#100e0d] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setTimeframe('12m')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      timeframe === '12m'
                        ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm'
                        : 'text-[#998f8a] hover:text-[#e7e1df]'
                    }`}
                  >
                    Past 12 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeframe('all')}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                      timeframe === 'all'
                        ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm'
                        : 'text-[#998f8a] hover:text-[#e7e1df]'
                    }`}
                  >
                    All Time{totalAssets !== null ? ` (${totalAssets.toLocaleString()} Assets)` : ''}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Panel: Exposure Activity Density Heat Map */}
                <div className="lg:col-span-7 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between pb-4">
                    <div>
                      <h3 className="font-serif text-lg text-[#e7e1df]">Visual Capture Activity Density</h3>
                      <p className="text-xs text-[#a8a29e]">Daily capture counts from your local library</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-[#998f8a]">
                      <span>Less</span>
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#2c2928]" />
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#484745]" />
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#c9c6c4]" />
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                      <span>More</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto pb-2 scrollbar-none">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-[#998f8a] px-1">
                        <span>{weeks.length > 0 && monthName(weeks[0][0].date.slice(0, 7))}</span>
                        <span>{weeks.length > 0 && monthName(weeks[weeks.length - 1][6]?.date.slice(0, 7) ?? weeks[weeks.length - 1][0].date.slice(0, 7))}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                          <div key={dow} className="flex gap-1">
                            {weeks.map((week, wIdx) => {
                              const cell = week[dow];
                              if (!cell) return <div key={wIdx} className="w-3.5 h-3" />;
                              const bg =
                                cell.level === 3
                                  ? 'bg-amber-400'
                                  : cell.level === 2
                                  ? 'bg-[#c9c6c4]'
                                  : cell.level === 1
                                  ? 'bg-[#484745]'
                                  : 'bg-[#211f1e]';
                              return (
                                <div
                                  key={wIdx}
                                  className={`w-3.5 h-3 rounded-sm ${bg}`}
                                  title={`${cell.date}: ${cell.count} photo${cell.count === 1 ? '' : 's'}`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Activity Peaks */}
                  <div className="pt-3 flex flex-wrap items-center gap-4 border-t border-white/[0.04]">
                    {topMonths.length > 0 ? (
                      topMonths.map((m, i) => (
                        <div key={m.label} className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-[#c9c6c4]'}`}
                          />
                          <span className="text-xs text-[#e7e1df]">
                            {m.label}: <strong className="font-semibold">+{m.count.toLocaleString()} photos</strong>
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-[#998f8a]">No captures in this range yet.</span>
                    )}
                  </div>
                </div>

                {/* Right Panel: Optics & Sensor Telemetry */}
                <div className="lg:col-span-5 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between pb-2">
                    <h3 className="font-serif text-lg text-[#e7e1df]">Most Used Cameras</h3>
                    <span className="text-[10px] font-mono text-[#998f8a]">EXIF Verified</span>
                  </div>

                  <div className="flex flex-col gap-2.5 my-1">
                    {(insights?.cameras ?? []).length > 0 ? (
                      (insights?.cameras ?? []).map((cam, idx) => {
                        const pct = cameraTotal > 0 ? Math.round((cam.count / cameraTotal) * 100) : 0;
                        const color = idx === 0 ? 'bg-[#c6c6c7]' : idx === 1 ? 'bg-[#c9c6c4]' : 'bg-[#484745]';
                        return (
                          <div key={cam.label} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#e7e1df] truncate">{cam.label}</span>
                              <span className="font-mono text-[#c9c6c4] text-[11px]">
                                {pct}% · {cam.count.toLocaleString()} photos
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#2c2928] overflow-hidden">
                              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[#998f8a] py-2">No EXIF camera data in the library yet.</p>
                    )}
                  </div>

                  {/* Bottom Focal & ISO Telemetry Badges */}
                  <div className="pt-3 grid grid-cols-2 gap-3 border-t border-white/[0.04]">
                    <div className="p-2.5 rounded-xl bg-[#211f1e] flex flex-col gap-0.5 border border-white/[0.04]">
                      <span className="text-[10px] font-mono text-[#998f8a]">Average Focal Length</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-serif text-[#e7e1df]">
                          {insights?.average_focal_length != null ? `${insights.average_focal_length}mm` : '—'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#7d7e7f]">
                        from {insights?.metadata_coverage?.focal_length ?? 0} tagged photos
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#211f1e] flex flex-col gap-0.5 border border-white/[0.04]">
                      <span className="text-[10px] font-mono text-[#998f8a]">Average ISO</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-serif text-[#e7e1df]">
                          {insights?.average_iso != null ? insights.average_iso : '—'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#7d7e7f]">
                        from {insights?.metadata_coverage?.iso ?? 0} tagged photos
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Section 6: Recurring Subjects Floating Dock (Bottom-Right) ── */}
      {isDockVisible && people.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full bg-[#211f1e]/95 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/[0.1] transition-all duration-300">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#100e0d] text-[#c9c6c4] border border-white/[0.06]">
              <Users size={12} className="text-amber-300" />
              <span className="text-[10px] font-mono font-medium">Recurring Subjects</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDockVisible(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#998f8a] hover:text-[#e7e1df] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="pt-1">
            <h3 className="font-serif text-base text-[#e7e1df]">Recognised People</h3>
            <p className="text-[11px] text-[#a8a29e] leading-snug pt-0.5">
              Face clusters computed on-device — biometrics never leave this machine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 py-3">
            {people.slice(0, 8).map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onNavigate?.('people')}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-[#1d1b1a] hover:bg-[#2c2928] border border-white/[0.04] transition-colors text-left group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#100e0d] flex items-center justify-center text-xs shadow-inner overflow-hidden shrink-0">
                  {person.cover_face_thumbnail ? (
                    <img
                      src={resolveUrl(person.cover_face_thumbnail)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    '👤'
                  )}
                </div>
                <span className="text-xs text-[#e7e1df] truncate group-hover:text-[#c6c6c7] transition-colors font-medium">
                  {person.name}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => onNavigate?.('people')}
              className="w-full py-1.5 rounded-full bg-[#e7e1df] text-[#151312] hover:bg-[#c6c6c7] text-xs font-medium text-center transition-all shadow-sm cursor-pointer"
            >
              Open People View
            </button>
          </div>
        </div>
      )}

      {/* ── Shared Story Viewer ── */}
      {story && (
        <StoryViewer
          highlight={{
            id: 'explore-view',
            title: story.title,
            subtitle: story.subtitle,
            type: 'memory',
            photo_count: story.photos.length,
            cover_url: story.photos[0]?.url ?? null,
            photos: story.photos,
          }}
          onClose={() => setStory(null)}
        />
      )}
    </div>
  );
};
