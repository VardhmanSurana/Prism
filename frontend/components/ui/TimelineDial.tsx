import React, { useEffect, useRef, useState } from 'react';

export interface TimelineItem {
  id: string;
  label: string;
  type: 'year' | 'month';
  progress: number;
}

interface TimelineDialProps {
  items: TimelineItem[];
  activeId: string | null;
  scrollProgress: number;
  scrollHeight: number;
}

const TimelineDialItem: React.FC<{
  item: TimelineItem;
  isActive: boolean;
  progress: number;
  scrollHeight: number;
}> = ({ item, isActive, progress, scrollHeight }) => {
  const isYear = item.type === 'year';
  const pixelOffset = (item.progress - progress) * scrollHeight;
  const halfHeight = scrollHeight / 2;
  const normalizedOffset = halfHeight > 0 ? Math.max(-1, Math.min(1, pixelOffset / halfHeight)) : 0;
  const opacity = isActive ? 1 : Math.max(0, 1 - Math.abs(normalizedOffset) * 1.5) * 0.5;

  return (
    <div
      className="absolute right-0 flex items-center gap-3 pointer-events-none"
      style={{
        top: '50%',
        transform: `translateY(${pixelOffset}px)`,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      <span
        className={`font-mono text-right transition-colors duration-200
          ${isActive ? 'text-primary font-bold' : 'text-gray-500'}
          ${isYear ? 'text-sm' : 'text-[10px] uppercase'}
        `}
      >
        {item.label}
      </span>
      <div
        className={`rounded-l-full transition-all duration-200
          ${isActive ? 'text-primary shadow-[0_0_10px_currentColor]' : 'text-white'}
        `}
        style={{
          width: isYear ? (isActive ? 32 : 24) : (isActive ? 16 : 8),
          height: isYear ? 2 : 1,
          background: 'currentColor',
        }}
      />
    </div>
  );
};

export const TimelineDial: React.FC<TimelineDialProps> = ({ items, activeId, scrollProgress, scrollHeight }) => {
  if (items.length === 0) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-32 pointer-events-none z-50 flex items-center justify-end overflow-visible">
      <div className="relative w-full h-full flex items-center justify-end">
        {items.map((item) => (
          <TimelineDialItem
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            progress={scrollProgress}
            scrollHeight={scrollHeight}
          />
        ))}
      </div>
    </div>
  );
};
