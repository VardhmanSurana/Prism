import React, { useEffect, useState } from 'react';
import { Film, Play, Scissors, Sparkles, X } from 'lucide-react';
import { API_BASE } from '@/constants';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { ExploreHeader } from './ExploreHeader';
import { Photo } from '@/types';
import { useNLEStore } from '@/store/nleStore';

interface HighlightReel {
  id: string;
  event_id: number | null;
  title: string;
  subtitle: string;
  location?: string;
  duration_sec: number;
  photo_count: number;
  cover_photos: Photo[];
  summary: string;
}

export const HighlightReelSection: React.FC = () => {
  const [highlights, setHighlights] = useState<HighlightReel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePreview, setActivePreview] = useState<HighlightReel | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const fetchHighlights = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/explore/highlights`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          setHighlights(data.highlights || []);
        }
      } catch (err) {
        console.error('Failed to fetch highlight reels:', err);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void fetchHighlights();
    return () => { isCurrent = false; };
  }, []);

  const handleOpenInEditor = async (reel: HighlightReel) => {
    setIsGenerating(reel.id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/explore/highlights/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: reel.event_id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.project_json) {
          const project = JSON.parse(data.project_json);
          const { setTracks, setProjectName } = useNLEStore.getState();
          if (project.tracks) setTracks(project.tracks);
          if (project.name) setProjectName(project.name);
          // Navigate or open video editor tab if needed
          alert(`Highlight project '${reel.title}' generated and loaded into Video Editor!`);
        }
      }
    } catch (err) {
      console.error('Failed to generate video project:', err);
    } finally {
      setIsGenerating(null);
    }
  };

  if (isLoading) {
    return <div className="mx-10 my-6 h-64 animate-pulse rounded-xl bg-white/5" aria-label="Loading highlight reels" />;
  }

  if (!highlights || highlights.length === 0) return null;

  return (
    <section className="px-10 py-6 shrink-0" aria-labelledby="highlight-reels-title">
      <ExploreHeader
        headingId="highlight-reels-title"
        icon={<Film size={14} />}
        title="Auto-Generated Highlight Reels"
        subtitle="Cinematic memory compilations automatically assembled for you"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {highlights.map((reel) => {
          const mainCover = reel.cover_photos[0];
          return (
            <GlassMaterial
              key={reel.id}
              intensity="subtle"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-5 hover:border-primary/40 transition-all duration-300"
            >
              <div>
                {/* Reel Cover Collapsed Preview */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-4 bg-black/40 border border-white/10 group-hover:scale-[1.01] transition-transform duration-300">
                  {mainCover ? (
                    <img
                      src={mainCover.url || `${API_BASE}/api/v1/photos/${mainCover.id}/file`}
                      alt={reel.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <Film size={32} />
                    </div>
                  )}

                  {/* Duration & Count Overlay Badge */}
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white flex items-center gap-1.5">
                    <Sparkles size={11} className="text-primary" />
                    <span>{reel.duration_sec}s</span>
                  </div>

                  {/* Play Hover Trigger */}
                  <button
                    onClick={() => setActivePreview(reel)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-primary/90 text-black flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
                    aria-label={`Preview ${reel.title}`}
                  >
                    <Play size={20} className="fill-black ml-0.5" />
                  </button>
                </div>

                <h4 className="text-lg font-serif font-bold text-white tracking-tight">{reel.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{reel.subtitle}</p>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{reel.summary}</p>
              </div>

              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/10">
                <button
                  onClick={() => setActivePreview(reel)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play size={13} />
                  <span>Play Reel</span>
                </button>
                <button
                  onClick={() => handleOpenInEditor(reel)}
                  disabled={isGenerating === reel.id}
                  className="px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 text-xs font-medium text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Scissors size={13} />
                  <span>{isGenerating === reel.id ? 'Generating...' : 'Edit in NLE'}</span>
                </button>
              </div>
            </GlassMaterial>
          );
        })}
      </div>

      {/* Reel Playback Modal */}
      {activePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6">
          <div className="relative w-full max-w-3xl rounded-2xl bg-surface border border-white/15 p-6 shadow-2xl">
            <button
              onClick={() => setActivePreview(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-serif font-bold text-white mb-1">{activePreview.title}</h3>
            <p className="text-xs text-gray-400 mb-4">{activePreview.subtitle}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              {activePreview.cover_photos.map((p) => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={p.url || `${API_BASE}/api/v1/photos/${p.id}/file`}
                    alt={p.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-300 mt-2">{activePreview.summary}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setActivePreview(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-sm font-medium text-white hover:bg-white/15"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleOpenInEditor(activePreview);
                  setActivePreview(null);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-black font-medium text-sm hover:bg-primary/90 flex items-center gap-2"
              >
                <Scissors size={15} />
                Open Project in Video Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
