/**
 * useAnnotationsState.ts
 * Custom React hook managing the annotations array, active text/doodle configuration states, gesture status watchers, and update callbacks.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Annotation } from '../AnnotationsPanel';

export const useAnnotationsState = () => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationsHistoryPast, setAnnotationsHistoryPast] = useState<Annotation[][]>([]);
  const [annotationsHistoryFuture, setAnnotationsHistoryFuture] = useState<Annotation[][]>([]);
  
  const annotationsStartRef = useRef<Annotation[] | null>(null);
  const isGestureActiveRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);
  const latestAnnotationsRef = useRef<Annotation[]>(annotations);

  useEffect(() => {
    latestAnnotationsRef.current = annotations;
  }, [annotations]);

  const pushToAnnotationsHistory = useCallback((pastState: Annotation[]) => {
    setAnnotationsHistoryPast(prev => [...prev, pastState]);
    setAnnotationsHistoryFuture([]);
  }, []);

  const onStartGesture = useCallback(() => {
    isGestureActiveRef.current = true;
    if (!annotationsStartRef.current) {
      annotationsStartRef.current = latestAnnotationsRef.current;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const onEndGesture = useCallback(() => {
    isGestureActiveRef.current = false;
    const start = annotationsStartRef.current;
    if (start) {
      const current = latestAnnotationsRef.current;
      if (JSON.stringify(start) !== JSON.stringify(current)) {
        pushToAnnotationsHistory(start);
      }
      annotationsStartRef.current = null;
    }
  }, [pushToAnnotationsHistory]);

  const updateAnnotations = useCallback((
    value: Annotation[] | ((prev: Annotation[]) => Annotation[])
  ) => {
    const prev = latestAnnotationsRef.current;
    const next = typeof value === 'function' ? value(prev) : value;

    if (!isGestureActiveRef.current) {
      if (!annotationsStartRef.current) {
        annotationsStartRef.current = prev;
      }
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const start = annotationsStartRef.current;
        if (start) {
          const current = latestAnnotationsRef.current;
          if (JSON.stringify(start) !== JSON.stringify(current)) {
            pushToAnnotationsHistory(start);
          }
          annotationsStartRef.current = null;
        }
      }, 600);
    }

    setAnnotations(next);
  }, [pushToAnnotationsHistory]);

  const undoAnnotations = useCallback(() => {
    if (annotationsHistoryPast.length === 0) return;
    const previous = annotationsHistoryPast[annotationsHistoryPast.length - 1];
    const newPast = annotationsHistoryPast.slice(0, -1);
    
    setAnnotationsHistoryFuture(prev => [latestAnnotationsRef.current, ...prev]);
    setAnnotationsHistoryPast(newPast);
    setAnnotations(previous);
  }, [annotationsHistoryPast]);

  const redoAnnotations = useCallback(() => {
    if (annotationsHistoryFuture.length === 0) return;
    const next = annotationsHistoryFuture[0];
    const newFuture = annotationsHistoryFuture.slice(1);
    
    setAnnotationsHistoryPast(prev => [...prev, latestAnnotationsRef.current]);
    setAnnotationsHistoryFuture(newFuture);
    setAnnotations(next);
  }, [annotationsHistoryFuture]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  
  // Text layer settings state
  const [fontFamily, setFontFamily] = useState<string>('Space Grotesk');
  const [fontSize, setFontSize] = useState<number>(36);
  const [fontWeight, setWeight] = useState<'normal' | 'bold'>('bold');
  const [fontStyle, setStyle] = useState<'normal' | 'italic'>('normal');
  const [textDecoration, setDecoration] = useState<'none' | 'underline' | 'line-through'>('none');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);

  // Text doodle settings state
  const [doodleText, setDoodleText] = useState<string>('peace in the air');
  const [doodleFontSize, setDoodleFontSize] = useState<number>(18);
  const [doodleFontFamily, setDoodleFontFamily] = useState<string>('Space Grotesk');
  const [showDoodleGuide, setShowDoodleGuide] = useState<boolean>(true);

  // Synchronize sidebar state when selected annotation changes
  useEffect(() => {
    if (selectedAnnId) {
      const selected = annotations.find(a => a.id === selectedAnnId);
      if (selected && selected.type === 'text') {
        setFontFamily(selected.fontFamily || 'Space Grotesk');
        setFontSize(selected.fontSize || 36);
        setWeight(selected.fontWeight || 'normal');
        setStyle(selected.fontStyle || 'normal');
        setDecoration(selected.textDecoration || 'none');
        setTextAlign(selected.textAlign || 'center');
        setLineHeight(selected.lineHeight || 1.2);
        setLetterSpacing(selected.letterSpacing || 0);
      }
    }
  }, [selectedAnnId, annotations]);

  const onUpdateTextProps = useCallback((updatedProps: Partial<Annotation>) => {
    if (!selectedAnnId) return;
    updateAnnotations(prev =>
      prev.map(ann =>
        ann.id === selectedAnnId ? { ...ann, ...updatedProps } : ann
      )
    );
  }, [selectedAnnId, updateAnnotations]);

  return {
    annotations,
    setAnnotations,
    annotationsHistoryPast,
    setAnnotationsHistoryPast,
    annotationsHistoryFuture,
    setAnnotationsHistoryFuture,
    selectedAnnId,
    setSelectedAnnId,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    fontWeight,
    setWeight,
    fontStyle,
    setStyle,
    textDecoration,
    setDecoration,
    textAlign,
    setTextAlign,
    lineHeight,
    setLineHeight,
    letterSpacing,
    setLetterSpacing,
    doodleText,
    setDoodleText,
    doodleFontSize,
    setDoodleFontSize,
    doodleFontFamily,
    setDoodleFontFamily,
    showDoodleGuide,
    setShowDoodleGuide,
    onStartGesture,
    onEndGesture,
    updateAnnotations,
    undoAnnotations,
    redoAnnotations,
    onUpdateTextProps,
  };
};
