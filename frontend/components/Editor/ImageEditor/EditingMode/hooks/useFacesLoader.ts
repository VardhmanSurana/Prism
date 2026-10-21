/**
 * useFacesLoader.ts
 * Fetches the detected face bboxes for a photo on mount/photoId change.
 */
import { useEffect, useState } from 'react';
import type { FaceBBox } from '@plugins/retouch-metadata-studio/FaceBoundingBoxOverlay';
import { API_BASE } from '@/constants';

export function useFacesLoader(photoId?: number | string) {
  const [faces, setFaces] = useState<FaceBBox[]>([]);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${photoId}/faces`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.faces)) {
            setFaces(data.faces);
          }
        }
      } catch (err) {
        console.debug('Failed to fetch photo faces:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [photoId]);

  return { faces, selectedFaceIndex, setSelectedFaceIndex };
}
