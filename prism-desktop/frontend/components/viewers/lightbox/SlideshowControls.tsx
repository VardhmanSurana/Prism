import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Music,
  Music2,
  Settings2,
  Volume2,
  VolumeX,
  Repeat,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SLIDESHOW_INTERVALS,
  type SlideshowTransition,
} from '@/hooks/useSlideshow';

export interface SlideshowControlsProps {
  isPlaying: boolean;
  progress: number;
  intervalMs: number;
  loop: boolean;
  transition: SlideshowTransition;
  musicEnabled: boolean;
  musicVolume: number;
  musicName: string | null;
  currentIndex: number;
  totalCount: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onSetIntervalMs: (ms: number) => void;
  onSetLoop: (loop: boolean) => void;
  onSetTransition: (t: SlideshowTransition) => void;
  onSetMusicEnabled: (enabled: boolean) => void;
  onSetMusicVolume: (volume: number) => void;
  onPickMusic: (file: File | null) => void;
  onPrev: () => void;
  onNext: () => void;
}

const TRANSITIONS: { id: SlideshowTransition; label: string }[] = [
  { id: 'fade', label: 'Fade' },
  { id: 'slide', label: 'Slide' },
  { id: 'ken-burns', label: 'Ken Burns' },
];

export const SlideshowControls: React.FC<SlideshowControlsProps> = ({
  isPlaying,
  progress,
  intervalMs,
  loop,
  transition,
  musicEnabled,
  musicVolume,
  musicName,
  currentIndex,
  totalCount,
  onTogglePlay,
  onStop,
  onSetIntervalMs,
  onSetLoop,
  onSetTransition,
  onSetMusicEnabled,
  onSetMusicVolume,
  onPickMusic,
  onPrev,
  onNext,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const bumpVisibility = () => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying && !showSettings) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 2800);
    }
  };

  useEffect(() => {
    bumpVisibility();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, showSettings, currentIndex]);

  useEffect(() => {
    if (!showSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings]);

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 pointer-events-none"
      onMouseMove={bumpVisibility}
      onPointerDown={bumpVisibility}
    >
      {/* Progress rail */}
      <div className="h-0.5 w-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-white/80 origin-left transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto px-4 pb-5 pt-3 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          >
            <div className="text-[10px] font-mono text-white/40 tabular-nums tracking-wider">
              {currentIndex + 1} / {totalCount}
              {musicName && musicEnabled && (
                <span className="ml-3 text-white/30">
                  <Music2 size={10} className="inline mr-1 -mt-0.5" />
                  {musicName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl px-2 py-1.5 backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={onPrev}
                className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Previous"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className="p-2.5 mx-0.5 text-white bg-white/15 hover:bg-white/25 rounded-xl transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-[1px]" />}
              </button>

              <button
                type="button"
                onClick={onStop}
                className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Exit slideshow (Esc)"
              >
                <Square size={15} fill="currentColor" />
              </button>

              <button
                type="button"
                onClick={onNext}
                className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Next"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" />
                </svg>
              </button>

              <div className="w-px h-5 bg-white/10 mx-1" />

              <button
                type="button"
                onClick={() => {
                  if (!musicName) {
                    fileInputRef.current?.click();
                  } else {
                    onSetMusicEnabled(!musicEnabled);
                  }
                }}
                className={`p-2 rounded-xl transition-colors ${
                  musicEnabled && musicName
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
                title={musicName ? (musicEnabled ? 'Mute music' : 'Unmute music') : 'Add background music'}
              >
                {musicEnabled && musicName ? <Music size={16} /> : musicName ? <VolumeX size={16} /> : <Music size={16} />}
              </button>

              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setShowSettings((v) => !v)}
                  className={`p-2 rounded-xl transition-colors ${
                    showSettings
                      ? 'text-white bg-white/15'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                  title="Slideshow settings"
                >
                  <Settings2 size={16} />
                </button>

                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-2 w-64 bg-[#1a1d26]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-3 z-50"
                    >
                      {/* Interval */}
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-mono">
                          <Clock size={11} />
                          Duration
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {SLIDESHOW_INTERVALS.map((opt) => (
                            <button
                              key={opt.ms}
                              type="button"
                              onClick={() => onSetIntervalMs(opt.ms)}
                              className={`px-2 py-1 text-[11px] font-mono rounded-md transition-colors ${
                                intervalMs === opt.ms
                                  ? 'bg-white/20 text-white'
                                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Transition */}
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-mono">
                          <Sparkles size={11} />
                          Transition
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {TRANSITIONS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => onSetTransition(t.id)}
                              className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                                transition === t.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Loop */}
                      <button
                        type="button"
                        onClick={() => onSetLoop(!loop)}
                        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors mb-2"
                      >
                        <span className="flex items-center gap-2 text-sm text-white/70">
                          <Repeat size={14} className="text-white/40" />
                          Loop
                        </span>
                        <span
                          className={`w-8 h-4 rounded-full relative transition-colors ${
                            loop ? 'bg-emerald-500/80' : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              loop ? 'left-4' : 'left-0.5'
                            }`}
                          />
                        </span>
                      </button>

                      {/* Music */}
                      <div className="border-t border-white/5 pt-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-mono">
                          <Volume2 size={11} />
                          Music
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full text-left px-2 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors truncate"
                        >
                          {musicName ? `Change: ${musicName}` : 'Choose audio file…'}
                        </button>
                        {musicName && (
                          <>
                            <div className="flex items-center gap-2 px-2 mt-1.5">
                              <VolumeX size={12} className="text-white/30 shrink-0" />
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={musicVolume}
                                onChange={(e) => onSetMusicVolume(Number(e.target.value))}
                                className="flex-1 h-1 accent-white"
                              />
                              <Volume2 size={12} className="text-white/30 shrink-0" />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onPickMusic(null);
                                onSetMusicEnabled(false);
                              }}
                              className="w-full text-left px-2 py-1.5 text-[11px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-1"
                            >
                              Remove music
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <p className="text-[9px] text-white/25 font-mono tracking-wide">
              Space play/pause · Esc exit · ← → navigate
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onPickMusic(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};
