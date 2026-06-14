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
    const isHeic =
      photo.path?.toLowerCase().endsWith('.heic') ||
      photo.filename?.toLowerCase().endsWith('.heic');

    // For HEIC, browsers can't display the raw file — use the pre-converted thumbnail URL.
    // For all other formats, prefer the original full-resolution file via /local.
    const url =
      isHeic && photo.url
        ? photo.url
        : photo.path
        ? `local://${photo.path}`
        : photo.url || '';

    return resolveUrl(url);
  }, [photo.url, photo.path, photo.filename]);

  useEffect(() => {
    if (!highResUrl) {
      console.warn(
        `[useImageHighRes] photo.id=${photo.id} — no high-res URL available, falling back to thumbnail.`
      );
      setHighResStatus('error');
      setCurrentHighResUrl(null);
      return;
    }

    // Reset state every time the URL changes (new photo opened)
    setHighResStatus('loading');
    setCurrentHighResUrl(null);
    console.debug(
      `[useImageHighRes] photo.id=${photo.id} — attempting high-res load: ${highResUrl}`
    );

    let active = true;

    const img = new Image();

    img.onload = () => {
      if (!active) return;
      console.debug(
        `[useImageHighRes] photo.id=${photo.id} — ✓ high-res loaded: ${highResUrl}`
      );
      setCurrentHighResUrl(highResUrl);
      setHighResStatus('loaded');
    };

    img.onerror = () => {
      if (!active) return;
      // Probe with a HEAD request to surface the actual HTTP status code in devtools
      fetch(highResUrl, { method: 'HEAD' })
        .then((r) => {
          console.warn(
            `[useImageHighRes] photo.id=${photo.id} — ✗ high-res FAILED ` +
              `(HTTP ${r.status} ${r.statusText}): ${highResUrl}. ` +
              `photo.url=${photo.url}, photo.path=${photo.path}`
          );
        })
        .catch(() => {
          console.warn(
            `[useImageHighRes] photo.id=${photo.id} — ✗ high-res FAILED (network error): ${highResUrl}. ` +
              `photo.url=${photo.url}, photo.path=${photo.path}`
          );
        });
      setHighResStatus('error');
    };

    img.src = highResUrl;

    return () => {
      // Mark stale so in-flight onload/onerror don't update state after cleanup.
      // Also clears the effect guard — React StrictMode will remount and
      // re-trigger this effect correctly on the second mount.
      active = false;
    };
  }, [highResUrl, photo.id, photo.url, photo.path]);

  return {
    highResStatus,
    currentHighResUrl,
    highResUrl,
  };
};
