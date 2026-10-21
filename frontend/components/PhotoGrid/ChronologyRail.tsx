import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';

export interface ChronologyMilestone {
  dateKey: string;
  label: string;
  shortLabel?: string;
}

export interface ChronologyRailProps {
  milestones: ChronologyMilestone[];
  activeDateKey: string | null;
  onSelectMilestone: (dateKey: string) => void;
  onScrollToTop: () => void;
  scrollParentRef?: React.RefObject<HTMLDivElement | null>;
}

const NUM_TICKS = 24;

export const ChronologyRail: React.FC<ChronologyRailProps> = React.memo(({
  milestones,
  activeDateKey,
  onSelectMilestone,
  onScrollToTop,
  scrollParentRef,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Sync scroll progress from scrollParentRef
  useEffect(() => {
    const parent = scrollParentRef?.current;
    if (!parent) return;

    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const scrollTop = parent.scrollTop;
        const scrollHeight = parent.scrollHeight;
        const clientHeight = parent.clientHeight;
        const maxScroll = Math.max(1, scrollHeight - clientHeight);
        setScrollProgress(Math.max(0, Math.min(1, scrollTop / maxScroll)));
      });
    };

    parent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      parent.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scrollParentRef]);

  // Current display label from active milestone or progress
  const currentLabel = useMemo(() => {
    if (milestones.length === 0) return '';
    if (activeDateKey) {
      const match = milestones.find((m) => m.dateKey === activeDateKey);
      if (match) return match.label;
    }
    const effectiveProgress = hoverProgress !== null ? hoverProgress : scrollProgress;
    const targetIdx = Math.min(
      milestones.length - 1,
      Math.max(0, Math.round(effectiveProgress * (milestones.length - 1)))
    );
    return milestones[targetIdx]?.label || '';
  }, [activeDateKey, hoverProgress, milestones, scrollProgress]);

  // Compute scroll jump from pointer Y position
  const scrubToClientY = useCallback((clientY: number) => {
    if (!trackRef.current || !scrollParentRef?.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const targetP = relY / rect.height;
    setHoverProgress(targetP);

    const parent = scrollParentRef.current;
    const maxScroll = Math.max(1, parent.scrollHeight - parent.clientHeight);
    parent.scrollTo({
      top: targetP * maxScroll,
      behavior: 'auto',
    });

    // Also trigger nearest milestone
    if (milestones.length > 0) {
      const idx = Math.min(
        milestones.length - 1,
        Math.max(0, Math.round(targetP * (milestones.length - 1)))
      );
      if (milestones[idx]) {
        onSelectMilestone(milestones[idx].dateKey);
      }
    }
  }, [milestones, onSelectMilestone, scrollParentRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    scrubToClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      scrubToClientY(e.clientY);
    } else if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      setHoverProgress(relY / rect.height);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    setHoverProgress(null);
  };

  if (milestones.length === 0) return null;

  const effectiveProgress = isHovering && hoverProgress !== null ? hoverProgress : scrollProgress;

  return (
    <aside className="hidden xl:flex flex-col items-center w-14 shrink-0 sticky top-24 h-[calc(100vh-120px)] py-4 select-none z-20 pointer-events-auto">
      <div className="flex flex-col items-center justify-between h-full w-full">
        {/* Header Tracker Label */}
        <span className="text-[9px] text-[#78716c] font-mono tracking-widest uppercase [writing-mode:vertical-rl] rotate-180 mb-3 opacity-60">
          Chronology
        </span>

        {/* Dial Scroller Track */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            if (!isDragging) {
              setIsHovering(false);
              setHoverProgress(null);
            }
          }}
          className="relative flex-1 flex flex-col items-end justify-between w-full py-2 cursor-ns-resize group px-2"
          title="Scroll or drag dial to scrub chronology"
        >
          {/* Floating Date Telemetry Badge */}
          {(isHovering || isDragging) && currentLabel && (
            <div
              className="pointer-events-none absolute right-10 z-30 transform -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#181514]/95 border border-[#292524] text-[#f5f5f4] text-[11px] font-mono shadow-2xl backdrop-blur-md whitespace-nowrap animate-in fade-in duration-100"
              style={{
                top: `${effectiveProgress * 100}%`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c8ea80] animate-pulse" />
                <span>{currentLabel}</span>
              </div>
            </div>
          )}

          {/* Dial Ruler Ticks (Fisheye Convex Curve) */}
          {Array.from({ length: NUM_TICKS }).map((_, i) => {
            const tickP = i / (NUM_TICKS - 1);
            const dist = Math.abs(tickP - effectiveProgress);
            // Gaussian bell curve for radial distortion:
            const factor = Math.exp(-Math.pow(dist / 0.1, 2));
            const width = Math.round(8 + 18 * factor);
            const isCenter = dist < (0.5 / (NUM_TICKS - 1));

            // Closest milestone for this tick if clicked directly
            const milestoneIdx = Math.min(
              milestones.length - 1,
              Math.max(0, Math.round(tickP * (milestones.length - 1)))
            );
            const milestone = milestones[milestoneIdx];

            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (milestone) {
                    onSelectMilestone(milestone.dateKey);
                  }
                  if (scrollParentRef?.current) {
                    const maxScroll = Math.max(1, scrollParentRef.current.scrollHeight - scrollParentRef.current.clientHeight);
                    scrollParentRef.current.scrollTo({
                      top: tickP * maxScroll,
                      behavior: 'smooth',
                    });
                  }
                }}
                className="relative flex items-center justify-end w-full py-0.5 focus:outline-none cursor-pointer group/tick"
                title={milestone?.label || ''}
              >
                <div
                  className="rounded-full transition-all duration-75"
                  style={{
                    width: `${width}px`,
                    height: isCenter ? '3px' : '2.5px',
                    backgroundColor: isCenter ? '#c8ea80' : '#4b5563',
                    opacity: isCenter ? 1 : Math.max(0.3, Math.min(0.8, 0.3 + factor * 0.5)),
                    boxShadow: isCenter ? '0 0 10px rgba(200, 234, 128, 0.65)' : 'none',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Back to top button */}
        <button
          type="button"
          onClick={onScrollToTop}
          className="mt-3 w-7 h-7 rounded-full bg-[#181514] border border-[#292524] hover:bg-[#23201e] hover:border-[#474745] text-[#a8a29e] hover:text-[#f5f5f4] flex items-center justify-center shadow-sm transition-colors cursor-pointer shrink-0"
          title="Back to top"
        >
          <ArrowUp size={13} />
        </button>
      </div>
    </aside>
  );
});

ChronologyRail.displayName = 'ChronologyRail';

