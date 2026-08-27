import React, { useState, useEffect, useCallback } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
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

/**
 * ExploreView - Renders explore view.
 */
export const ExploreView: React.FC = () => {
  const { logAction } = useTelemetry();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadSavedWidgets);

  useEffect(() => {
    logAction('ExploreView', 'page_view', { widgetCount: widgets.filter(w => w.enabled).length });
  }, [logAction]);

  /**
   * handleWidgetsChange - Handles widgets change.
   */
  const handleWidgetsChange = useCallback((next: WidgetConfig[]) => {
    /**
     * toggled - Performs toggled.
     */
    const toggled = widgets.filter(w => w.enabled).length !== next.filter(w => w.enabled).length;
    if (toggled) {
      /**
       * enabledIds - Performs enabled ids.
       */
      const enabledIds = next.filter(w => w.enabled).map(w => w.id);
      logAction('ExploreView', 'widgets_customized', { enabledWidgets: enabledIds });
    }
    setWidgets(next);
  }, [widgets, logAction]);

  /**
   * renderWidget - Performs render widget.
   */
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
      <div className="px-10 pt-8 pb-0 flex items-start justify-between">
        <ExploreHeader
          label="Prism"
          title="Explore"
          subtitle="Rediscover memories, explore visual themes, and analyze your photography habits"
          showTimeGreeting={true}
        />
        <div className="mt-1">
          <ExploreWidgetCustomizer widgets={widgets} onChange={handleWidgetsChange} />
        </div>
      </div>

      {/* Render Widgets in User-Customized Order */}
      <div className="flex flex-col pb-12">
        {widgets.filter(w => w.enabled).map(w => renderWidget(w.id))}
      </div>
    </div>
  );
};
