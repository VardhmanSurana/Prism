import React, { useEffect, useState, useMemo } from 'react';

export interface TimelineItem {
  id: string;
  label: string;
  type: 'year' | 'month';
  progress: number; // 0 to 1
}

interface TimelineDialProps {
  items: TimelineItem[];
  activeId: string | null;
  scrollProgress: number; // 0 to 1
  scrollHeight: number;
}

export const TimelineDial: React.FC<TimelineDialProps> = ({ items, activeId, scrollProgress, scrollHeight }) => {
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    setIsScrolling(true);
    const timeout = setTimeout(() => setIsScrolling(false), 300);
    return () => clearTimeout(timeout);
  }, [scrollProgress]);

  // Cylinder properties
  const radius = 300;
  // If scrollHeight is too small, we might want a minimum scale
  const effectiveScrollHeight = Math.max(scrollHeight, 1000);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-32 pointer-events-none z-50 flex items-center justify-end overflow-visible" style={{ perspective: '2000px' }}>
      <div className="relative w-full h-full flex items-center justify-end">
        {items.map((item) => {
          // pixelOffset represents the physical pixel distance from the current center
          const pixelOffset = (item.progress - scrollProgress) * effectiveScrollHeight;
          
          // angle in radians
          const angle = pixelOffset / radius;
          
          // Limit rendering to only items within a reasonable angle/distance to save performance
          if (Math.abs(angle) > Math.PI / 1.5 && Math.abs(pixelOffset) > window.innerHeight) {
             return null;
          }

          // Active State (3D Drum)
          const activeY = Math.sin(angle) * radius;
          const activeZ = Math.cos(angle) * radius - radius;
          const activeRotateX = -angle; // negative so scrolling down rolls the cylinder up

          // Resting State (Flat Ruler)
          // To keep it looking like a ruler, we space them linearly
          // But to fit the screen, maybe we don't use full effectiveScrollHeight?
          // If we just use pixelOffset, the ruler scrolls with the page perfectly.
          const restingY = pixelOffset;
          const restingZ = 0;
          const restingRotateX = 0;

          // Transition
          const y = isScrolling ? activeY : restingY;
          const z = isScrolling ? activeZ : restingZ;
          const rotateX = isScrolling ? activeRotateX : restingRotateX;
          
          const isActive = item.id === activeId;
          const isYear = item.type === 'year';

          // Fade out as they go towards the back or far away
          let opacity = 1;
          if (isScrolling) {
             opacity = Math.max(0, 1 - Math.abs(angle) / (Math.PI / 2.5));
          } else {
             // Fade out slightly at the top and bottom of screen
             const screenHalf = window.innerHeight / 2;
             opacity = Math.max(0, 1 - Math.abs(restingY) / screenHalf);
          }
          
          if (opacity < 0.01) return null;

          return (
            <div
              key={item.id}
              className={`absolute right-0 flex items-center gap-3 transition-all transform-gpu origin-right
                ${isScrolling ? 'duration-100 ease-linear' : 'duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'}
              `}
              style={{
                top: '50%',
                transform: `translateY(calc(-50% + ${y}px)) translateZ(${z}px) rotateX(${rotateX}rad)`,
                opacity: isActive ? 1 : opacity * 0.5,
              }}
            >
              <span 
                className={`font-mono text-right transition-all duration-300
                  ${isActive ? 'text-primary font-bold scale-110' : 'text-gray-500 scale-100'}
                  ${isYear ? 'text-sm' : 'text-[10px] uppercase'}
                `}
                style={{ textShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none' }}
              >
                {item.label}
              </span>
              <div 
                className={`bg-current rounded-l-full transition-all duration-300 shadow-[0_0_10px_currentColor]
                  ${isActive ? 'text-primary' : 'text-white'}
                `}
                style={{
                  width: isYear ? (isActive ? '32px' : '24px') : (isActive ? '16px' : '8px'),
                  height: isYear ? '2px' : '1px'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
