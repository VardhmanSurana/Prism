import React from 'react';
import { MemoriesCarousel } from '@/components/ui/MemoriesCarousel';
import { OnThisDaySection } from '@/components/explore/OnThisDaySection';
import { AIThemeGrid } from '@/components/explore/AIThemeGrid';
import { SeasonalGrid } from '@/components/explore/SeasonalGrid';
import { EventTimeline } from '@/components/explore/EventTimeline';
import { PhotographyInsights } from '@/components/explore/PhotographyInsights';

export const ExploreView: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      <MemoriesCarousel />
      <PhotographyInsights />
      <OnThisDaySection />
      <AIThemeGrid />
      <SeasonalGrid />
      <EventTimeline />
    </div>
  );
};
