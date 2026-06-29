import React, { useState, useRef, useCallback } from 'react';
import {
  SkipBack,
  StepBack,
  Play,
  Pause,
  StepForward,
  SkipForward,
  ChevronDown,
  Maximize,
} from 'lucide-react';

const FPS = 30;
const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

function formatTimeWithMs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed?: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  speed = 1,
  onPlayPause,
  onSeek,
  onSpeedChange,
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const stepBack = useCallback(() => onSeek(Math.max(0, currentTime - 1 / FPS)), [currentTime, onSeek]);
  const stepForward = useCallback(() => onSeek(Math.min(duration, currentTime + 1 / FPS)), [currentTime, duration, onSeek]);
  const skipToStart = useCallback(() => onSeek(0), [onSeek]);
  const skipToEnd = useCallback(() => onSeek(duration), [duration, onSeek]);

  const handleSpeedClick = useCallback((spd: number) => {
    onSpeedChange?.(spd);
    setShowSpeedMenu(false);
  }, [onSpeedChange]);

  return (
    <div className="bg-[#070709]/95 h-11 flex items-center justify-between px-6 select-none border-t border-white/5">
      {/* Left: Transport buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={skipToStart}
          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          title="Skip to start"
        >
          <SkipBack size={15} />
        </button>

        <button
          onClick={stepBack}
          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          title="Step back"
        >
          <StepBack size={15} />
        </button>

        <button
          onClick={onPlayPause}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/15 active:scale-95 transition-all mx-1"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <button
          onClick={stepForward}
          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          title="Step forward"
        >
          <StepForward size={15} />
        </button>

        <button
          onClick={skipToEnd}
          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          title="Skip to end"
        >
          <SkipForward size={15} />
        </button>

        {/* Speed */}
        <div className="relative ml-2" ref={menuRef}>
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 active:scale-95 transition-all font-mono flex items-center gap-0.5"
          >
            {speed}x
            <ChevronDown size={9} />
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-[#1a1c24] border border-white/10 rounded-lg py-1 shadow-2xl min-w-[60px] z-50">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  onClick={() => handleSpeedClick(spd)}
                  className={`w-full px-3 py-1.5 text-xs font-mono text-left hover:bg-white/10 transition-colors ${
                    speed === spd ? 'text-white' : 'text-white/60'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Time display */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[11px] text-white/50 font-mono tabular-nums">
          {formatTimeWithMs(currentTime)}
          <span className="text-white/20 mx-1.5">/</span>
          {formatTimeWithMs(duration)}
        </span>
      </div>

      {/* Right: Fullscreen */}
      <div className="flex items-center">
        <button
          className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 active:scale-95 transition-all"
          title="Fullscreen"
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
};
