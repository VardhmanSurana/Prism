import { useState, useEffect, type FC } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveUrl } from '../constants';

interface LazyImageProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className: string;
}

export const LazyImage: FC<LazyImageProps> = ({ src, fallbackSrc, alt, className }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setStatus('loading');
    setIsUsingFallback(false);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && !isUsingFallback) {
      setIsUsingFallback(true);
      setCurrentSrc(fallbackSrc);
      setStatus('loading');
    } else {
      setStatus('error');
    }
  };

  const displayUrl = resolveUrl(currentSrc);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
      {status !== 'error' && (
        <img
          src={displayUrl}
          loading="lazy"
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
