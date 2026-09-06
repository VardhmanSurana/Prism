/**
 * useInitialAdjustmentsLoader.ts
 * Manages photo opening, remote adjustment metadata fetching, and high-res image upgrades.
 */

import { useEffect, useRef } from 'react';
import { API_BASE } from '@/constants';
import { Adjustments, DEFAULT_ADJUSTMENTS } from '../../filterEngine';
import { HistoryEntry, createHistoryEntry } from '../../history';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';

interface UseInitialAdjustmentsLoaderProps {
  src: string;
  photoId?: number | string;
  stateRef: React.MutableRefObject<{
    currentImageSrc: string;
    adjustments: Adjustments;
    history: HistoryEntry[];
  }>;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  setCurrentHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentImageSrc: React.Dispatch<React.SetStateAction<string>>;
  setAdjustments: React.Dispatch<React.SetStateAction<Adjustments>>;
  setCustomVariables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setAnnotations: (annotations: Annotation[]) => void;
  setAnnotationsHistoryPast: React.Dispatch<React.SetStateAction<Annotation[][]>>;
  setAnnotationsHistoryFuture: React.Dispatch<React.SetStateAction<Annotation[][]>>;
  isRestoringHistory: React.MutableRefObject<boolean>;
  previousAdjustmentsRef: React.MutableRefObject<Adjustments>;
  previousRotationRef: React.MutableRefObject<number>;
  previousStraightenRef: React.MutableRefObject<number>;
  previousFlipHRef: React.MutableRefObject<boolean>;
  previousFlipVRef: React.MutableRefObject<boolean>;
}

export function useInitialAdjustmentsLoader({
  src,
  photoId,
  stateRef,
  setHistory,
  setCurrentHistoryIndex,
  setCurrentImageSrc,
  setAdjustments,
  setCustomVariables,
  setAnnotations,
  setAnnotationsHistoryPast,
  setAnnotationsHistoryFuture,
  isRestoringHistory,
  previousAdjustmentsRef,
  previousRotationRef,
  previousStraightenRef,
  previousFlipHRef,
  previousFlipVRef,
}: UseInitialAdjustmentsLoaderProps) {
  const lastPhotoIdRef = useRef<string | null>(null);
  const initRunIdRef = useRef(0);
  const initialAdjustmentsRef = useRef<Adjustments>(DEFAULT_ADJUSTMENTS);
  const latestSrcRef = useRef(src);
  latestSrcRef.current = src;

  useEffect(() => {
    // Determine the stable canonical photo identifier (preferring explicit photoId prop)
    const canonicalPhotoId = photoId !== undefined && photoId !== null && String(photoId).length > 0
      ? String(photoId)
      : (src.match(/nocache=([^&-]+)/)?.[1] || src.split('?')[0]);

    if (lastPhotoIdRef.current !== canonicalPhotoId) {
      console.log(`[useEditingHistory] Opening photo: "${canonicalPhotoId}" (previous was "${lastPhotoIdRef.current}")`);
      for (const entry of stateRef.current.history) {
        if (entry.imageSrc.startsWith('blob:')) URL.revokeObjectURL(entry.imageSrc);
      }
      const runId = ++initRunIdRef.current;
      lastPhotoIdRef.current = canonicalPhotoId;

      const fetchInitialAdjustments = async () => {
        let initialAdjustments = DEFAULT_ADJUSTMENTS;
        const activePhotoId = photoId || canonicalPhotoId;
        if (activePhotoId && !isNaN(Number(activePhotoId))) {
          try {
            const res = await fetch(`${API_BASE}/api/v1/photos/${activePhotoId}/metadata`);
            if (res.ok) {
              const data = await res.json();
              if (data.adjustments) {
                initialAdjustments = data.adjustments;
              }
            }
          } catch (e) {
            console.error('[useEditingHistory] Failed to fetch initial photo adjustments:', e);
          }
        }

        if (runId !== initRunIdRef.current) return;

        // Guard: Do not overwrite if user already made edits while metadata was fetching
        const hasUserEdits = stateRef.current.history.length > 1 ||
          JSON.stringify(stateRef.current.adjustments) !== JSON.stringify(DEFAULT_ADJUSTMENTS);

        if (hasUserEdits) {
          console.warn('[useEditingHistory] Skipping initial-adjustments fetch — user edits already exist in progress.');
          return;
        }

        initialAdjustmentsRef.current = initialAdjustments;

        const effectiveSrc = latestSrcRef.current;
        const initialEntry = createHistoryEntry(
          'initial',
          'Original image',
          effectiveSrc,
          initialAdjustments,
          0,
          false,
          false,
          0
        );

        isRestoringHistory.current = true;
        setHistory([initialEntry]);
        setCurrentHistoryIndex(0);
        setCurrentImageSrc(prev => prev.startsWith('blob:') ? prev : effectiveSrc);
        setAdjustments(initialAdjustments);
        setCustomVariables({});

        previousAdjustmentsRef.current = { ...initialAdjustments };
        previousRotationRef.current = 0;
        previousStraightenRef.current = 0;
        previousFlipHRef.current = false;
        previousFlipVRef.current = false;
        setAnnotations([]);
        setAnnotationsHistoryPast([]);
        setAnnotationsHistoryFuture([]);

        isRestoringHistory.current = false;
      };

      fetchInitialAdjustments();
    } else {
      // Same photo — URL updated (e.g. background high-res loader finished after ~10s).
      // Keep current adjustments, timeline history, and annotations completely intact!
      console.log(`[useEditingHistory] High-res image upgraded for photo "${canonicalPhotoId}"`);
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const newHistory = [...prev];
        if (newHistory[0]?.type === 'initial') {
          newHistory[0] = { ...newHistory[0], imageSrc: src };
        }
        return newHistory;
      });

      setCurrentImageSrc(prev => prev.startsWith('blob:') ? prev : src);
    }
  }, [src, photoId, setAnnotations, setAnnotationsHistoryPast, setAnnotationsHistoryFuture, setAdjustments, setCurrentHistoryIndex, setCurrentImageSrc, setCustomVariables, setHistory, stateRef, isRestoringHistory, previousAdjustmentsRef, previousRotationRef, previousStraightenRef, previousFlipHRef, previousFlipVRef]);

  return { initialAdjustmentsRef };
}

