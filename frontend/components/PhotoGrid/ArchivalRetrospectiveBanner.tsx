import React, { useState, useMemo } from 'react';
import { X, Sparkles, Film } from 'lucide-react';
import { Photo } from '@/types';

export interface ArchivalRetrospectiveBannerProps {
  photos: Photo[];
  onReliveMemory?: (memoryPhotos: Photo[]) => void;
}

export const ArchivalRetrospectiveBanner: React.FC<ArchivalRetrospectiveBannerProps> = React.memo(({
  photos,
  onReliveMemory,
}) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('prism_retrospective_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const memoryData = useMemo(() => {
    if (photos.length === 0) return null;

    // Look for photos taken in the same month in past years or highest rated/favorited photos
    const now = new Date();
    const currentMonth = now.getMonth();

    const historicalCandidates = photos.filter((p) => {
      if (!p.date) return false;
      const d = new Date(p.date);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() < now.getFullYear();
    });

    const candidatePool = historicalCandidates.length >= 3 ? historicalCandidates : photos;
    const sample = candidatePool.slice(0, Math.min(14, candidatePool.length));

    // Find location or summary if present
    const locationName = sample.find((p) => p.location || p.city)?.location ||
      sample.find((p) => p.location || p.city)?.city ||
      'Maritime & Terraces';

    const title = sample[0]?.caption || `Autumn Exposures over ${locationName}`;
    const subtext = sample.length > 1
      ? `Curated 35mm archival captures preserved in uncompressed dynamic range.`
      : `High-fidelity master plate preserved in local library.`;

    const yearDiff = historicalCandidates.length >= 3 && sample[0]?.date
      ? Math.max(1, now.getFullYear() - new Date(sample[0].date).getFullYear())
      : 1;

    return {
      title,
      subtext,
      timeLabel: `${yearDiff} Year${yearDiff > 1 ? 's' : ''} Ago Today`,
      photos: sample,
    };
  }, [photos]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('prism_retrospective_dismissed', 'true');
    } catch {}
  };

  if (isDismissed || !memoryData || memoryData.photos.length === 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1c1917] via-[#181514] to-[#1f1b19] border border-[#292524] p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)] my-4">
      {/* Atmospheric Ambient Glows */}
      <div className="pointer-events-none absolute -right-12 -top-12 w-64 h-64 rounded-full bg-[#818cf8]/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 -bottom-10 w-48 h-48 rounded-full bg-[#f97316]/15 blur-2xl" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#292524] border border-[#373433] text-[#f5f5f4] font-medium">
              Archival Retrospective
            </span>
            <span className="text-xs text-[#a8a29e] flex items-center gap-1 font-mono">
              <Film size={12} className="text-[#a8a29e]" />
              {memoryData.timeLabel}
            </span>
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl text-[#f5f5f4] tracking-tight font-light leading-snug">
            {memoryData.title}
          </h3>

          <p className="text-sm text-[#a8a29e] leading-relaxed">
            {memoryData.subtext}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={() => onReliveMemory?.(memoryData.photos)}
            className="px-4 py-2 rounded-full bg-[#f5f5f4] text-[#151312] text-xs font-semibold shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:bg-white active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-[#151312]" />
            Relive Memory ({memoryData.photos.length})
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss memory banner"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:text-[#f5f5f4] hover:bg-[#23201e] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

ArchivalRetrospectiveBanner.displayName = 'ArchivalRetrospectiveBanner';
