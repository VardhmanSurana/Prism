/**
 * useEditingHistory.ts
 * Custom React hook encapsulating adjustments state, cropper values, full edit history list, entry deletion, hiding/unhiding, and restoration mechanisms.
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

/**
 * Chronologically recomposes the active image adjustments, rotation, flip, and crop source
 * starting from the original state by applying only active (non-hidden) history entries.
 */
const recomposeHistoryState = (history: HistoryEntry[], currentIndex: number) => {
  const initialEntry = history[0];
  const state = {
    imageSrc: initialEntry ? initialEntry.imageSrc : '',
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    rotation: 0,
    flipH: false,
    flipV: false,
    straightenAngle: 0,
    annotations: [] as Annotation[],
  };

  // Process chronological entries up to the current index
  for (let i = 1; i <= currentIndex; i++) {
    const entry = history[i];
    if (!entry || entry.hidden) continue;

    if (entry.type === 'crop') {
      state.imageSrc = entry.imageSrc;
    } else if (entry.type === 'rotate') {
      state.rotation = (state.rotation + (entry.value || 0)) % 360;
    } else if (entry.type === 'flip') {
      if (entry.description.toLowerCase().includes('horizontally')) {
        state.flipH = !state.flipH;
      } else if (entry.description.toLowerCase().includes('vertically')) {
        state.flipV = !state.flipV;
      }
    } else if (entry.type === 'straighten') {
      state.straightenAngle = entry.value || 0;
    } else if (entry.type === 'curves') {
      state.adjustments.curves = entry.adjustments.curves;
    } else if (entry.type === 'regions' || (typeof entry.type === 'string' && entry.type.startsWith('regions'))) {
      state.adjustments.regions = entry.adjustments.regions;
    } else if (entry.type === 'annotations') {
      state.annotations = entry.annotations ? [...entry.annotations] : [];
    } else {
      const key = entry.type as keyof Adjustments;
      if (key in state.adjustments) {
        if (key === 'splitToning' || key === 'grain' || key === 'lightLeak' || key === 'frame' || key === 'blend' || key === 'tiltShift' || key === 'hsl') {
          state.adjustments[key] = { ...entry.adjustments[key] } as any;
        } else {
          (state.adjustments as unknown as Record<string, any>)[key] = entry.value !== undefined ? entry.value : 0;
        }
      }
    }
  }

  return state;
};

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

  const addHistoryEntry = useCallback((
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

    const isCollapsible = type !== 'initial' && type !== 'crop' && type !== 'inpaint' && type !== 'rotate' && type !== 'flip' && type !== 'annotations';

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
  }, []);

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
      if (key === 'curves' || key === 'regions' || key === 'hsl' || key === 'splitToning' || key === 'grain' || key === 'lightLeak' || key === 'frame' || key === 'blend' || key === 'tiltShift') {
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
          } else if (key === 'regions') {
            const regionChanges = curr.regions.filter((r, i) => {
              const p = prev.regions[i];
              return !p || JSON.stringify(p.adjustments) !== JSON.stringify(r.adjustments);
            });
            
            regionChanges.forEach(region => {
              const prevRegion = prev.regions?.find(pr => pr.id === region.id);
              const regionName = region.type === 'face' ? 'Face Skin' : 
                                region.type === 'background' ? 'Background' : 
                                'Region';
              
              if (prevRegion) {
                const adjKeys = Object.keys(region.adjustments) as Array<keyof typeof region.adjustments>;
                const changedKey = adjKeys.find(k => region.adjustments[k] !== prevRegion.adjustments[k]);
                
                if (changedKey) {
                  const keyStr = changedKey as string;
                  const val = region.adjustments[changedKey] || 0;
                  const label = keyStr.charAt(0).toUpperCase() + keyStr.slice(1);
                  const formattedValue = val > 0 ? `+${val}` : val;
                  
                  addHistoryEntry(
                    `regions_${region.id}_${keyStr}` as HistoryActionType,
                    `${regionName} ${label} ${formattedValue}`,
                    val
                  );
                  return;
                }
              }
              addHistoryEntry('regions', `Adjusted ${regionName}`);
            });
          } else if (key === 'hsl') {
            addHistoryEntry('hsl' as HistoryActionType, 'Adjusted Color Mixer');
          } else if (key === 'splitToning') {
            addHistoryEntry('splitToning' as HistoryActionType, 'Adjusted Split Toning');
          } else if (key === 'grain') {
            addHistoryEntry('grain' as HistoryActionType, `Film Grain: ${curr.grain.amount}% (${curr.grain.size})`);
          } else if (key === 'lightLeak') {
            const presetName = curr.lightLeak.preset ? curr.lightLeak.preset.replace('-', ' ') : '';
            addHistoryEntry('lightLeak' as HistoryActionType, curr.lightLeak.preset ? `Light Leak: ${presetName}` : 'Removed Light Leak');
          } else if (key === 'frame') {
            addHistoryEntry('frame' as HistoryActionType, curr.frame.style !== 'none' ? `Frame: ${curr.frame.style}` : 'Removed Frame');
          } else if (key === 'blend') {
            addHistoryEntry('blend' as HistoryActionType, curr.blend.blendImageSrc ? 'Double Exposure Blended' : 'Removed Double Exposure');
          } else if (key === 'tiltShift') {
            addHistoryEntry('tiltShift' as HistoryActionType, curr.tiltShift.enabled ? `Tilt-Shift: ${curr.tiltShift.mode}` : 'Disabled Tilt-Shift');
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

  const handleJumpToHistory = useCallback((index: number) => {
    if (index < 0 || index >= history.length || index === currentHistoryIndex) return;

    const recomposed = recomposeHistoryState(history, index);
    const imageSrcChanged = recomposed.imageSrc !== stateRef.current.currentImageSrc;

    isRestoringHistory.current = true;

    revokeLocalUrl();
    setCurrentImageSrc(recomposed.imageSrc);
    setAdjustments(recomposed.adjustments);
    
    previousAdjustmentsRef.current = { ...recomposed.adjustments };
    previousRotationRef.current = recomposed.rotation;
    previousStraightenRef.current = recomposed.straightenAngle;
    previousFlipHRef.current = recomposed.flipH;
    previousFlipVRef.current = recomposed.flipV;
    
    setTotalRotation(recomposed.rotation);
    setFlipH(recomposed.flipH);
    setFlipV(recomposed.flipV);
    setStraightenAngle(recomposed.straightenAngle);
    setCurrentHistoryIndex(index);

    if (!imageSrcChanged) {
      setTimeout(() => {
        const cropper = cropperRef.current;
        if (cropper) {
          restoreCropperState(cropper, recomposed);
        } else {
          isRestoringHistory.current = false;
        }
      }, 50);
    }
  }, [history, currentHistoryIndex, cropperRef, revokeLocalUrl]);

  const handleToggleHideHistoryEntry = useCallback((index: number) => {
    setHistory(prev => {
      const newHistory = prev.map((entry, idx) => {
        if (idx === index) {
          return { ...entry, hidden: !entry.hidden };
        }
        return entry;
      });

      const recomposed = recomposeHistoryState(newHistory, currentHistoryIndex);
      const imageSrcChanged = recomposed.imageSrc !== stateRef.current.currentImageSrc;
      
      isRestoringHistory.current = true;
      setCurrentImageSrc(recomposed.imageSrc);
      setAdjustments(recomposed.adjustments);
      previousAdjustmentsRef.current = { ...recomposed.adjustments };
      previousRotationRef.current = recomposed.rotation;
      previousStraightenRef.current = recomposed.straightenAngle;
      previousFlipHRef.current = recomposed.flipH;
      previousFlipVRef.current = recomposed.flipV;
      setTotalRotation(recomposed.rotation);
      setFlipH(recomposed.flipH);
      setFlipV(recomposed.flipV);
      setStraightenAngle(recomposed.straightenAngle);

      if (!imageSrcChanged) {
        setTimeout(() => {
          const cropper = cropperRef.current;
          if (cropper) {
            restoreCropperState(cropper, recomposed);
          } else {
            isRestoringHistory.current = false;
          }
        }, 50);
      }

      return newHistory;
    });
  }, [currentHistoryIndex, cropperRef]);

  const handleDeleteHistoryEntry = useCallback((index: number) => {
    setHistory(prev => {
      if (index <= 0 || index >= prev.length) return prev;

      const newHistory = prev.filter((_, idx) => idx !== index);
      
      let newIndex = currentHistoryIndex;
      if (index === currentHistoryIndex) {
        newIndex = index - 1;
      } else if (index < currentHistoryIndex) {
        newIndex = currentHistoryIndex - 1;
      }

      const recomposed = recomposeHistoryState(newHistory, newIndex);
      const imageSrcChanged = recomposed.imageSrc !== stateRef.current.currentImageSrc;
      
      isRestoringHistory.current = true;
      setCurrentImageSrc(recomposed.imageSrc);
      setAdjustments(recomposed.adjustments);
      previousAdjustmentsRef.current = { ...recomposed.adjustments };
      previousRotationRef.current = recomposed.rotation;
      previousStraightenRef.current = recomposed.straightenAngle;
      previousFlipHRef.current = recomposed.flipH;
      previousFlipVRef.current = recomposed.flipV;
      setTotalRotation(recomposed.rotation);
      setFlipH(recomposed.flipH);
      setFlipV(recomposed.flipV);
      setStraightenAngle(recomposed.straightenAngle);
      setCurrentHistoryIndex(newIndex);

      if (!imageSrcChanged) {
        setTimeout(() => {
          const cropper = cropperRef.current;
          if (cropper) {
            restoreCropperState(cropper, recomposed);
          } else {
            isRestoringHistory.current = false;
          }
        }, 50);
      }

      return newHistory;
    });
  }, [currentHistoryIndex, cropperRef]);

  const handleClearHistory = useCallback(() => {
    const currentEntry = history[currentHistoryIndex];
    if (currentEntry) {
      setHistory([currentEntry]);
      setCurrentHistoryIndex(0);
    }
  }, [history, currentHistoryIndex]);

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      handleJumpToHistory(currentHistoryIndex - 1);
    }
  }, [currentHistoryIndex, handleJumpToHistory]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      handleJumpToHistory(currentHistoryIndex + 1);
    }
  }, [currentHistoryIndex, history.length, handleJumpToHistory]);

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
    handleJumpToHistory,
    handleToggleHideHistoryEntry,
    handleDeleteHistoryEntry,
    handleClearHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
};
