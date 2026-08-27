/**
 * useEditDraftAutoSave.ts
 * React hook that automatically saves in-progress image edits to localStorage (debounced 300ms),
 * restores drafts upon opening the editor, and provides recovery/discard handlers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Adjustments, DEFAULT_ADJUSTMENTS } from '@/components/Editor/ImageEditor/filterEngine';
import { isIdentityCurve } from '@/components/Editor/ImageEditor/curves';
import type { Annotation } from '@plugins/retouch-metadata-studio/AnnotationsPanel/types';
import {
  saveEditDraft,
  getEditDraft,
  clearEditDraft,
  EditDraft,
} from '@/store/editDraftStore';

interface UseEditDraftAutoSaveProps {
  photoId?: number | string;
  adjustments: Adjustments;
  setAdjustments: (adj: Adjustments | ((prev: Adjustments) => Adjustments)) => void;
  totalRotation: number;
  setTotalRotation: (rot: number) => void;
  straightenAngle: number;
  setStraightenAngle: (angle: number) => void;
  flipH: boolean;
  setFlipH: (f: boolean) => void;
  flipV: boolean;
  setFlipV: (f: boolean) => void;
  annotations: Annotation[];
  setAnnotations: (ann: Annotation[]) => void;
  cropperRef: React.RefObject<any>;
  rawSettings?: any;
  liquifySettings?: any;
  isSaving?: boolean;
}

export function useEditDraftAutoSave({
  photoId,
  adjustments,
  setAdjustments,
  totalRotation,
  setTotalRotation,
  straightenAngle,
  setStraightenAngle,
  flipH,
  setFlipH,
  flipV,
  setFlipV,
  annotations,
  setAnnotations,
  cropperRef,
  rawSettings,
  liquifySettings,
  isSaving = false,
}: UseEditDraftAutoSaveProps) {
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const isInitializedRef = useRef(false);
  const initialPhotoIdRef = useRef<string | number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current state differs from baseline
  const isDirty = useCallback((): boolean => {
    if (totalRotation !== 0 || straightenAngle !== 0 || flipH || flipV) return true;
    if (annotations && annotations.length > 0) return true;
    
    // Compare adjustments with default
    const keys = Object.keys(DEFAULT_ADJUSTMENTS) as (keyof Adjustments)[];
    for (const k of keys) {
      if (typeof DEFAULT_ADJUSTMENTS[k] === 'number') {
        if (adjustments[k] !== DEFAULT_ADJUSTMENTS[k]) return true;
      }
    }
    if (adjustments.curves && !isIdentityCurve(adjustments.curves)) return true;

    return false;
  }, [adjustments, totalRotation, straightenAngle, flipH, flipV, annotations]);

  // Initial load / draft restoration on mount
  useEffect(() => {
    if (!photoId) return;
    if (initialPhotoIdRef.current === photoId) return;
    initialPhotoIdRef.current = photoId;

    const draft = getEditDraft(photoId);
    if (draft && draft.lastModified) {
      // Check if draft has actual changes
      const hasChanges =
        draft.totalRotation !== 0 ||
        draft.straightenAngle !== 0 ||
        draft.flipH ||
        draft.flipV ||
        (draft.annotations && draft.annotations.length > 0) ||
        JSON.stringify(draft.adjustments) !== JSON.stringify(DEFAULT_ADJUSTMENTS);

      if (hasChanges) {
        setAdjustments(draft.adjustments);
        setTotalRotation(draft.totalRotation || 0);
        setStraightenAngle(draft.straightenAngle || 0);
        setFlipH(Boolean(draft.flipH));
        setFlipV(Boolean(draft.flipV));
        if (draft.annotations) {
          setAnnotations(draft.annotations);
        }
        setDraftTimestamp(draft.lastModified);
        setHasRestoredDraft(true);
      }
    }

    // Delay auto-saving until after initial mount
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 600);

    return () => {
      clearTimeout(timer);
    };
  }, [photoId, setAdjustments, setTotalRotation, setStraightenAngle, setFlipH, setFlipV, setAnnotations]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isInitializedRef.current || !photoId || isSaving) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (isDirty()) {
        const cropBoxData = cropperRef.current?.getCropBoxData?.();
        saveEditDraft(photoId, {
          adjustments,
          totalRotation,
          straightenAngle,
          flipH,
          flipV,
          cropBoxData,
          annotations,
          rawSettings,
          liquifySettings,
        });
      } else {
        clearEditDraft(photoId);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    photoId,
    adjustments,
    totalRotation,
    straightenAngle,
    flipH,
    flipV,
    annotations,
    rawSettings,
    liquifySettings,
    cropperRef,
    isSaving,
    isDirty,
  ]);

  const dismissBanner = useCallback(() => {
    setHasRestoredDraft(false);
  }, []);

  const discardDraft = useCallback(() => {
    if (photoId) {
      clearEditDraft(photoId);
    }
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setTotalRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
    setAnnotations([]);
    if (cropperRef.current) {
      cropperRef.current.scaleX(1);
      cropperRef.current.scaleY(1);
      if (typeof cropperRef.current.rotateTo === 'function') {
        cropperRef.current.rotateTo(0);
      }
    }
    setHasRestoredDraft(false);
  }, [photoId, setAdjustments, setTotalRotation, setStraightenAngle, setFlipH, setFlipV, setAnnotations, cropperRef]);

  const clearDraft = useCallback(() => {
    if (photoId) {
      clearEditDraft(photoId);
    }
    setHasRestoredDraft(false);
  }, [photoId]);

  return {
    hasRestoredDraft,
    draftTimestamp,
    isDirty: isDirty(),
    dismissBanner,
    discardDraft,
    clearDraft,
  };
}
