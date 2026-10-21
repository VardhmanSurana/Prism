/**
 * useEditingHistory.ts
 * Custom React hook encapsulating adjustments state, custom variables,
 * crop, rotation, non-destructive timeline, and undo/redo history.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { HistoryEntry, HistoryActionType, appendBoundedHistory, createHistoryEntry } from '../history';
import { recomputeActiveEditorState } from '../historyUtils';
import { Adjustments, DEFAULT_ADJUSTMENTS } from '../filterEngine';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import {
  inferToolId,
  commitAdjustmentChange,
  useInitialAdjustmentsLoader,
} from './history';

export { inferToolId };

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
  if (!cropper) return;
  cropper.scaleX?.(state.flipH ? -1 : 1);
  cropper.scaleY?.(state.flipV ? -1 : 1);
  if (typeof cropper.rotateTo === 'function') {
    cropper.rotateTo(state.rotation);
  } else if (typeof cropper.rotate === 'function') {
    cropper.rotate(state.rotation);
  }
}

/**
 * useEditingHistory - Hook managing editing history state.
 */
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
  const [customVariables, setCustomVariables] = useState<Record<string, any>>({});
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [straightenAngle, setStraightenAngle] = useState<number>(0);
  const [totalRotation, setTotalRotation] = useState<number>(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  const isRestoringHistory = useRef(false);
  const createdUrlRef = useRef<string | null>(null);

  const stateRef = useRef({
    currentImageSrc,
    adjustments,
    customVariables,
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
    customVariables,
    totalRotation,
    flipH,
    flipV,
    straightenAngle,
    currentHistoryIndex,
    history,
    annotations,
  };

  const previousAdjustmentsRef = useRef<Adjustments>(DEFAULT_ADJUSTMENTS);
  const previousRotationRef = useRef<number>(0);
  const previousStraightenRef = useRef<number>(0);
  const previousFlipHRef = useRef<boolean>(false);
  const previousFlipVRef = useRef<boolean>(false);
  const pendingChangesRef = useRef<Map<keyof Adjustments, any>>(new Map());

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
      value?: any,
      overrideImageSrc?: string,
      overrideAnnotations?: Annotation[],
      options?: {
        customVariables?: Record<string, any>;
        hidden?: boolean;
        isSnapshot?: boolean;
        toolId?: string;
        propertyKey?: string;
      }
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
        overrideAnnotations || s.annotations,
        {
          customVariables: options?.customVariables || s.customVariables,
          hidden: options?.hidden,
          isSnapshot: options?.isSnapshot,
          toolId: options?.toolId || (options?.propertyKey ? inferToolId(options.propertyKey) : undefined),
          propertyKey: options?.propertyKey,
        }
      );

      const isCollapsible =
        !options?.isSnapshot &&
        type !== 'initial' &&
        type !== 'crop' &&
        type !== 'inpaint' &&
        type !== 'depth' &&
        type !== 'enhance' &&
        type !== 'colormatch' &&
        type !== 'rotate' &&
        type !== 'flip' &&
        type !== 'annotations';

      const appendEntry = (historyEntries: HistoryEntry[]) => {
        const activeHistory = historyEntries.slice(0, s.currentHistoryIndex + 1);
        let newHistory = activeHistory;
        let collapsed: HistoryEntry[] = [];
        if (isCollapsible) {
          collapsed = activeHistory.filter(h => h.type === type && h.propertyKey === options?.propertyKey);
          newHistory = newHistory.filter(h => !(h.type === type && h.propertyKey === options?.propertyKey));
        }
        const result = appendBoundedHistory(newHistory, newHistory.length - 1, entry);
        return { ...result, evicted: [...collapsed, ...result.evicted] };
      };

      setHistory(prev => {
        const result = appendEntry(prev);
        for (const evicted of result.evicted) {
          if (evicted.imageSrc.startsWith('blob:') && !result.history.some(h => h.imageSrc === evicted.imageSrc)) {
            URL.revokeObjectURL(evicted.imageSrc);
          }
        }
        return result.history;
      });

      setCurrentHistoryIndex(() => {
        return appendEntry(s.history).currentHistoryIndex;
      });
    },
    []
  );

  // Initialize history on mount or if photo changes
  const { initialAdjustmentsRef } = useInitialAdjustmentsLoader({
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
  });

  // Track adjustments and changes
  useEffect(() => {
    if (isRestoringHistory.current) return;

    const prev = previousAdjustmentsRef.current;
    const curr = adjustments;

    (Object.keys(curr) as Array<keyof Adjustments>).forEach(key => {
      if (
        key === 'curves' ||
        key === 'specializedCurves' ||
        key === 'hsl' ||
        key === 'colorWheels' ||
        key === 'splitToning' ||
        key === 'portrait' ||
        key === 'grain' ||
        key === 'lightLeak' ||
        key === 'frame' ||
        key === 'blend' ||
        key === 'tiltShift' ||
        key === 'layers' ||
        key === 'lut' ||
        key === 'background' ||
        key === 'raw'
      ) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
          pendingChangesRef.current.set(key, curr[key]);
        }
      } else if (prev[key] !== curr[key]) {
        const val = curr[key];
        if (typeof val === 'number') {
          pendingChangesRef.current.set(key, val);
        }
      }
    });

    if (pendingChangesRef.current.size > 0) {
      previousAdjustmentsRef.current = { ...curr };

      /**
       * timer - Performs timer.
       */
      const timer = setTimeout(() => {
        const changesToCommit = Array.from(pendingChangesRef.current.entries());
        pendingChangesRef.current.clear();

        changesToCommit.forEach(([key, value]) => {
          commitAdjustmentChange(key, value, curr, addHistoryEntry);
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [adjustments, addHistoryEntry]);

  // Track rotations
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (totalRotation !== previousRotationRef.current && totalRotation !== 0) {
      /**
       * timer - Performs timer.
       */
      const timer = setTimeout(() => {
        const degrees = totalRotation - previousRotationRef.current;
        addHistoryEntry('rotate', `Rotated ${degrees > 0 ? '+' : ''}${degrees}°`, degrees, undefined, undefined, {
          toolId: 'transform',
        });
        previousRotationRef.current = totalRotation;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [totalRotation, addHistoryEntry]);

  // Track straighten
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (straightenAngle !== previousStraightenRef.current && straightenAngle !== 0) {
      /**
       * timer - Performs timer.
       */
      const timer = setTimeout(() => {
        addHistoryEntry('straighten', `Straighten ${straightenAngle > 0 ? '+' : ''}${straightenAngle}°`, straightenAngle, undefined, undefined, {
          toolId: 'transform',
        });
        previousStraightenRef.current = straightenAngle;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [straightenAngle, addHistoryEntry]);

  // Track flips
  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (flipH !== previousFlipHRef.current) {
      addHistoryEntry('flip', flipH ? 'Flipped horizontally' : 'Un-flipped horizontally', flipH, undefined, undefined, {
        toolId: 'transform',
      });
      previousFlipHRef.current = flipH;
    }
  }, [flipH, addHistoryEntry]);

  useEffect(() => {
    if (isRestoringHistory.current) return;
    if (flipV !== previousFlipVRef.current) {
      addHistoryEntry('flip', flipV ? 'Flipped vertically' : 'Un-flipped vertically', flipV, undefined, undefined, {
        toolId: 'transform',
      });
      previousFlipVRef.current = flipV;
    }
  }, [flipV, addHistoryEntry]);

  const applyEntry = useCallback(
    (entry: HistoryEntry, index: number) => {
      isRestoringHistory.current = true;

      setCurrentImageSrc(entry.imageSrc);
      setAdjustments({ ...entry.adjustments });
      setCustomVariables(entry.customVariables ? { ...entry.customVariables } : {});
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
    [cropperRef, setAnnotations]
  );

  const toggleHideHistoryEntry = useCallback(
    (id: string) => {
      setHistory(prev => {
        const updated = prev.map(entry => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry));
        const recomputed = recomputeActiveEditorState(updated, initialAdjustmentsRef.current);
        isRestoringHistory.current = true;
        setAdjustments(recomputed.adjustments);
        setCustomVariables(recomputed.customVariables);
        previousAdjustmentsRef.current = { ...recomputed.adjustments };
        isRestoringHistory.current = false;
        return updated;
      });
    },
    [initialAdjustmentsRef]
  );

  const deleteHistoryEntry = useCallback(
    (id: string) => {
      setHistory(prev => {
        const target = prev.find(e => e.id === id);
        if (target?.type === 'initial') return prev; // Do not delete root initial state

        const updated = prev.filter(e => e.id !== id);
        if (target?.imageSrc.startsWith('blob:') && !updated.some(h => h.imageSrc === target.imageSrc)) {
          URL.revokeObjectURL(target.imageSrc);
        }

        const recomputed = recomputeActiveEditorState(updated, initialAdjustmentsRef.current);
        isRestoringHistory.current = true;
        setAdjustments(recomputed.adjustments);
        setCustomVariables(recomputed.customVariables);
        previousAdjustmentsRef.current = { ...recomputed.adjustments };
        isRestoringHistory.current = false;
        return updated;
      });

      setCurrentHistoryIndex(prev => Math.max(0, prev - 1));
    },
    [initialAdjustmentsRef]
  );

  const jumpToHistoryEntry = useCallback(
    (index: number) => {
      const target = history[index];
      if (target) {
        applyEntry(target, index);
      }
    },
    [history, applyEntry]
  );

  const setCustomVariable = useCallback(
    (key: string, value: any, options?: { label?: string; toolId?: string }) => {
      setCustomVariables(prev => {
        const next = { ...prev, [key]: value };
        addHistoryEntry(
          `customVar:${key}`,
          options?.label || `Set ${key}: ${typeof value === 'object' ? 'custom' : value}`,
          value,
          undefined,
          undefined,
          {
            toolId: options?.toolId,
            propertyKey: `customVariables.${key}`,
            customVariables: next,
          }
        );
        return next;
      });
    },
    [addHistoryEntry]
  );

  /**
   * handleUndo - Handles undo.
   */
  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const targetIndex = currentHistoryIndex - 1;
      const targetEntry = history[targetIndex];
      if (targetEntry) {
        applyEntry(targetEntry, targetIndex);
      }
    }
  }, [currentHistoryIndex, history, applyEntry]);

  /**
   * handleRedo - Handles redo.
   */
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

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      const urls = new Set(
        stateRef.current.history
          .map(entry => entry.imageSrc)
          .filter(source => source.startsWith('blob:'))
      );
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return {
    currentImageSrc,
    setCurrentImageSrc,
    adjustments,
    setAdjustments,
    customVariables,
    setCustomVariables,
    setCustomVariable,
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
    toggleHideHistoryEntry,
    deleteHistoryEntry,
    jumpToHistoryEntry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
};
