import React, { useCallback, useMemo } from 'react';
import { Bookmark, Scissors, ScissorsLineDashed } from 'lucide-react';
import { Bookmark as BookmarkType } from '@/types/nle';

// Ruler configuration and utility functions
const LABEL_FRAME_INTERVALS = [1, 2, 5, 10, 15] as const;
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;
const SECOND_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;
const MIN_LABEL_SPACING_PX = 120;
const MIN_TICK_SPACING_PX = 18;

export function getRulerConfig(pixelsPerSec: number, fps: number) {
  const pixelsPerFrame = pixelsPerSec / fps;

  // Find optimal label interval
  let labelIntervalSeconds = 60;
  for (const frameInterval of LABEL_FRAME_INTERVALS) {
    if (frameInterval * pixelsPerFrame >= MIN_LABEL_SPACING_PX) {
      labelIntervalSeconds = frameInterval / fps;
      break;
    }
  }

  if (labelIntervalSeconds === 60) {
    for (const secMultiplier of SECOND_MULTIPLIERS) {
      if (secMultiplier * pixelsPerSec >= MIN_LABEL_SPACING_PX) {
        labelIntervalSeconds = secMultiplier;
        break;
      }
    }
  }

  // Find optimal tick interval
  let tickIntervalSeconds = labelIntervalSeconds;
  for (const frameInterval of TICK_FRAME_INTERVALS) {
    if (frameInterval * pixelsPerFrame >= MIN_TICK_SPACING_PX) {
      tickIntervalSeconds = frameInterval / fps;
      break;
    }
  }

  if (tickIntervalSeconds === labelIntervalSeconds) {
    for (const secMultiplier of SECOND_MULTIPLIERS) {
      if (secMultiplier * pixelsPerSec >= MIN_TICK_SPACING_PX) {
        tickIntervalSeconds = secMultiplier;
        break;
      }
    }
  }

  return { labelIntervalSeconds, tickIntervalSeconds };
}

export function formatRulerLabel(timeInSeconds: number, fps: number): string {
  const epsilon = 0.0001;
  const remainder = timeInSeconds % 1;
  const isSecondBoundary = remainder < epsilon || remainder > 1 - epsilon;

  if (isSecondBoundary) {
    const totalSeconds = Math.round(timeInSeconds);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  } else {
    const frame = Math.round(remainder * fps);
    return `${frame.toString().padStart(2, '0')}f`;
  }
}

interface RulerProps {
  timelineWidth: number;
  pixelsPerSec: number;
  projectFps: number;
  bookmarks: BookmarkType[];
  addBookmark: (label?: string, color?: string) => void;
  removeBookmark: (id: string) => void;
  splitSelectedClip?: () => void;
  playheadPosition: number;
  setPlayheadPosition: (frame: number) => void;
  duration: number;
}

export const Ruler: React.FC<RulerProps> = ({
  timelineWidth,
  pixelsPerSec,
  projectFps,
  bookmarks,
  addBookmark,
  removeBookmark,
  splitSelectedClip,
  playheadPosition,
  setPlayheadPosition,
  duration
}) => {
  const { labelIntervalSeconds, tickIntervalSeconds } = useMemo(
    () => getRulerConfig(pixelsPerSec, projectFps),
    [pixelsPerSec, projectFps]
  );

  const ticks = useMemo(() => {
    const result = [];
    const maxTime = Math.max(duration / projectFps, timelineWidth / pixelsPerSec);
    const numTicks = Math.ceil(maxTime / tickIntervalSeconds);

    for (let i = 0; i <= numTicks; i++) {
      const time = i * tickIntervalSeconds;
      const isLabel = Math.abs((time % labelIntervalSeconds) / labelIntervalSeconds) < 0.001 ||
                      Math.abs((time % labelIntervalSeconds) / labelIntervalSeconds) > 0.999;
      result.push({ time, isLabel });
    }
    return result;
  }, [timelineWidth, pixelsPerSec, duration, projectFps, tickIntervalSeconds, labelIntervalSeconds]);

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSec);
    const frame = Math.round(time * projectFps);
    setPlayheadPosition(frame);
  }, [pixelsPerSec, projectFps, setPlayheadPosition]);

  return (
    <div
      className="h-10 bg-[#161616] border-b border-white/5 sticky top-0 z-40 cursor-pointer overflow-hidden group select-none"
      onClick={handleRulerClick}
    >
      <div className="absolute inset-0" style={{ width: Math.max(timelineWidth, 2000) }}>
        {/* Ticks and Labels */}
        {ticks.map((tick, i) => (
          <React.Fragment key={i}>
            <div
              className={`absolute bottom-0 bg-white/20 w-px ${tick.isLabel ? 'h-3' : 'h-1.5'}`}
              style={{ left: `${tick.time * pixelsPerSec}px` }}
            />
            {tick.isLabel && (
              <span
                className="absolute bottom-4 text-[10px] text-white/50 font-mono translate-x-1 select-none pointer-events-none"
                style={{ left: `${tick.time * pixelsPerSec}px` }}
              >
                {formatRulerLabel(tick.time, projectFps)}
              </span>
            )}
          </React.Fragment>
        ))}

        {/* Bookmarks */}
        {bookmarks.map((bm: BookmarkType) => (

            <div
              className="absolute top-0 bottom-0 w-3 -ml-1.5 group/bm cursor-pointer"
              style={{ left: `${(bm.time / projectFps) * pixelsPerSec}px` }}
              onClick={(e) => {
                e.stopPropagation();
                setPlayheadPosition(bm.time);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removeBookmark(bm.id);
              }}
            >
              <div
                className="absolute top-0 w-full h-full opacity-20"
                style={{ backgroundColor: bm.color }}
              />
              <Bookmark
                size={12}
                fill={bm.color}
                color={bm.color}
                className="absolute top-1 left-1/2 -translate-x-1/2 opacity-80 group-hover/bm:opacity-100 group-hover/bm:scale-110 transition-all"
              />
            </div>

        ))}

        {/* Toolbar in ruler (shows on hover) */}
        <div className="absolute left-2 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-50">

            <button
              onClick={(e) => { e.stopPropagation(); addBookmark(); }}
              className="p-1 rounded bg-black/50 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Bookmark size={12} />
            </button>

          {splitSelectedClip && (

              <button
                onClick={(e) => { e.stopPropagation(); splitSelectedClip(); }}
                className="p-1 rounded bg-black/50 text-white/70 hover:text-white hover:bg-white/10"
              >
                <Scissors size={12} />
              </button>

          )}
        </div>
      </div>
    </div>
  );
};
