import React, { useState, useRef, useCallback } from 'react';
import {
  SkipBack,
  StepBack,
  Play,
  Pause,
  StepForward,
  SkipForward,
  ChevronDown,
} from 'lucide-react';

const FPS = 30;
const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

function formatTimeWithMs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
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
    <div className="bg-[#0a0a0a] border-t border-white/5 h-12 flex items-center justify-center gap-1 px-4 select-none">
      <button
        onClick={skipToStart}
        className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        title="Skip to start"
      >
        <SkipBack size={16} />
      </button>

      <button
        onClick={stepBack}
        className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        title="Step back"
      >
        <StepBack size={16} />
      </button>

      <button
        onClick={onPlayPause}
        className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors mx-1"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      <button
        onClick={stepForward}
        className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        title="Step forward"
      >
        <StepForward size={16} />
      </button>

      <button
        onClick={skipToEnd}
        className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        title="Skip to end"
      >
        <SkipForward size={16} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          className="ml-3 px-2 py-1 rounded text-[11px] text-white/50 hover:text-white hover:bg-white/5 transition-colors font-mono flex items-center gap-0.5"
        >
          {speed}x
          <ChevronDown size={10} />
        </button>

        {showSpeedMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a1c24] border border-white/10 rounded-lg py-1 shadow-2xl min-w-[60px] z-50">
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                onClick={() => handleSpeedClick(spd)}
                className={`w-full px-3 py-1.5 text-xs font-mono text-left hover:bg-white/10 transition-colors ${
                  speed === spd ? 'text-primary' : 'text-white/70'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto text-[11px] text-white/40 font-mono tabular-nums">
        {formatTimeWithMs(currentTime)} / {formatTimeWithMs(duration)}
      </div>
    </div>
  );
};
