import React, { useState } from 'react';
import { MemoriesCarousel } from '@/components/ui/MemoriesCarousel';
import { OnThisDaySection } from '@/components/explore/OnThisDaySection';
import { AIThemeGrid } from '@/components/explore/AIThemeGrid';
import { SeasonalGrid } from '@/components/explore/SeasonalGrid';
import { EventTimeline } from '@/components/explore/EventTimeline';
import { PhotographyInsights } from '@/components/explore/PhotographyInsights';
import { RecentActivityFeed } from '@/components/explore/RecentActivityFeed';
import { HighlightReelSection } from '@/components/explore/HighlightReelSection';
import { RediscoverPrompts } from '@/components/explore/RediscoverPrompts';
import { ExploreWidgetCustomizer, loadSavedWidgets, WidgetConfig } from '@/components/explore/ExploreWidgetCustomizer';
import { ExploreHeader } from '@/components/explore/ExploreHeader';
import { Compass } from 'lucide-react';

export const ExploreView: React.FC = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadSavedWidgets);

  const renderWidget = (id: string) => {
    switch (id) {
      case 'memories':
        return <MemoriesCarousel key="memories" />;
      case 'insights':
        return <PhotographyInsights key="insights" />;
      case 'rediscover':
        return <RediscoverPrompts key="rediscover" />;
      case 'activity':
        return <RecentActivityFeed key="activity" />;
      case 'highlights':
        return <HighlightReelSection key="highlights" />;
      case 'on-this-day':
        return <OnThisDaySection key="on-this-day" />;
      case 'ai-themes':
        return <AIThemeGrid key="ai-themes" />;
      case 'seasons':
        return <SeasonalGrid key="seasons" />;
      case 'timeline':
        return <EventTimeline key="timeline" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Explore Dashboard Top Toolbar */}
      <div className="px-10 pt-8 pb-2 flex items-center justify-between">
        <ExploreHeader
          icon={<Compass size={18} />}
          title="Explore"
          subtitle="Rediscover memories, explore visual themes, and analyze your photography habits"
          showTimeGreeting={true}
        />
        <ExploreWidgetCustomizer widgets={widgets} onChange={setWidgets} />
      </div>

      {/* Render Widgets in User-Customized Order */}
      <div className="flex flex-col space-y-2 pb-12">
        {widgets.filter(w => w.enabled).map(w => renderWidget(w.id))}
      </div>
    </div>
  );
};
