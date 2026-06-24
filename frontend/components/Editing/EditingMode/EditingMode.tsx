/**
 * EditingMode.tsx
 * Logic, state management, and UI layer for the image editor.
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
// @ts-ignore -- react-color-palette css side-effect import lacks types
import 'react-color-palette/css';
import { ReactCropperElement } from 'react-cropper';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { AdjustPanel } from '../AdjustPanel';
import { DetailPanel } from '../DetailPanel';
import { EffectsPanel } from '../EffectsPanel';
import { TransformPanel } from '../TransformPanel';
import { TopBar } from '../TopBar';
import { Sidebar, ToolId } from '../Sidebar';
import { CanvasArea } from '../CanvasArea';
import { HistoryPanel } from '../HistoryPanel';
import { Adjustments, DEFAULT_ADJUSTMENTS, toFilterString } from '../filterEngine';
import { DEFAULT_CURVE, getCurvesTableValues } from '../curves';
import { PortraitPanel } from '../PortraitPanel';
import { SelectivePanel } from '../SelectivePanel';
import { InpaintPanel, InpaintMode, InpaintOperation, InpaintSettings } from '../InpaintPanel';
import { InpaintTutorial } from '../InpaintTutorial';
import { HslPanel } from '../HslPanel';
import { PresetsPanel } from '../PresetsPanel';
import { SplitToningPanel } from '../SplitToningPanel';
import { TexturePanel } from '../TexturePanel';
import { FramesPanel } from '../FramesPanel';
import { BlendPanel } from '../BlendPanel';
import { TiltShiftPanel } from '../TiltShiftPanel';
import { PalettePanel } from '../PalettePanel';
import { AnnotationsPanel, DrawToolId } from '../AnnotationsPanel';

import { HistoryActionType } from '../history';
import { API_BASE, resolveUrl } from '../../../constants';

import { useAnnotationsState } from './useAnnotationsState';
import { useEditingHistory } from './useEditingHistory';
import { useKeyBindings } from './useKeyBindings';

declare global {
  interface Window {
    __clearInpaintMask?: () => void;
  }
}

interface EditingModeProps {
  src:     string;
  onClose: () => void;
  onSave:  (file: Blob, isSaveAs: boolean) => void;
  photoId?: number | string;
}

export const EditingMode: React.FC<EditingModeProps> = ({
  src,
  onClose,
  onSave,
  photoId,
}) => {
  // Refs / state
  const cropperRef = useRef<ReactCropperElement>(null);
  const [currentRatio, setCurrentRatio] = useState<number>(NaN);
  const [activeTool, setActiveTool] = useState<ToolId | null>('inpaint');
  
  // Annotations state (via hook)
  const annState = useAnnotationsState();

  // Draw tools and styles local to the drawing mode
  const [activeDrawTool, setActiveDrawTool] = useState<DrawToolId>('freehand');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [activeOpacity, setActiveOpacity] = useState<number>(1);
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [brushSize, setBrushSize] = useState<number>(35);
  const userChangedStyleRef = useRef(false);

  // History and adjustments state (via hook)
  const historyState = useEditingHistory({
    src,
    cropperRef,
    annotations: annState.annotations,
    setAnnotations: annState.setAnnotations,
    setAnnotationsHistoryPast: annState.setAnnotationsHistoryPast,
    setAnnotationsHistoryFuture: annState.setAnnotationsHistoryFuture,
  });

  const {
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
    currentHistoryIndex,
    isRestoringHistory,
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
  } = historyState;

  // Collapsible History Panel State
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const autoOpenedHistoryRef = useRef<boolean>(false);

  useEffect(() => {
    if (history.length >= 4 && !autoOpenedHistoryRef.current) {
      setShowHistory(true);
      autoOpenedHistoryRef.current = true;
    }
  }, [history.length]);

  // Inpaint state
  const [inpaintMode, setInpaintMode] = useState<InpaintMode>('brush');
  const [inpaintOperation, setInpaintOperation] = useState<InpaintOperation>('remove');
  const [inpaintSettings, setInpaintSettings] = useState<InpaintSettings>({
    brushSize: 50,
    brushHardness: 80,
    model: 'lama',
    guidance: 7.5,
    steps: 50,
    maskOpacity: 60,
    showMask: true,
  });
  const [inpaintMask, setInpaintMask] = useState<string | null>(null);
  const [isInpainting, setIsInpainting] = useState<boolean>(false);
  const [showInpaintTutorial, setShowInpaintTutorial] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const savedCropBoxRef = useRef<Cropper.CropBoxData | null>(null);

  // Before/After compare state
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // In-place Crop management
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const isImageCropped = currentImageSrc !== src;

  // Sync state if navigation or prop source changes
  useEffect(() => {
    setHasCropSelection(false);
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

  const handleApplyCrop = useCallback(() => {
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
        historyState.createdUrlRef.current = newUrl;

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
  }, [addHistoryEntry, revokeLocalUrl, setCurrentImageSrc, setTotalRotation, setStraightenAngle, setFlipH, setFlipV, historyState.createdUrlRef]);

  const handleResetCrop = useCallback(() => {
    revokeLocalUrl();
    setCurrentImageSrc(src);
    setHasCropSelection(false);

    setTotalRotation(0);
    setStraightenAngle(0);
    setFlipH(false);
    setFlipV(false);
  }, [src, revokeLocalUrl, setCurrentImageSrc, setTotalRotation, setStraightenAngle, setFlipH, setFlipV]);

  const filterString = useMemo(() => toFilterString(adjustments), [adjustments]);
  const deferredAdjustments = React.useDeferredValue(adjustments);
  const deferredFilterString = useMemo(() => toFilterString(deferredAdjustments), [deferredAdjustments]);

  useEffect(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    if (activeTool !== 'transform') {
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

  const handleRotate = useCallback((degree: number) => {
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
      (containerData.width  * 0.95) / displayW,
      (containerData.height * 0.95) / displayH,
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
  }, [totalRotation, currentRatio, setTotalRotation]);

  const handleSetAspectRatio = useCallback((ratio: number) => {
    setCurrentRatio(ratio);
    cropperRef.current?.cropper.setAspectRatio(ratio);
  }, []);

  const handleReady = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const containerData = cropper.getContainerData();
    const canvasData    = cropper.getCanvasData();

    const scale = Math.min(
      (containerData.width  * 0.95) / canvasData.width,
      (containerData.height * 0.95) / canvasData.height,
    );

    const newWidth  = canvasData.width  * scale;
    const newHeight = canvasData.height * scale;
    const newLeft   = (containerData.width  - newWidth)  / 2;
    const newTop    = (containerData.height - newHeight) / 2;
    cropper.setCropBoxData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    cropper.setCanvasData({ left: newLeft, top: newTop, width: newWidth, height: newHeight });

    cropper.scaleX(flipH ? -1 : 1);
    cropper.scaleY(flipV ? -1 : 1);
    if (typeof (cropper as any).rotateTo === 'function') {
      (cropper as any).rotateTo(totalRotation);
    } else {
      cropper.rotate(totalRotation);
    }
    isRestoringHistory.current = false;
  }, [flipH, flipV, totalRotation, isRestoringHistory]);

  const handleFlipH = useCallback(() => {
    const next = !flipH;
    setFlipH(next);
    cropperRef.current?.cropper.scaleX(next ? -1 : 1);
  }, [flipH, setFlipH]);

  const handleFlipV = useCallback(() => {
    const next = !flipV;
    setFlipV(next);
    cropperRef.current?.cropper.scaleY(next ? -1 : 1);
  }, [flipV, setFlipV]);

  const handleStraighten = useCallback((angle: number) => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const delta = angle - straightenAngle;
    setStraightenAngle(angle);
    cropper.rotate(delta);
  }, [straightenAngle, setStraightenAngle]);

  const handleAdjChange = useCallback((adj: Adjustments) => {
    setAdjustments(adj);
  }, [setAdjustments]);

  const handleInpaintProcess = useCallback(async () => {
    if (!inpaintMask || isInpainting) return;
    
    setIsInpainting(true);
    
    try {
      // Helper to convert any image source to Base64
      const getBase64FromUrl = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      // Ensure we are sending actual data, not just a URL
      const imageData = currentImageSrc.startsWith('data:') 
        ? currentImageSrc 
        : await getBase64FromUrl(resolveUrl(currentImageSrc));

      const response = await fetch(`${API_BASE}/api/v1/photos/inpaint/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          mask_data: inpaintMask,
          operation: inpaintOperation,
          model: inpaintSettings.model,
          prompt: inpaintSettings.prompt,
          guidance_scale: inpaintSettings.guidance,
          num_inference_steps: inpaintSettings.steps,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Create blob URL for the result
        revokeLocalUrl();
        const newUrl = result.result; // This is already a data URL
        
        // Convert data URL to blob URL for consistency
        const res = await fetch(newUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        historyState.createdUrlRef.current = blobUrl;
        
        setCurrentImageSrc(blobUrl);
        setInpaintMask(null);
        
        // Add to history
        addHistoryEntry('inpaint' as HistoryActionType, `Applied ${result.model} ${result.operation}`, undefined, blobUrl);
        
        // Clear the canvas mask
        if (window.__clearInpaintMask) {
          window.__clearInpaintMask();
        }
      } else {
        const errorText = await response.text();
        console.error('Inpainting failed:', errorText);
      }
    } catch (error) {
      console.error('Inpainting error:', error);
    } finally {
      setIsInpainting(false);
    }
  }, [inpaintMask, isInpainting, currentImageSrc, inpaintOperation, inpaintSettings, addHistoryEntry, revokeLocalUrl, setCurrentImageSrc, historyState.createdUrlRef]);

  const handleSave = useCallback((isSaveAs: boolean) => {
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

        void import('../exportPipeline')
          .then(({ exportEditedCanvas }) => exportEditedCanvas({
            sourceCanvas: cropped,
            adjustments,
            mimeType: 'image/jpeg',
            quality: 0.95,
            annotations: annState.annotations,
          }))
          .then((blob) => {
            onSave(blob, isSaveAs);
            setIsSaving(false);
          })
          .catch((error) => {
            console.error('Save failed:', error);
            setIsSaving(false);
          });
      } catch (err) {
        console.error('Save failed:', err);
        setIsSaving(false);
      }
    }, 50);
  }, [adjustments, isSaving, onSave, annState.annotations]);

  const handleCopy = useCallback(() => {
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

        void import('../exportPipeline')
          .then(({ exportEditedCanvas }) => exportEditedCanvas({
            sourceCanvas: cropped,
            adjustments,
            mimeType: 'image/png', // Must be PNG for Clipboard API
            quality: 1.0,
            annotations: annState.annotations,
          }))
          .then(async (blob) => {
            try {
              const data = [new ClipboardItem({ [blob.type]: blob })];
              await navigator.clipboard.write(data);
            } catch (err) {
              console.error('Clipboard write failed, using fallback download:', err);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'clipboard-fallback.png';
              a.click();
              URL.revokeObjectURL(url);
            }
            setIsSaving(false);
          })
          .catch((error) => {
            console.error('Copy failed:', error);
            setIsSaving(false);
          });
      } catch (err) {
        console.error('Copy failed:', err);
        setIsSaving(false);
      }
    }, 50);
  }, [adjustments, isSaving, annState.annotations]);

  // Keyboard bindings hook integration
  useKeyBindings({
    activeTool,
    undoAnnotations: annState.undoAnnotations,
    redoAnnotations: annState.redoAnnotations,
    currentHistoryIndex,
    history,
    handleJumpToHistory,
    setIsComparing,
    cropperRef,
    inpaintMode,
    setInpaintSettings,
  });

  const deferredCurvesTable = useMemo(
    () => getCurvesTableValues(deferredAdjustments.curves || DEFAULT_CURVE),
    [deferredAdjustments.curves],
  );

  return (
    <div className="fixed inset-0 z-[100] oled-bg flex flex-col font-sans overflow-hidden bg-[var(--bg-primary)]">
      <TopBar
        onClose={onClose}
        isSaving={isSaving}
        handleSave={handleSave}
        handleCopy={handleCopy}
        isComparing={isComparing}
        onCompareStart={() => setIsComparing(true)}
        onCompareEnd={() => setIsComparing(false)}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        historyCount={history.length}
      />

      <div className="flex-1 flex min-w-0 overflow-hidden relative isolate">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool as React.Dispatch<React.SetStateAction<ToolId | null>>}>
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
            <AdjustPanel
              adjustments={adjustments}
              onChange={handleAdjChange}
              photoId={photoId}
              imageSrc={currentImageSrc}
              filterString={filterString}
            />
          )}

          {activeTool === 'detail' && (
            <DetailPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'portrait' && (
            <PortraitPanel adjustments={adjustments} onChange={handleAdjChange} photoId={photoId} />
          )}

          {activeTool === 'selective' && (
            <SelectivePanel adjustments={adjustments} onChange={handleAdjChange} photoId={photoId} />
          )}

          {activeTool === 'hsl' && (
            <HslPanel
              adjustments={adjustments}
              onChange={handleAdjChange}
            />
          )}

          {activeTool === 'presets' && (
            <PresetsPanel
              adjustments={adjustments}
              onChange={handleAdjChange}
              imageSrc={currentImageSrc}
            />
          )}

          {activeTool === 'effects' && (
            <EffectsPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'splitToning' && (
            <SplitToningPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'texture' && (
            <TexturePanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'frame' && (
            <FramesPanel
              adjustments={adjustments}
              onChange={handleAdjChange}
              handleRotate={handleRotate}
              handleFlipH={handleFlipH}
              handleFlipV={handleFlipV}
              flipH={flipH}
              flipV={flipV}
              imageSrc={currentImageSrc}
            />
          )}

          {activeTool === 'blend' && (
            <BlendPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'tiltShift' && (
            <TiltShiftPanel adjustments={adjustments} onChange={handleAdjChange} />
          )}

          {activeTool === 'palette' && (
            <PalettePanel imageSrc={currentImageSrc} />
          )}

          {activeTool === 'annotations' && (
            <AnnotationsPanel
              annotations={annState.annotations}
              onChange={annState.updateAnnotations}
              activeDrawTool={activeDrawTool}
              setActiveDrawTool={setActiveDrawTool}
              activeColor={activeColor}
              setActiveColor={setActiveColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              selectedAnnId={annState.selectedAnnId}
              setSelectedAnnId={annState.setSelectedAnnId}
              setActiveOpacity={setActiveOpacity}
              markStyleChanged={() => { userChangedStyleRef.current = true; }}
              brushSize={brushSize}
              setBrushSize={setBrushSize}

              fontFamily={annState.fontFamily}
              setFontFamily={annState.setFontFamily}
              fontSize={annState.fontSize}
              setFontSize={annState.setFontSize}
              fontWeight={annState.fontWeight}
              setWeight={annState.setWeight}
              fontStyle={annState.fontStyle}
              setStyle={annState.setStyle}
              textDecoration={annState.textDecoration}
              setDecoration={annState.setDecoration}
              textAlign={annState.textAlign}
              setTextAlign={annState.setTextAlign}
              lineHeight={annState.lineHeight}
              setLineHeight={annState.setLineHeight}
              letterSpacing={annState.letterSpacing}
              setLetterSpacing={annState.setLetterSpacing}
              onUpdateTextProps={annState.onUpdateTextProps}

              doodleText={annState.doodleText}
              setDoodleText={annState.setDoodleText}
              doodleFontSize={annState.doodleFontSize}
              setDoodleFontSize={annState.setDoodleFontSize}
              doodleFontFamily={annState.doodleFontFamily}
              setDoodleFontFamily={annState.setDoodleFontFamily}
              showDoodleGuide={annState.showDoodleGuide}
              setShowDoodleGuide={annState.setShowDoodleGuide}
            />
          )}

          {activeTool === 'inpaint' && (
            <InpaintPanel
              mode={inpaintMode}
              operation={inpaintOperation}
              settings={inpaintSettings}
              onModeChange={setInpaintMode}
              onOperationChange={setInpaintOperation}
              onSettingsChange={setInpaintSettings}
              onUndo={() => {}}
              onRedo={() => {}}
              onClearMask={() => {
                setInpaintMask(null);
                if (window.__clearInpaintMask) {
                  window.__clearInpaintMask();
                }
              }}
              onProcess={handleInpaintProcess}
              canUndo={false}
              canRedo={false}
              isProcessing={isInpainting}
              onShowTutorial={() => setShowInpaintTutorial(true)}
            />
          )}
        </Sidebar>

        <CanvasArea
          currentImageSrc={currentImageSrc}
          filterString={deferredFilterString}
          cropperRef={cropperRef}
          handleCropEvent={handleCropEvent}
          handleReady={handleReady}
          activeTool={activeTool}
          adjustments={deferredAdjustments}
          isSaving={isSaving}
          curvesTable={deferredCurvesTable}
          isComparing={isComparing}
          inpaintMode={inpaintMode}
          brushSize={inpaintSettings.brushSize}
          onInpaintMaskChange={setInpaintMask}
          showMaskPreview={inpaintSettings.showMask}
          maskOpacity={inpaintSettings.maskOpacity}
          annotations={annState.annotations}
          onAnnotationsChange={annState.updateAnnotations}
          onStartGesture={annState.onStartGesture}
          onEndGesture={annState.onEndGesture}
          activeDrawTool={activeDrawTool}
          setActiveDrawTool={setActiveDrawTool}
          activeColor={activeColor}
          strokeWidth={strokeWidth}
          eraserSize={brushSize}
          selectedAnnId={annState.selectedAnnId}
          setSelectedAnnId={annState.setSelectedAnnId}
          userChangedStyleRef={userChangedStyleRef}

          fontFamily={annState.fontFamily}
          setFontFamily={annState.setFontFamily}
          fontSize={annState.fontSize}
          setFontSize={annState.setFontSize}
          fontWeight={annState.fontWeight}
          setWeight={annState.setWeight}
          fontStyle={annState.fontStyle}
          setStyle={annState.setStyle}
          textDecoration={annState.textDecoration}
          setDecoration={annState.setDecoration}
          textAlign={annState.textAlign}
          setTextAlign={annState.setTextAlign}
          lineHeight={annState.lineHeight}
          setLineHeight={annState.setLineHeight}
          letterSpacing={annState.letterSpacing}
          setLetterSpacing={annState.setLetterSpacing}
          onUpdateTextProps={annState.onUpdateTextProps}

          doodleText={annState.doodleText}
          setDoodleText={annState.setDoodleText}
          doodleFontSize={annState.doodleFontSize}
          setDoodleFontSize={annState.setDoodleFontSize}
          doodleFontFamily={annState.doodleFontFamily}
          setDoodleFontFamily={annState.setDoodleFontFamily}
          showDoodleGuide={annState.showDoodleGuide}
          setShowDoodleGuide={annState.setShowDoodleGuide}
        />

        {showHistory && (
          <HistoryPanel
            history={history}
            currentIndex={currentHistoryIndex}
            onJumpTo={handleJumpToHistory}
            onClear={handleClearHistory}
            onToggleHide={handleToggleHideHistoryEntry}
            onDeleteEntry={handleDeleteHistoryEntry}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {/* Tutorial Modal */}
      <InpaintTutorial
        isOpen={showInpaintTutorial}
        onClose={() => setShowInpaintTutorial(false)}
      />
    </div>
  );
};
