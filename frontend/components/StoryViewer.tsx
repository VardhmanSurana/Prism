import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, Sparkles } from 'lucide-react';
import { resolveUrl } from '../constants';
import { Photo } from '../types';

interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  photo_count: number;
  cover_url: string | null;
  photos: Photo[];
}

interface StoryViewerProps {
  highlight: Highlight;
  onClose: () => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ highlight, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const photos = highlight.photos;
  const currentPhoto = photos[currentIndex];
  
  const SLIDE_DURATION = 5000; // 5 seconds per slide

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
  }, [currentIndex]);

  useEffect(() => {
    if (photos.length === 0) return;
    const timer = setTimeout(() => {
      handleNext();
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [currentIndex, photos.length, handleNext]);

  if (!currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
        {/* Blurry Background */}
        <img 
          src={resolveUrl(currentPhoto.url)} 
          alt="blur background" 
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-30 select-none pointer-events-none"
        />
        
        {/* Main Image with Ken Burns Effect */}
        <AnimatePresence mode="wait">
          <motion.img 
            key={currentPhoto.id}
            src={resolveUrl(currentPhoto.url)} 
            alt={currentPhoto.caption || "Story image"} 
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="max-h-full max-w-full object-contain z-10 animate-ken-burns select-none pointer-events-none"
          />
        </AnimatePresence>
      </div>

      {/* Header Overlay (Progress Bars, Title, Close Button) */}
      <div className="relative z-20 w-full p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex flex-col gap-3">
        <style>{`
          @keyframes storyProgress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
        {/* Progress Ticks */}
        <div className="flex gap-1.5 w-full">
          {photos.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                key={`${index}-${currentIndex === index}`}
                className="h-full bg-primary"
                style={{ 
                  width: index < currentIndex ? '100%' : '0%',
                  animation: index === currentIndex ? `storyProgress ${SLIDE_DURATION}ms linear forwards` : 'none',
                  backgroundColor: 'rgb(234, 179, 8)' // Gold theme
                }}
              />
            </div>
          ))}
        </div>

        {/* Title, Subtitle, & Close Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-white font-bold text-base tracking-tight drop-shadow">{highlight.title}</h3>
              <p className="text-white/60 text-xs font-medium font-mono uppercase tracking-wider drop-shadow">{highlight.subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/5 backdrop-blur-md transition-all shadow-lg"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav Tap Zones (Left/Right Tap to navigate) */}
      <div className="absolute inset-0 z-10 flex">
        <div 
          onClick={handlePrev}
          className="w-1/3 h-full cursor-w-resize"
          title="Previous slide"
        />
        <div 
          onClick={handleNext}
          className="w-2/3 h-full cursor-e-resize"
          title="Next slide"
        />
      </div>

      {/* Navigation Buttons (Left/Right Arrows for Desktop accessibility) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 hidden md:block">
        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            <ChevronLeft size={24} />
          </button>
        )}
      </div>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 hidden md:block">
        <button 
          onClick={handleNext}
          className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md hover:scale-110 active:scale-95 transition-all shadow-xl"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Bottom Photo Metadata Details */}
      <div className="relative z-20 w-full p-6 sm:p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2.5">
        {currentPhoto.location && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-bold tracking-wide drop-shadow" style={{ color: '#EAB308' }}>
            <MapPin size={13} />
            <span>{currentPhoto.location}</span>
          </div>
        )}
        
        {currentPhoto.caption && (
          <p className="text-white text-sm font-semibold tracking-tight leading-relaxed max-w-2xl drop-shadow">
            {currentPhoto.caption}
          </p>
        )}

        {/* Ollama Visual Summary Integration! */}
        {currentPhoto.ai_summary && !currentPhoto.ai_summary.startsWith("Error:") && !currentPhoto.ai_summary.startsWith("Summary unavailable") && (
          <div className="flex gap-2.5 items-start bg-black/40 border border-white/5 backdrop-blur-md rounded-2xl p-4 max-w-2xl mt-1 shadow-inner">
            <Sparkles size={14} className="text-yellow-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-yellow-400 font-bold mb-1">Local AI Description</p>
              <p className="text-xs text-gray-300 italic font-medium leading-relaxed">
                "{currentPhoto.ai_summary}"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
