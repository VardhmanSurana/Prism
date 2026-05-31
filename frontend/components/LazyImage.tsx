import React, { useState, useEffect, useRef } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveUrl } from '../constants';

interface LazyImageProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, fallbackSrc, alt, className }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && status === 'idle') {
            setStatus('loading');
          }
        });
      },
      { rootMargin: '400px', threshold: 0.01 }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    setCurrentSrc(src);
    setStatus('idle');
    setIsUsingFallback(false);
  }, [src]);

  const handleError = () => {
    console.warn(`Failed to load image: ${currentSrc}`);
    if (fallbackSrc && !isUsingFallback) {
      console.log(`Attempting fallback to: ${fallbackSrc}`);
      setIsUsingFallback(true);
      setCurrentSrc(fallbackSrc);
    } else {
      setStatus('error');
    }
  };

  const displayUrl = resolveUrl(currentSrc);

  return (
    <div 
      ref={imgRef}
      className="relative w-full h-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center"
    >
      {status !== 'error' && (
        <img
          src={status !== 'idle' ? displayUrl : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          alt={alt}
          className={`${className} transition-all duration-700 ease-out 
            ${status === 'loaded' ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-105 blur-lg'}`}
        />
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0c]">
            <div className="w-6 h-6 border-2 border-white/5 border-t-white/40 rounded-full animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c0c] text-white/20 p-4">
            <ImageOff size={24} strokeWidth={1.5} className="mb-2" />
            <span className="text-[10px] uppercase tracking-widest font-medium opacity-50">Load Error</span>
        </div>
      )}
    </div>
  );
};
