import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, ChevronLeft, ChevronRight, Shuffle, Clock } from 'lucide-react';
import { API_BASE, resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/GlassMaterial';
import { springs } from '@/lib/motion-tokens';

const INTERVALS = [3, 5, 10, 30] as const;

export const FrameView: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalSec, setIntervalSec] = useState(5);
  const [shuffled, setShuffled] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/?limit=500`);
        const data = await res.json();
        const items = (data.photos || data || []).filter(
          (p: Photo) => !p.is_locked && !p.is_trash
        );
        setPhotos(items);
        const indices = items.map((_: Photo, i: number) => i);
        setShuffledOrder(shuffleArray([...indices]));
      } catch (e) {
        console.warn('FrameView fetch failed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPhotos();
  }, []);

  const shuffleArray = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const order = shuffled ? shuffledOrder : photos.map((_: Photo, i: number) => i);
  const currentPhoto = photos[order[currentIndex]];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= order.length - 1) return 0;
      return prev + 1;
    });
  }, [order.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return order.length - 1;
      return prev - 1;
    });
  }, [order.length]);

  useEffect(() => {
    if (!isPlaying || photos.length === 0) return;
    const timer = setInterval(goNext, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [isPlaying, intervalSec, photos.length, goNext]);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const handleActivity = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      clearTimeout(controlsTimerRef.current);
      clearTimeout(activityTimerRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  const toggleShuffle = useCallback(() => {
    setShuffled((prev) => {
      const next = !prev;
      if (next) {
        const remaining = photos.map((_: Photo, i: number) => i).filter((i) => i !== currentIndex);
        setShuffledOrder([currentIndex, ...shuffleArray([...remaining])]);
        setCurrentIndex(0);
      }
      return next;
    });
  }, [photos, currentIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'Escape') {
        const event = new CustomEvent('frame-exit');
        window.dispatchEvent(event);
      } else if (e.key === 's' || e.key === 'S') {
        toggleShuffle();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, toggleShuffle]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white/50 text-lg">
        No photos available for slideshow
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={handleActivity}
      onClick={handleActivity}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhoto.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <img
            src={resolveUrl(currentPhoto.url)}
            alt={currentPhoto.caption || ''}
            className="max-h-full max-w-full object-contain"
          />
        </motion.div>
      </AnimatePresence>

      {currentPhoto.caption && (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={springs.gentle}
              className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none"
            >
              <GlassMaterial intensity="regular" borderRadius="1rem" className="px-6 py-3 pointer-events-auto">
                <p className="text-white text-sm font-medium text-center">{currentPhoto.caption}</p>
                {currentPhoto.location && (
                  <p className="text-white/60 text-xs text-center mt-1">{currentPhoto.location}</p>
                )}
              </GlassMaterial>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-0 left-0 right-0 flex justify-center pt-6 z-50 pointer-events-none"
          >
            <GlassMaterial intensity="prominent" borderRadius="1.5rem" className="px-2 py-2 pointer-events-auto flex items-center gap-1">
              <button
                onClick={goPrev}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={18} className="text-white" />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                {isPlaying ? (
                  <Pause size={18} className="text-white" />
                ) : (
                  <Play size={18} className="text-white" />
                )}
              </button>

              <button
                onClick={goNext}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <ChevronRight size={18} className="text-white" />
              </button>

              <div className="w-px h-5 bg-white/10 mx-1" />

              <button
                onClick={toggleShuffle}
                className={`p-2.5 rounded-full hover:bg-white/10 transition-colors ${shuffled ? 'text-primary' : ''}`}
              >
                <Shuffle size={18} className={shuffled ? 'text-primary' : 'text-white'} />
              </button>

              <div className="w-px h-5 bg-white/10 mx-1" />

              <div className="flex items-center gap-1">
                <Clock size={14} className="text-white/40 mx-1" />
                {INTERVALS.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setIntervalSec(sec)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      intervalSec === sec
                        ? 'bg-white/20 text-white'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-white/10 mx-1" />

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('frame-exit'));
                }}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </GlassMaterial>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-50">
        {photos.length <= 20 &&
          order.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-white scale-125' : 'bg-white/30'
              }`}
            />
          ))}
      </div>

      <div className="absolute inset-0 z-40">
        <div onClick={goPrev} className="absolute left-0 top-0 w-1/4 h-full cursor-w-resize" />
        <div onClick={goNext} className="absolute right-0 top-0 w-1/4 h-full cursor-e-resize" />
      </div>
    </div>
  );
};
