import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { resolveUrl } from '@/constants';
import { Photo } from '@/types';
import { GlassMaterial } from '@/components/GlassMaterial';
import { springs } from '@/lib/motion-tokens';

interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  photo_count: number;
  cover_url: string | null;
  photos: Photo[];
}

export interface StoryViewerProps {
  highlight: Highlight;
  onClose: () => void;
}

const WordReveal: React.FC<{ text: string }> = ({ text }) => {
  const words = text.split(' ');
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.03 } }
      }}
      className="flex flex-wrap"
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-1.5"
          variants={{
            hidden: { opacity: 0, filter: 'blur(4px)', y: 10 },
            visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: springs.gentle as any }
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

export const StoryViewer: React.FC<StoryViewerProps> = ({ highlight, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const photos = highlight.photos;
  const currentPhoto = photos[currentIndex];

  const SLIDE_DURATION = 6000;

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, photos.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, []);

  useEffect(() => {
    if (photos.length === 0) return;
    const timer = setTimeout(() => {
      handleNext();
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [currentIndex, photos.length, handleNext]);

  if (!currentPhoto) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col justify-between select-none overflow-hidden"
    >
      <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03] mix-blend-overlay">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />
      </div>

      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${currentPhoto.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={springs.gentle as any}
            className="space-y-4"
          >
            <img
              src={resolveUrl(currentPhoto.url)}
              alt="blur background"
              className="w-full h-full object-cover scale-110 blur-[100px]"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-12 md:p-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhoto.id}
            initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <img
              src={resolveUrl(currentPhoto.url)}
              alt={currentPhoto.caption || "Story image"}
              className="max-h-full max-w-full object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-[60] w-full p-8 flex flex-col gap-6">
        <div className="flex gap-2 w-full">
          {photos.map((_, index) => (
            <div key={index} className="flex-1 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.6)]"
                initial={false}
                animate={{
                  width: index < currentIndex ? '100%' : index === currentIndex ? '100%' : '0%'
                }}
                transition={index === currentIndex ? { duration: SLIDE_DURATION / 1000, ease: 'linear' } : { duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/agent-logo.jpeg" className="scale-50 -ml-2" alt="Agent Logo" />
            <div>
              <h3 className="text-white font-serif italic text-2xl tracking-tight drop-shadow-lg">{highlight.title}</h3>
              <p className="text-primary/70 text-[10px] font-bold uppercase tracking-[0.3em] mt-0.5">{highlight.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GlassMaterial intensity="subtle" interactive borderRadius="999px" className="p-2.5">
              {isMuted ? <VolumeX size={18} className="text-white/60" onClick={() => setIsMuted(false)} /> : <Volume2 size={18} className="text-primary" onClick={() => setIsMuted(true)} />}
            </GlassMaterial>
            <GlassMaterial
              intensity="subtle"
              interactive
              borderRadius="999px"
              className="p-2.5"
              onClick={onClose}
            >
              <X size={18} className="text-white" />
            </GlassMaterial>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-20 flex">
        <div onClick={handlePrev} className="w-1/2 h-full cursor-w-resize" />
        <div onClick={handleNext} className="w-1/2 h-full cursor-e-resize" />
      </div>

      <div className="relative z-[60] w-full p-8 sm:p-12 flex flex-col gap-4 max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`meta-${currentPhoto.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springs.gentle}
            className="space-y-4"
          >
            {currentPhoto.location && (
              <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-[0.2em]">
                <MapPin size={12} />
                <span>{currentPhoto.location}</span>
              </div>
            )}

            {currentPhoto.caption && (
              <h2 className="text-white text-3xl font-serif italic leading-tight max-w-2xl">
                {currentPhoto.caption}
              </h2>
            )}

            {currentPhoto.ai_summary && !currentPhoto.ai_summary.startsWith("Error:") && (
              <GlassMaterial intensity="regular" borderRadius="1.5rem" className="p-6 border-white/10 max-w-2xl bg-primary/5">
                <div className="flex gap-4 items-start">
                  <Sparkles size={16} className="text-primary shrink-0 mt-1 animate-pulse" />
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-primary/80">Intelligent Perspective</p>
                    <div className="text-sm text-gray-200 font-medium leading-relaxed italic">
                      <WordReveal text={`"${currentPhoto.ai_summary}"`} />
                    </div>
                  </div>
                </div>
              </GlassMaterial>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-y-0 left-0 z-[70] hidden md:flex items-center px-6 pointer-events-none">
        <AnimatePresence>
          {currentIndex > 0 && (
            <GlassMaterial
              intensity="subtle"
              interactive
              borderRadius="999px"
              className="p-4 pointer-events-auto shadow-2xl"
              onClick={handlePrev}
            >
              <ChevronLeft size={24} className="text-white" />
            </GlassMaterial>
          )}
        </AnimatePresence>
      </div>
      <div className="absolute inset-y-0 right-0 z-[70] hidden md:flex items-center px-6 pointer-events-none">
        <AnimatePresence>
          {currentIndex < photos.length - 1 && (
            <GlassMaterial
              intensity="subtle"
              interactive
              borderRadius="999px"
              className="p-4 pointer-events-auto shadow-2xl"
              onClick={handleNext}
            >
              <ChevronRight size={24} className="text-white" />
            </GlassMaterial>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
