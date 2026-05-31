import { useState, useEffect, useMemo } from 'react';
import { Photo } from '../types';
import { resolveUrl } from '../constants';

interface UseImageHighResProps {
  photo: Photo;
}

export const useImageHighRes = ({ photo }: UseImageHighResProps) => {
  const [highResStatus, setHighResStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentHighResUrl, setCurrentHighResUrl] = useState<string | null>(null);

  const highResUrl = useMemo(() => {
    const url = photo.path ? `local://${photo.path}` : (photo.url || '');
    try {
      if (url.includes('picsum.photos')) {
          const parts = url.split('/');
          if (parts.length >= 3) {
            parts[parts.length - 2] = '2000';
            parts[parts.length - 1] = '1500';
            return parts.join('/');
          }
      }
    } catch (e) {
      console.warn("Could not parse high-res URL", e);
    }
    return resolveUrl(url);
  }, [photo.url, photo.path]);

  useEffect(() => {
    setHighResStatus('loading');
    setCurrentHighResUrl(null);
    const img = new Image();
    img.src = highResUrl;
    img.onload = () => {
      setCurrentHighResUrl(highResUrl);
      setHighResStatus('loaded');
    };
    img.onerror = () => {
      setHighResStatus('error');
    };
  }, [highResUrl]);

  return {
    highResStatus,
    currentHighResUrl,
    highResUrl
  };
};
