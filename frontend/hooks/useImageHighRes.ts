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
    const isHeic = photo.path?.toLowerCase().endsWith('.heic') || photo.filename?.toLowerCase().endsWith('.heic');

    // For HEIC, browsers can't display the raw file — use the pre-converted thumbnail URL.
    // For all other formats, prefer the original full-resolution file via /local.
    const url = (isHeic && photo.url) ? photo.url : (photo.path ? `local://${photo.path}` : (photo.url || ''));
    return resolveUrl(url);
  }, [photo.url, photo.path, photo.filename]);

  useEffect(() => {
    if (!highResUrl) {
      setHighResStatus('error');
      setCurrentHighResUrl(null);
      return;
    }

    // Reset state every time the URL changes (new photo opened)
    setHighResStatus('loading');
    setCurrentHighResUrl(null);

    let active = true;

    const img = new Image();
    img.onload = () => {
      if (!active) return;
      setCurrentHighResUrl(highResUrl);
      setHighResStatus('loaded');
    };
    img.onerror = () => {
      if (!active) return;
      console.warn('[useImageHighRes] Failed to load hi-res image:', highResUrl);
      setHighResStatus('error');
    };
    img.src = highResUrl;

    return () => {
      // Mark stale so in-flight onload/onerror don't update state after cleanup.
      // Also clears the effect guard — React StrictMode will remount and
      // re-trigger this effect correctly on the second mount.
      active = false;
    };
  }, [highResUrl]);

  return {
    highResStatus,
    currentHighResUrl,
    highResUrl,
  };
};
