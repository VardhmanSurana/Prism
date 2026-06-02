/**
 * EditingMode.tsx
 * Logic, state management, and UI layer for the image editor.
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { AdjustPanel } from './AdjustPanel';
import { DetailPanel } from './DetailPanel';
import { EffectsPanel } from './EffectsPanel';
import { TransformPanel } from './TransformPanel';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CanvasArea } from './CanvasArea';
import { HistoryPanel } from './HistoryPanel';
import { Adjustments, DEFAULT_ADJUSTMENTS, toFilterString, isDefaultAdjustments } from './filterEngine';
import { DEFAULT_CURVE, getCurvesTableValues } from './CurveEditor';
import { HistoryEntry, HistoryActionType, createHistoryEntry } from './history';

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
    } else {
      const key = entry.type as keyof Adjustments;
      if (key in state.adjustments) {
        (state.adjustments as any)[key] = entry.value !== undefined ? entry.value : 0;
      }
    }
  }

  return state;
};

interface EditingModeProps {
  src:     string;
  onClose: () => void;
  onSave:  (file: Blob, isSaveAs: boolean) => void;
}

export const EditingMode: React.FC<EditingModeProps> = ({
  src,
  onClose,
  onSave,
}) => {
  // ── Refs / state ───────────────────────────────────────────────────────────
  const cropperRef = useRef<ReactCropperElement>(null);
  const [currentRatio,    setCurrentRatio]    = useState<number>(NaN);
  const [totalRotation,   setTotalRotation]   = useState<number>(0);
  const [activeTool,      setActiveTool]      = useState<'transform' | 'adjust' | 'detail' | 'effects'>('transform');
  const [adjustments,     setAdjustments]     = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [flipH,           setFlipH]           = useState<boolean>(false);
  const [flipV,           setFlipV]           = useState<boolean>(false);
  const [straightenAngle, setStraightenAngle] = useState<number>(0);
  const [isSaving,        setIsSaving]        = useState<boolean>(false);
  const savedCropBoxRef  = useRef<Cropper.CropBoxData | null>(null);

  // In-place Crop management
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(src);
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const createdUrlRef = useRef<string | null>(null);
  const isImageCropped = currentImageSrc !== src;

  // History tracking
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const isRestoringHistory = useRef(false);

  // Mirror state into a ref so addHistoryEntry can have a stable identity
  // (avoids re-firing the five watcher useEffects below on every history mutation).
  const stateRef = useRef({
    currentImageSrc,
    adjustments,
    totalRotation,
    flipH,
    flipV,
    straightenAngle,
    currentHistoryIndex,
    history,
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
  };

  // Helper to add a history entry
  const addHistoryEntry = useCallback((type: HistoryActionType, description: string, value?: number, overrideImageSrc?: string) => {
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
      value
    );

    setHistory(prev => {
      // Remove any future history if we're not at the end
      let newHistory = prev.slice(0, s.currentHistoryIndex + 1);

      // Check if the last entry is the same type (for adjustments)
      // If so, replace it instead of adding a new one
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry && lastEntry.type === type && type !== 'crop' && type !== 'initial') {
        // Replace the last entry of the same type
        newHistory[newHistory.length - 1] = entry;
        return newHistory;
      }

      // Otherwise, add new entry
      return [...newHistory, entry];
    });

    setCurrentHistoryIndex(prev => {
      // Only increment if we're actually adding a new entry
      const lastEntry = s.history[s.currentHistoryIndex];
      if (lastEntry && lastEntry.type === type && type !== 'crop' && type !== 'initial') {
        return prev; // Don't increment, we replaced
      }
      return prev + 1;
    });
  }, []);

  // Initialize history on mount or if photo changes
  // We use a ref to track the last "true" photo source to detect if we actually changed photos
  const lastPhotoIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Extract photo ID from nocache parameter if possible
    const photoIdMatch = src.match(/nocache=([^&-]+)/);
    const photoId = photoIdMatch ? photoIdMatch[1] : src;

    if (lastPhotoIdRef.current !== photoId) {
      // This is a NEW photo, initialize everything
      const initialEntry = createHistoryEntry(
        'initial',
        'Original image',
        src,
        DEFAULT_ADJUSTMENTS,
        0,
        false,
        false,
        0
      );
      setHistory([initialEntry]);
      setCurrentHistoryIndex(0);
      setCurrentImageSrc(src);
      
      // Initialize refs to prevent false initial history entries
      previousAdjustmentsRef.current = DEFAULT_ADJUSTMENTS;
      previousRotationRef.current = 0;
      previousStraightenRef.current = 0;
      previousFlipHRef.current = false;
      previousFlipVRef.current = false;
      
      lastPhotoIdRef.current = photoId;
    } else {
      // Same photo, but src changed (likely high-res upgrade)
      // Update the base image in history and current preview if not cropped
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const newHistory = [...prev];
        if (newHistory[0].type === 'initial') {
          newHistory[0] = { ...newHistory[0], imageSrc: src };
        }
        return newHistory;
      });

      // Update preview source if we haven't cropped yet (crops use blob: URLs)
      if (!currentImageSrc.startsWith('blob:')) {
        setCurrentImageSrc(src);
      }
    }
  }, [src]);

  // Track adjustment changes in real-time with debouncing
  const previousAdjustmentsRef = useRef<Adjustments>(DEFAULT_ADJUSTMENTS);
  const previousRotationRef = useRef<number>(0);
  const previousStraightenRef = useRef<number>(0);
  const previousFlipHRef = useRef<boolean>(false);
  const previousFlipVRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (isRestoringHistory.current) return;
    
    const prev = previousAdjustmentsRef.current;
    const curr = adjustments;
    
    // Find what changed
    const changes: Array<{ key: keyof Adjustments; value: any }> = [];
    
    (Object.keys(curr) as Array<keyof Adjustments>).forEach(key => {
      if (key === 'curves') {
        if (prev.curves !== curr.curves) {
          changes.push({ key, value: 'modified' });
        }
      } else if (prev[key] !== curr[key]) {
        changes.push({ key, value: curr[key] });
      }
    });
    
    // Add history entry for each change with debounce
    if (changes.length > 0) {
      previousAdjustmentsRef.current = { ...curr };

      const timer = setTimeout(() => {
        changes.forEach(({ key, value }) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
          const numValue = typeof value === 'number' ? value : undefined;
          
          if (key === 'curves') {
            addHistoryEntry(key as HistoryActionType, `Adjusted ${label}`);
          } else {
            addHistoryEntry(
              key as HistoryActionType, 
              `${label} ${numValue !== undefined ? (numValue > 0 ? '+' : '') + numValue : 'adjusted'}`,
              numValue
            );
          }
        });
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timer);
    }
  }, [adjustments, addHistoryEntry]);

  // Track rotation changes
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

  // Track straighten changes
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

  // Track flip changes
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

  const revokeLocalUrl = () => {
    if (createdUrlRef.current) {
      URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = null;
    }
  };

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      revokeLocalUrl();
    };
  }, []);

  // Sync state if navigation or prop source changes
  useEffect(() => {
    revokeLocalUrl();
    setCurrentImageSrc(src);
    setHasCropSelection(false);
    setTotalRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
  }, [src]);

  // Track activeTool with ref to keep handleCropEvent stable
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const handleCropEvent = useCallback(() => {
    if (activeToolRef.current !== 'transform') {
      setHasCropSelection(false);
      return;
    }

    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const cropBoxData = cropper.getCropBoxData();
    const canvasData  = cropper.getCanvasData();

    if (!cropBoxData || !canvasData) return;

    // Detect if selection is smaller than full image
    const isSub =
      cropBoxData.width > 0 && cropBoxData.height > 0 &&
      (
        cropBoxData.width  < canvasData.width  * 0.985 ||
        cropBoxData.height < canvasData.height * 0.985 ||
        cropBoxData.left   > canvasData.left   + 3 ||
        cropBoxData.top    > canvasData.top    + 3
      );

    setHasCropSelection(prev => {
      if (prev !== isSub) return isSub;
      return prev;
    });
  }, []);

  const handleApplyCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    try {
      const croppedCanvas = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      croppedCanvas.toBlob((blob) => {
        if (!blob) return;

        revokeLocalUrl();

        const newUrl = URL.createObjectURL(blob);
        createdUrlRef.current = newUrl;

        setCurrentImageSrc(newUrl);
        setHasCropSelection(false);

        // Reset transform values (they are baked into the new cropped canvas)
        setTotalRotation(0);
        setStraightenAngle(0);
        setFlipH(false);
        setFlipV(false);

        // Add to history
        addHistoryEntry('crop', 'Applied crop', undefined, newUrl);
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error('Failed to apply crop in-place:', e);
    }
  };

  const handleResetCrop = () => {
    revokeLocalUrl();
    setCurrentImageSrc(src);
    setHasCropSelection(false);

    setTotalRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
  };

  const filterString = useMemo(() => toFilterString(adjustments), [adjustments]);

  useEffect(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    if (activeTool === 'adjust' || activeTool === 'detail' || activeTool === 'effects') {
      const cropBoxData = cropper.getCropBoxData();
      savedCropBoxRef.current = cropBoxData;

      cropper.clear();
      cropper.setDragMode('none');
    } else {
      cropper.setDragMode('crop');
      cropper.crop();
      if (savedCropBoxRef.current) {
        cropper.setCropBoxData(savedCropBoxRef.current);
      }
    }
  }, [activeTool]);

  // ── Crop functions ─────────────────────────────────────────

  const handleRotate = (degree: number) => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const newTotal = ((totalRotation + degree) % 360 + 360) % 360;
    setTotalRotation(newTotal);

    cropper.clear();
    cropper.rotate(degree);

    const containerData = cropper.getContainerData();
    const imageData     = cropper.getImageData();
    const isSideways    = newTotal === 90 || newTotal === 270;
    const displayW      = isSideways ? imageData.naturalHeight : imageData.naturalWidth;
    const displayH      = isSideways ? imageData.naturalWidth  : imageData.naturalHeight;

    const scale    = Math.min(
      (containerData.width  * 0.80) / displayW,
      (containerData.height * 0.80) / displayH,
    );
    const newWidth  = displayW * scale;
    const newHeight = displayH * scale;

    cropper.setCanvasData({
      width:  newWidth,
      height: newHeight,
      left:   (containerData.width  - newWidth)  / 2,
      top:    (containerData.height - newHeight) / 2,
    });

    if (!isNaN(currentRatio)) {
      const newRatio = 1 / currentRatio;
      setCurrentRatio(newRatio);
      cropper.setAspectRatio(newRatio);
    } else {
      cropper.crop();
    }
  };

  const handleSetAspectRatio = (ratio: number) => {
    setCurrentRatio(ratio);
    cropperRef.current?.cropper.setAspectRatio(ratio);
  };

  const handleReady = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const containerData = cropper.getContainerData();
    const canvasData    = cropper.getCanvasData();

    const scale = Math.min(
      (containerData.width  * 0.80) / canvasData.width,
      (containerData.height * 0.80) / canvasData.height,
    );

    if (scale < 1) {
      const newWidth  = canvasData.width  * scale;
      const newHeight = canvasData.height * scale;
      const newLeft   = (containerData.width  - newWidth)  / 2;
      const newTop    = (containerData.height - newHeight) / 2;
      cropper.setCropBoxData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
      cropper.setCanvasData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    }

    if (isRestoringHistory.current) {
      const s = stateRef.current;
      cropper.scaleX(s.flipH ? -1 : 1);
      cropper.scaleY(s.flipV ? -1 : 1);
      if (typeof (cropper as any).rotateTo === 'function') {
        (cropper as any).rotateTo(s.totalRotation);
      } else {
        cropper.rotate(s.totalRotation);
      }
      isRestoringHistory.current = false;
    }
  };

  const handleFlipH = () => {
    const next = !flipH;
    setFlipH(next);
    cropperRef.current?.cropper.scaleX(next ? -1 : 1);
  };

  const handleFlipV = () => {
    const next = !flipV;
    setFlipV(next);
    cropperRef.current?.cropper.scaleY(next ? -1 : 1);
  };

  const handleStraighten = (angle: number) => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const delta = angle - straightenAngle;
    setStraightenAngle(angle);
    cropper.rotate(delta);
  };

  // History navigation
  const handleJumpToHistory = useCallback((index: number) => {
    if (index < 0 || index >= history.length || index === currentHistoryIndex) return;

    const recomposed = recomposeHistoryState(history, index);
    const imageSrcChanged = recomposed.imageSrc !== stateRef.current.currentImageSrc;

    isRestoringHistory.current = true;

    // Restore the state
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
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
          cropper.scaleX(recomposed.flipH ? -1 : 1);
          cropper.scaleY(recomposed.flipV ? -1 : 1);
          if (typeof (cropper as any).rotateTo === 'function') {
            (cropper as any).rotateTo(recomposed.rotation);
          } else {
            cropper.rotate(recomposed.rotation);
          }
        }
        isRestoringHistory.current = false;
      }, 50);
    }
  }, [history, currentHistoryIndex]);

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
          const cropper = cropperRef.current?.cropper;
          if (cropper) {
            cropper.scaleX(recomposed.flipH ? -1 : 1);
            cropper.scaleY(recomposed.flipV ? -1 : 1);
            if (typeof (cropper as any).rotateTo === 'function') {
              (cropper as any).rotateTo(recomposed.rotation);
            } else {
              cropper.rotate(recomposed.rotation);
            }
          }
          isRestoringHistory.current = false;
        }, 50);
      }

      return newHistory;
    });
  }, [currentHistoryIndex]);

  const handleDeleteHistoryEntry = useCallback((index: number) => {
    setHistory(prev => {
      if (index <= 0 || index >= prev.length) return prev; // Cannot delete initial

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
          const cropper = cropperRef.current?.cropper;
          if (cropper) {
            cropper.scaleX(recomposed.flipH ? -1 : 1);
            cropper.scaleY(recomposed.flipV ? -1 : 1);
            if (typeof (cropper as any).rotateTo === 'function') {
              (cropper as any).rotateTo(recomposed.rotation);
            } else {
              cropper.rotate(recomposed.rotation);
            }
          }
          isRestoringHistory.current = false;
        }, 50);
      }

      return newHistory;
    });
  }, [currentHistoryIndex]);

  const handleClearHistory = useCallback(() => {
    const currentEntry = history[currentHistoryIndex];
    if (currentEntry) {
      setHistory([currentEntry]);
      setCurrentHistoryIndex(0);
    }
  }, [history, currentHistoryIndex]);

  const handleAdjChange = useCallback((adj: Adjustments) => {
    setAdjustments(adj);
  }, []);

  const handleSave = (isSaveAs: boolean) => {
    if (isSaving) return;
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    setIsSaving(true);

    setTimeout(() => {
      try {
        const cropped = cropper.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        });

        const out  = document.createElement('canvas');
        out.width  = cropped.width;
        out.height = cropped.height;
        const ctx  = out.getContext('2d')!;
        ctx.filter = filterString;
        ctx.drawImage(cropped, 0, 0);

        out.toBlob(blob => {
          if (blob) onSave(blob, isSaveAs);
          setIsSaving(false);
        }, 'image/jpeg', 0.95);
      } catch (err) {
        console.error('Save failed:', err);
        setIsSaving(false);
      }
    }, 50);
  };

  const curvesTable = useMemo(
    () => getCurvesTableValues(adjustments.curves || DEFAULT_CURVE),
    [adjustments.curves],
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col font-sans">
      <TopBar onClose={onClose} isSaving={isSaving} handleSave={handleSave} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool as any}>
          {activeTool === 'transform' && (
            <TransformPanel
              hasCropSelection={hasCropSelection}
              isImageCropped={isImageCropped}
              handleApplyCrop={handleApplyCrop}
              handleResetCrop={handleResetCrop}
              currentRatio={currentRatio}
              handleSetAspectRatio={handleSetAspectRatio}
              handleRotate={handleRotate}
              straightenAngle={straightenAngle}
              handleStraighten={handleStraighten}
              flipH={flipH}
              flipV={flipV}
              handleFlipH={handleFlipH}
              handleFlipV={handleFlipV}
            />
          )}

          {activeTool === 'adjust' && (
            <AdjustPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'detail' && (
            <DetailPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'effects' && (
            <EffectsPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}
        </Sidebar>

        <CanvasArea
          currentImageSrc={currentImageSrc}
          filterString={filterString}
          cropperRef={cropperRef}
          handleCropEvent={handleCropEvent}
          handleReady={handleReady}
          hasCropSelection={hasCropSelection}
          activeTool={activeTool}
          handleApplyCrop={handleApplyCrop}
          adjustments={adjustments}
          isSaving={isSaving}
          curvesTable={curvesTable}
        />

        <HistoryPanel
          history={history}
          currentIndex={currentHistoryIndex}
          onJumpTo={handleJumpToHistory}
          onClear={handleClearHistory}
          onToggleHide={handleToggleHideHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
        />
      </div>
    </div>
  );
};
