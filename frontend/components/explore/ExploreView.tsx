import React from 'react';
import { MemoriesCarousel } from '@/components/ui/MemoriesCarousel';
import { OnThisDaySection } from '@/components/explore/OnThisDaySection';
import { AIThemeGrid } from '@/components/explore/AIThemeGrid';
import { SeasonalGrid } from '@/components/explore/SeasonalGrid';
import { EventTimeline } from '@/components/explore/EventTimeline';

export const ExploreView: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      <MemoriesCarousel />
      <OnThisDaySection />
      <AIThemeGrid />
      <SeasonalGrid />
      <EventTimeline />
    </div>
  );
};
