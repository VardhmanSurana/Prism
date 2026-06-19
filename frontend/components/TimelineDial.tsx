import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { springs } from '../lib/motion-tokens';

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

const RADIUS = 300;

const TimelineDialItem: React.FC<{
  item: TimelineItem;
  isActive: boolean;
  smoothProgress: any; // MotionValue
  activeState: any; // MotionValue
  effectiveScrollHeight: number;
}> = ({ item, isActive, smoothProgress, activeState, effectiveScrollHeight }) => {
  const isYear = item.type === 'year';

  // Calculate position and rotation based on progress
  // We use useTransform to create reactive dependencies on the motion values
  const y = useTransform([smoothProgress, activeState], ([p, s]: any) => {
    const pixelOffset = (item.progress - p) * effectiveScrollHeight;
    const angle = pixelOffset / RADIUS;
    
    const activeY = Math.sin(angle) * RADIUS;
    const restingY = pixelOffset;
    
    // Interpolate between active and resting Y based on activeState (s)
    return activeY * s + restingY * (1 - s);
  });

  const z = useTransform([smoothProgress, activeState], ([p, s]: any) => {
    const pixelOffset = (item.progress - p) * effectiveScrollHeight;
    const angle = pixelOffset / RADIUS;
    
    const activeZ = Math.cos(angle) * RADIUS - RADIUS;
    const restingZ = 0;
    
    return activeZ * s + restingZ * (1 - s);
  });

  const rotateX = useTransform([smoothProgress, activeState], ([p, s]: any) => {
    const pixelOffset = (item.progress - p) * effectiveScrollHeight;
    const angle = pixelOffset / RADIUS;
    
    const activeRotateX = -angle;
    const restingRotateX = 0;
    
    return (activeRotateX * s + restingRotateX * (1 - s)) * (180 / Math.PI); // degrees for framer motion
  });

  const opacity = useTransform([smoothProgress, activeState], ([p, s]: any) => {
    const pixelOffset = (item.progress - p) * effectiveScrollHeight;
    const angle = pixelOffset / RADIUS;
    
    let op = 1;
    if (s > 0.5) {
       op = Math.max(0, 1 - Math.abs(angle) / (Math.PI / 2.5));
    } else {
       const screenHalf = window.innerHeight / 2;
       op = Math.max(0, 1 - Math.abs(pixelOffset) / screenHalf);
    }
    
    return (isActive ? 1 : op * 0.5);
  });

  return (
    <motion.div
      className="absolute right-0 flex items-center gap-3 transform-gpu origin-right pointer-events-none"
      style={{
        top: '50%',
        y,
        z,
        rotateX,
        opacity,
      }}
    >
      <span 
        className={`font-mono text-right transition-all duration-300
          ${isActive ? 'text-primary font-bold scale-110' : 'text-gray-500 scale-100'}
          ${isYear ? 'text-sm' : 'text-[10px] uppercase'}
        `}
        style={{ textShadow: isActive ? '0 0 10px rgba(var(--color-primary), 0.5)' : 'none' }}
      >
        {item.label}
      </span>
      <motion.div 
        className={`bg-current rounded-l-full shadow-[0_0_10px_currentColor]
          ${isActive ? 'text-primary' : 'text-white'}
        `}
        animate={{
          width: isYear ? (isActive ? 32 : 24) : (isActive ? 16 : 8),
          height: isYear ? 2 : 1
        }}
        transition={springs.snappy as any}
      />
    </motion.div>
  );
};

export const TimelineDial: React.FC<TimelineDialProps> = ({ items, activeId, scrollProgress, scrollHeight }) => {
  const mvProgress = useMotionValue(scrollProgress);
  const smoothProgress = useSpring(mvProgress, springs.smooth);
  const activeState = useMotionValue(0); // 0 = resting, 1 = active

  useEffect(() => {
    mvProgress.set(scrollProgress);
    
    // Trigger active state on scroll
    activeState.set(1);
    const timeout = setTimeout(() => {
      activeState.set(0);
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [scrollProgress]);

  const effectiveScrollHeight = Math.max(scrollHeight, 1000);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-32 pointer-events-none z-50 flex items-center justify-end overflow-visible" style={{ perspective: '2000px' }}>
      <div className="relative w-full h-full flex items-center justify-end">
        {items.map((item) => (
          <TimelineDialItem 
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            smoothProgress={smoothProgress}
            activeState={activeState}
            effectiveScrollHeight={effectiveScrollHeight}
          />
        ))}
      </div>
    </div>
  );
};
