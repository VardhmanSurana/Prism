import { useMemo, useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { TimelineItem } from '@/components/ui/TimelineDial';
import { RowItem } from '../types';
import { ROW_HEIGHT } from '../constants';

const HEADER_HEIGHT = 80;

export const useTimeline = (
  rowItems: RowItem[],
  scrollParentRef?: RefObject<HTMLDivElement | null>
) => {
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];
    let currentTop = 0;
    const totalSize = rowItems.reduce(
      (acc, item) => acc + (item.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT),
      0
    );

    let lastYear = '';

    rowItems.forEach((item) => {
      if (item.type === 'header') {
        const date = new Date(item.dateKey);
        const year = date.getFullYear().toString();
        const month = date.toLocaleDateString('en-US', { month: 'short' });

        if (year !== lastYear) {
          items.push({
            id: `year-${year}`,
            label: year,
            type: 'year',
            progress: currentTop / totalSize,
          });
          lastYear = year;
        }

        if (!items.find((i) => i.id === `month-${item.dateKey}`)) {
          items.push({
            id: `month-${item.dateKey}`,
            label: month,
            type: 'month',
            progress: currentTop / totalSize,
          });
        }
      }
      currentTop += item.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT;
    });
    return items;
  }, [rowItems]);

  const [scrollState, setScrollState] = useState({ progress: 0, height: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);

  const timelineItemsRef = useRef(timelineItems);
  useEffect(() => {
    timelineItemsRef.current = timelineItems;
  }, [timelineItems]);

  // Deep comparison of timelineItems' IDs and progress values to stabilize effect trigger
  const itemsKey = useMemo(() => {
    return JSON.stringify(timelineItems.map(i => ({ id: i.id, progress: i.progress })));
  }, [timelineItems]);

  useEffect(() => {
    const parent = scrollParentRef?.current;
    if (!parent) return;

    const handleScroll = () => {
      const scrollTop = parent.scrollTop;
      const scrollHeight = parent.scrollHeight;
      const clientHeight = parent.clientHeight;

      if (scrollHeight === 0) return;

      const centerPixel = scrollTop + clientHeight / 2;
      const progress = centerPixel / scrollHeight;

      setScrollState({ progress, height: scrollHeight });

      let closest = null;
      let minDiff = Infinity;
      const currentItems = timelineItemsRef.current;
      for (const item of currentItems) {
        const diff = Math.abs(item.progress - progress);
        if (diff < minDiff) {
          minDiff = diff;
          closest = item.id;
        }
      }
      if (closest) setActiveId(closest);
    };

    parent.addEventListener('scroll', handleScroll, { passive: true });
    const timer = setTimeout(handleScroll, 100);
    return () => {
      parent.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [scrollParentRef, itemsKey]);

  return { timelineItems, scrollState, activeId };
};
