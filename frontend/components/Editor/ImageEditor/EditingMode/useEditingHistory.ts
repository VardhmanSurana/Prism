/**
 * useEditingHistory.ts
 * Custom React hook encapsulating adjustments state, crop, rotation, and linear undo/redo.
 * ponytail: removed history panel management functions (hide/unhide, arbitrary entry deletion).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { HistoryEntry, HistoryActionType, createHistoryEntry } from '../history';
import { Adjustments, DEFAULT_ADJUSTMENTS } from '../filterEngine';
import { Annotation } from '../AnnotationsPanel';
import { API_BASE } from '@/constants';

interface UseEditingHistoryProps {
  src: string;
  cropperRef: React.RefObject<any>;
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  setAnnotationsHistoryPast: React.Dispatch<React.SetStateAction<Annotation[][]>>;
  setAnnotationsHistoryFuture: React.Dispatch<React.SetStateAction<Annotation[][]>>;
  photoId?: number | string;
}

function restoreCropperState(cropper: any, state: { flipH: boolean; flipV: boolean; rotation: number }) {
  cropper.scaleX(state.flipH ? -1 : 1);
  cropper.scaleY(state.flipV ? -1 : 1);
  if (typeof cropper.rotateTo === 'function') {
    cropper.rotateTo(state.rotation);
  } else {
    cropper.rotate(state.rotation);
  }
}

export const useEditingHistory = ({
  src,
  cropperRef,
  annotations,
  setAnnotations,
  setAnnotationsHistoryPast,
  setAnnotationsHistoryFuture,
  photoId,
}: UseEditingHistoryProps) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(src);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [straightenAngle, setStraightenAngle] = useState<number>(0);
  const [totalRotation, setTotalRotation] = useState<number>(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  const isRestoringHistory = useRef(false);
  const createdUrlRef = useRef<string | null>(null);
  const lastPhotoIdRef = useRef<string | null>(null);

  const stateRef = useRef({
    currentImageSrc,
    adjustments,
    totalRotation,
    flipH,
    flipV,
    straightenAngle,
    currentHistoryIndex,
    history,
    annotations,
  });
  stateRef.current = {
    currentImageSrc,
    adjustments,
    totalRotation,
    flipH,
    flipV,
    straightenAngle,
    currentHistoryIndex,
    history,
    annotations,
  };

  const revokeLocalUrl = useCallback(() => {
    if (createdUrlRef.current) {
      URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = null;
    }
  }, []);

  const addHistoryEntry = useCallback(
    (
      type: HistoryActionType,
      description: string,
      value?: number,
      overrideImageSrc?: string,
      overrideAnnotations?: Annotation[]
    ) => {
      if (isRestoringHistory.current) return;

      const s = stateRef.current;
      const entry = createHistoryEntry(
        type,
        description,
        overrideImageSrc || s.currentImageSrc,
        s.adjustments,
        s.totalRotation,
        s.flipH,
        s.flipV,
        s.straightenAngle,
        value,
        overrideAnnotations || s.annotations
      );

      const isCollapsible =
        type !== 'initial' &&
        type !== 'crop' &&
        type !== 'inpaint' &&
        type !== 'rotate' &&
        type !== 'flip' &&
        type !== 'annotations';

      setHistory(prev => {
        let newHistory = prev.slice(0, s.currentHistoryIndex + 1);
        if (isCollapsible) {
          newHistory = newHistory.filter(h => h.type !== type);
        }
        return [...newHistory, entry];
      });

      setCurrentHistoryIndex(() => {
        let newHistory = s.history.slice(0, s.currentHistoryIndex + 1);
        if (isCollapsible) {
          newHistory = newHistory.filter(h => h.type !== type);
        }
        return newHistory.length;
      });
    },
    []
  );

  // Initialize history on mount or if photo changes
  useEffect(() => {
    const parsedIdMatch = src.match(/nocache=([^&-]+)/);
    const parsedId = parsedIdMatch ? parsedIdMatch[1] : src;

    if (lastPhotoIdRef.current !== parsedId) {
      const fetchInitialAdjustments = async () => {
        let initialAdjustments = DEFAULT_ADJUSTMENTS;
        const activePhotoId = photoId || parsedId;
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
            console.error('Failed to fetch initial photo adjustments:', e);
          }
        }

        const initialEntry = createHistoryEntry(
          'initial',
          'Original image',
          src,
          initialAdjustments,
          0,
          false,
          false,
          0
        );

        isRestoringHistory.current = true;
        setHistory([initialEntry]);
        setCurrentHistoryIndex(0);
        setCurrentImageSrc(src);
        setAdjustments(initialAdjustments);

        previousAdjustmentsRef.current = { ...initialAdjustments };
        previousRotationRef.current = 0;
        previousStraightenRef.current = 0;
        previousFlipHRef.current = false;
        previousFlipVRef.current = false;
        setAnnotations([]);
        setAnnotationsHistoryPast([]);
        setAnnotationsHistoryFuture([]);

        lastPhotoIdRef.current = parsedId;
        isRestoringHistory.current = false;
      };

      fetchInitialAdjustments();
    } else {
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const newHistory = [...prev];
        if (newHistory[0].type === 'initial') {
          newHistory[0] = { ...newHistory[0], imageSrc: src };
        }
        return newHistory;
      });

      if (!currentImageSrc.startsWith('blob:')) {
        setCurrentImageSrc(src);
      }
    }
  }, [src, photoId, setAnnotations, setAnnotationsHistoryPast, setAnnotationsHistoryFuture, currentImageSrc]);

  // Track adjustments and changes
  const previousAdjustmentsRef = useRef<Adjustments>(DEFAULT_ADJUSTMENTS);
  const previousRotationRef = useRef<number>(0);
  const previousStraightenRef = useRef<number>(0);
  const previousFlipHRef = useRef<boolean>(false);
  const previousFlipVRef = useRef<boolean>(false);

  useEffect(() => {
    if (isRestoringHistory.current) return;

    const prev = previousAdjustmentsRef.current;
    const curr = adjustments;
    const changes: Array<{ key: keyof Adjustments; value: number | string }> = [];

    (Object.keys(curr) as Array<keyof Adjustments>).forEach(key => {
      if (
        key === 'curves' ||
        key === 'hsl' ||
        key === 'splitToning' ||
        key === 'grain' ||
        key === 'lightLeak' ||
        key === 'frame' ||
        key === 'blend' ||
        key === 'tiltShift'
      ) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
          changes.push({ key, value: 'modified' });
        }
      } else if (prev[key] !== curr[key]) {
        const val = curr[key];
        if (typeof val === 'number') {
          changes.push({ key, value: val });
        }
      }
    });

    if (changes.length > 0) {
      previousAdjustmentsRef.current = { ...curr };

      const timer = setTimeout(() => {
        changes.forEach(({ key, value }) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
          const numValue = typeof value === 'number' ? value : undefined;

          if (key === 'curves') {
            addHistoryEntry(key as HistoryActionType, `Adjusted ${label}`);
          } else if (key === 'hsl') {
            addHistoryEntry('hsl' as HistoryActionType, 'Adjusted Color Mixer');
          } else if (key === 'splitToning') {
            addHistoryEntry('splitToning' as HistoryActionType, 'Adjusted Split Toning');
          } else if (key === 'grain') {
            addHistoryEntry('grain' as HistoryActionType, `Film Grain: ${curr.grain.amount}%`);
          } else if (key === 'lightLeak') {
            addHistoryEntry('lightLeak' as HistoryActionType, 'Adjusted Light Leak');
          } else if (key === 'frame') {
            addHistoryEntry('frame' as HistoryActionType, 'Adjusted Frame');
          } else if (key === 'blend') {
            addHistoryEntry('blend' as HistoryActionType, 'Adjusted Blend');
          } else if (key === 'tiltShift') {
            addHistoryEntry('tiltShift' as HistoryActionType, 'Adjusted Tilt-Shift');
          } else {
            addHistoryEntry(
              key as HistoryActionType,
              `${label} ${numValue !== undefined ? (numValue > 0 ? '+' : '') + numValue : 'adjusted'}`,
              numValue
            );
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [adjustments, addHistoryEntry]);

  // Track rotations
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (totalRotation !== previousRotationRef.current && totalRotation !== 0) {
      const timer = setTimeout(() => {
        const degrees = totalRotation - previousRotationRef.current;
        addHistoryEntry('rotate', `Rotated ${degrees > 0 ? '+' : ''}${degrees}°`, degrees);
        previousRotationRef.current = totalRotation;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [totalRotation, addHistoryEntry]);

  // Track straighten
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (straightenAngle !== previousStraightenRef.current && straightenAngle !== 0) {
      const timer = setTimeout(() => {
        addHistoryEntry('straighten', `Straighten ${straightenAngle > 0 ? '+' : ''}${straightenAngle}°`, straightenAngle);
        previousStraightenRef.current = straightenAngle;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [straightenAngle, addHistoryEntry]);

  // Track flips
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (flipH !== previousFlipHRef.current) {
      addHistoryEntry('flip', flipH ? 'Flipped horizontally' : 'Un-flipped horizontally');
      previousFlipHRef.current = flipH;
    }
  }, [flipH, addHistoryEntry]);

  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (flipV !== previousFlipVRef.current) {
      addHistoryEntry('flip', flipV ? 'Flipped vertically' : 'Un-flipped vertically');
      previousFlipVRef.current = flipV;
    }
  }, [flipV, addHistoryEntry]);

  const applyEntry = useCallback(
    (entry: HistoryEntry, index: number) => {
      isRestoringHistory.current = true;
      revokeLocalUrl();

      setCurrentImageSrc(entry.imageSrc);
      setAdjustments({ ...entry.adjustments });
      setTotalRotation(entry.rotation);
      setStraightenAngle(entry.straightenAngle);
      setFlipH(entry.flipH);
      setFlipV(entry.flipV);
      if (entry.annotations) {
        setAnnotations([...entry.annotations]);
      }

      previousAdjustmentsRef.current = { ...entry.adjustments };
      previousRotationRef.current = entry.rotation;
      previousStraightenRef.current = entry.straightenAngle;
      previousFlipHRef.current = entry.flipH;
      previousFlipVRef.current = entry.flipV;
      setCurrentHistoryIndex(index);

      const cropper = cropperRef.current;
      if (cropper) {
        restoreCropperState(cropper, entry);
      }
      isRestoringHistory.current = false;
    },
    [cropperRef, revokeLocalUrl, setAnnotations]
  );

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const targetIndex = currentHistoryIndex - 1;
      const targetEntry = history[targetIndex];
      if (targetEntry) {
        applyEntry(targetEntry, targetIndex);
      }
    }
  }, [currentHistoryIndex, history, applyEntry]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      const targetIndex = currentHistoryIndex + 1;
      const targetEntry = history[targetIndex];
      if (targetEntry) {
        applyEntry(targetEntry, targetIndex);
      }
    }
  }, [currentHistoryIndex, history, applyEntry]);

  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < history.length - 1;

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      revokeLocalUrl();
    };
  }, [revokeLocalUrl]);

  return {
    currentImageSrc,
    setCurrentImageSrc,
    adjustments,
    setAdjustments,
    flipH,
    setFlipH,
    flipV,
    setFlipV,
    straightenAngle,
    setStraightenAngle,
    totalRotation,
    setTotalRotation,
    history,
    setHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    isRestoringHistory,
    createdUrlRef,
    revokeLocalUrl,
    addHistoryEntry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
};
