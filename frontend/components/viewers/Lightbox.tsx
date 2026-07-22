import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Photo } from '@/types';
import { API_BASE } from '@/constants';
import { eventService } from '@/services/EventService';
import { customConfirm } from '@/services/ConfirmService';

import { useLightboxGestures } from '@/hooks/useLightboxGestures';
import { useImageHighRes } from '@/hooks/useImageHighRes';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';
import { useSlideshow } from '@/hooks/useSlideshow';

import { InfoPanel } from './lightbox/InfoPanel';
import { Toolbar } from './lightbox/Toolbar';
import { PhotoMetadataDisplay } from './lightbox/PhotoMetadataDisplay';
import { NavigationArrows } from './lightbox/NavigationArrows';
import { ImageDisplay } from './lightbox/ImageDisplay';
import { Filmstrip } from './lightbox/Filmstrip';
import { VideoPlayer } from './lightbox/VideoPlayer';
import { SlideshowControls } from './lightbox/SlideshowControls';
import { FaceTaggingOverlay } from './lightbox/FaceTaggingOverlay';
import { ComparisonView } from './lightbox/ComparisonView';
import { KeyboardShortcutsModal } from './lightbox/KeyboardShortcutsModal';
import { EditingMode } from '@/components/Editor/ImageEditor/EditingMode';
import { VideoEditorMode } from '@/components/Editor/VideoEditor/VideoEditorMode';

interface LightboxProps {
  photo: Photo;
  photos?: Photo[];
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPhotoSelect?: (photo: Photo) => void;
  onRemoveFromAlbum?: () => void;
  onSetAsCover?: () => void;
  onToggleFavorite?: (id: string | number) => void;
}

/** Cinematic enter/exit variants for slideshow transitions. */
const slideVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 48 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -48 },
  },
  'ken-burns': {
    initial: { opacity: 0, scale: 1.04 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

export const Lightbox: React.FC<LightboxProps> = ({
  photo,
  photos,
  onClose,
  onNext,
  onPrev,
  onPhotoSelect,
  onRemoveFromAlbum,
  onSetAsCover,
  onToggleFavorite,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [metadata, setMetadata] = useState<Photo | null>(null);
  const [lastNavDir, setLastNavDir] = useState<'prev' | 'next' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isNLEOpen, setIsNLEOpen] = useState(false);
  const [editedPhotoUrl, setEditedPhotoUrl] = useState<string | null>(null);
  const [isFaceTaggingActive, setIsFaceTaggingActive] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const unloadInpaintModels = useCallback(() => {
    fetch(`${API_BASE}/api/v1/photos/inpaint/unload`, { method: 'POST' }).catch(() => {});
  }, []);

  const displayRef = useRef<HTMLDivElement>(null);

  // Note: handlePrev/handleNext are intentionally wired to opposite parent callbacks
  // so arrow/swipe direction matches the reversed filmstrip (oldest → newest L→R).
  const handlePrev = useCallback(() => {
    setLastNavDir('prev');
    onPrev();
  }, [onPrev]);

  const handleNext = useCallback(() => {
    setLastNavDir('next');
    onNext();
  }, [onNext]);

  const {
    zoomScale, setZoomScale, offset, isDragging, resetInteraction,
    handleDoubleClick, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel
  } = useLightboxGestures({ onNext: handleNext, onPrev: handlePrev });

  const highRes = useImageHighRes({ photo });
  const isVideo = photo.type === 'video' || photo.file_type === 'video';
  useZoomShortcuts();

  const currentIndex = useMemo(
    () => photos ? photos.findIndex((p) => String(p.id) === String(photo.id)) : 0,
    [photos, photo.id],
  );

  const totalCount = photos?.length ?? 0;
  const canStartSlideshow = totalCount > 1;

  // Slideshow advance: visual "next" (right) with optional loop.
  // handleNext increases index in the source list; at photos.length - 1 we jump to the first photo (index 0) when looping.
  const advanceSlideshow = useCallback(() => {
    if (!photos || photos.length <= 1) return;

    if (currentIndex < photos.length - 1) {
      handleNext();
      return;
    }

    // At the "end" of the visual forward direction (index photos.length - 1).
    // Access loop via ref-less path: stop is handled after hook is created — see effect below.
    // We use a module-level pattern via slideshow ref set after hook init.
    slideshowAdvanceAtEndRef.current();
  }, [photos, currentIndex, handleNext]);

  const slideshowAdvanceAtEndRef = useRef<() => void>(() => {});

  const {
    isActive: slideshowActive,
    isPlaying: slideshowPlaying,
    intervalMs: slideshowIntervalMs,
    setIntervalMs: setSlideshowIntervalMs,
    loop: slideshowLoop,
    setLoop: setSlideshowLoop,
    transition: slideshowTransition,
    setTransition: setSlideshowTransition,
    progress: slideshowProgress,
    musicEnabled,
    setMusicEnabled,
    musicVolume,
    setMusicVolume,
    musicName,
    setMusicFile,
    start: startSlideshow,
    stop: stopSlideshow,
    togglePlay: toggleSlideshowPlay,
    setIsPlaying: setSlideshowPlaying,
  } = useSlideshow({
    onAdvance: advanceSlideshow,
    pauseTimer: isVideo,
    mediaKey: photo.id,
  });

  // Keep end-of-list handler in sync with loop flag and photo list.
  useEffect(() => {
    slideshowAdvanceAtEndRef.current = () => {
      if (slideshowLoop && photos && photos.length > 0) {
        setLastNavDir('next');
        onPhotoSelect?.(photos[0]);
      } else {
        setSlideshowPlaying(false);
      }
    };
  }, [slideshowLoop, setSlideshowPlaying, photos, onPhotoSelect]);

  const handleStartSlideshow = useCallback(() => {
    if (!canStartSlideshow) return;
    setShowInfo(false);
    resetInteraction();
    startSlideshow();
  }, [canStartSlideshow, resetInteraction, startSlideshow]);

  const handleStopSlideshow = useCallback(() => {
    stopSlideshow();
  }, [stopSlideshow]);

  const handleVideoEnded = useCallback(() => {
    if (slideshowActive && slideshowPlaying) {
      advanceSlideshow();
    }
  }, [slideshowActive, slideshowPlaying, advanceSlideshow]);

  useEffect(() => {
    resetInteraction();
    setEditedPhotoUrl(null);
    setMetadata(null);
  }, [photo.id, resetInteraction]);

  const prevBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevBlobUrlRef.current && prevBlobUrlRef.current !== editedPhotoUrl) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }
    prevBlobUrlRef.current = editedPhotoUrl?.startsWith('blob:') ? editedPhotoUrl : null;
  }, [editedPhotoUrl]);

  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [photo.id]);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/metadata`);
      const data = await res.json();
      setMetadata(data);
    } catch (e) {
      console.error("Failed to fetch metadata", e);
    }
  }, [photo.id]);

  useEffect(() => {
    if (showInfo) {
      fetchMetadata();
    }
  }, [showInfo, fetchMetadata]);

  const handleTrash = useCallback(async () => {
    if (!await customConfirm('Move this photo to trash?', 'Confirm Trash')) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/trash`, {
        method: 'POST',
      });
      if (res.ok) {
        eventService.emit('photo_trashed', { type: 'photo_trashed', photoId: photo.id });
        onClose();
      } else {
        console.error("Failed to trash photo");
      }
    } catch (e) {
      console.error("Error trashing photo", e);
    }
  }, [photo.id, onClose]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(photo.id);
  }, [photo.id, onToggleFavorite]);

  // Zero-Latency Preloading Strategy: pre-fetch adjacent 3 photos into hidden Image buffers
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const adjacentIndices = [
      currentIndex - 3, currentIndex - 2, currentIndex - 1,
      currentIndex + 1, currentIndex + 2, currentIndex + 3
    ].filter(idx => idx >= 0 && idx < photos.length);

    adjacentIndices.forEach(idx => {
      const target = photos[idx];
      if (target && (target.url || target.id)) {
        const img = new Image();
        img.src = target.url || `${API_BASE}/api/v1/photos/${target.id}/file`;
      }
    });
  }, [photos, currentIndex]);

  // Copy Image Blob to OS Clipboard
  const handleCopyImageToClipboard = useCallback(async () => {
    try {
      const imgUrl = editedPhotoUrl || highRes.currentHighResUrl || photo.url || `${API_BASE}/api/v1/photos/${photo.id}/file`;
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob })
      ]);
      alert('Image copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
    }
  }, [editedPhotoUrl, highRes.currentHighResUrl, photo]);

  // Keyboard: slideshow-aware & shortcut overlay ('?')
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isEditing || isNLEOpen) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }

      // Slideshow mode bindings
      if (slideshowActive) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleStopSlideshow();
          return;
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggleSlideshowPlay();
          return;
        }
        if (e.key === 'ArrowRight' && zoomScale === 1) {
          e.preventDefault();
          handleNext();
          return;
        }
        if (e.key === 'ArrowLeft' && zoomScale === 1) {
          e.preventDefault();
          handlePrev();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isFaceTaggingActive) {
          setIsFaceTaggingActive(false);
          return;
        }
        if (isComparisonOpen) {
          setIsComparisonOpen(false);
          return;
        }
        onClose();
      }
      if ((e.key === 's' || e.key === 'S') && canStartSlideshow) {
        e.preventDefault();
        handleStartSlideshow();
        return;
      }
      if (!isVideo && zoomScale === 1) {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    onClose, handleNext, handlePrev, zoomScale, isEditing, isNLEOpen, isVideo,
    slideshowActive, toggleSlideshowPlay, handleStopSlideshow, handleStartSlideshow,
    canStartSlideshow, isFaceTaggingActive, isComparisonOpen,
  ]);

  // Stop slideshow when entering editor
  useEffect(() => {
    if ((isEditing || isNLEOpen) && slideshowActive) {
      handleStopSlideshow();
    }
  }, [isEditing, isNLEOpen, slideshowActive, handleStopSlideshow]);

  const aspect = useMemo(
    () => (photo.width && photo.height ? photo.width / photo.height : null),
    [photo.width, photo.height],
  );

  const displayContainerStyle = useMemo<React.CSSProperties>(() => ({
    aspectRatio: aspect ? `${aspect}` : undefined,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: slideshowActive ? '90vh' : '80vh',
  }), [aspect, slideshowActive]);

  const editingSrc = useMemo(() => {
    const baseSrc = editedPhotoUrl || highRes.currentHighResUrl || photo.url;
    if (baseSrc.startsWith('blob:') || baseSrc.startsWith('data:')) return baseSrc;
    const sep = baseSrc.includes('?') ? '&' : '?';
    return `${baseSrc}${sep}nocache=${photo.id}-${highRes.highResStatus}`;
  }, [photo.id, photo.url, editedPhotoUrl, highRes.currentHighResUrl, highRes.highResStatus]);

  const variants = slideVariants[slideshowTransition] ?? slideVariants.fade;
  const useKenBurns =
    slideshowActive &&
    slideshowPlaying &&
    slideshowTransition === 'ken-burns' &&
    !isVideo;

  const chromeHidden = slideshowActive;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0F14] overflow-hidden"
    >
      {/* Top toolbar — hidden during slideshow for distraction-free viewing */}
      {!chromeHidden && (
        <Toolbar
          photo={photo}
          highResStatus={highRes.highResStatus}
          zoomScale={zoomScale}
          showInfo={showInfo}
          currentIndex={currentIndex}
          totalCount={totalCount}
          slideshowActive={slideshowActive}
          canStartSlideshow={canStartSlideshow}
          faceTaggingActive={isFaceTaggingActive}
          onClose={onClose}
          onSetZoomScale={setZoomScale}
          onResetInteraction={resetInteraction}
          onToggleShowInfo={() => setShowInfo(!showInfo)}
          onToggleFavorite={handleToggleFavorite}
          onEdit={() => {
            const video = photo.type === 'video' || photo.file_type === 'video';
            if (video) {
              setIsNLEOpen(true);
            } else {
              setIsEditing(true);
            }
          }}
          onTrash={handleTrash}
          onRemoveFromAlbum={onRemoveFromAlbum}
          onSetAsCover={onSetAsCover}
          onStartSlideshow={handleStartSlideshow}
          onToggleFaceTagging={() => setIsFaceTaggingActive(prev => !prev)}
          onOpenComparison={() => setIsComparisonOpen(true)}
          onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
          onCopyImageToClipboard={handleCopyImageToClipboard}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {showInfo && !chromeHidden && (
          <InfoPanel photo={photo} metadata={metadata} onMetadataUpdated={fetchMetadata} />
        )}

        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden touch-none group"
          onDoubleClick={!isVideo && !slideshowActive ? handleDoubleClick : undefined}
          onPointerDown={!isVideo && !slideshowActive ? handlePointerDown : undefined}
          onPointerMove={!isVideo && !slideshowActive ? handlePointerMove : undefined}
          onPointerUp={!isVideo && !slideshowActive ? handlePointerUp : undefined}
          onPointerCancel={!isVideo && !slideshowActive ? handlePointerUp : undefined}
          onWheel={!isVideo && !slideshowActive ? handleWheel : undefined}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={photo.id}
              ref={displayRef}
              style={displayContainerStyle}
              className={`relative bg-transparent ${
                !slideshowActive && lastNavDir === 'prev'
                  ? 'animate-slide-from-left'
                  : !slideshowActive && lastNavDir === 'next'
                  ? 'animate-slide-from-right'
                  : ''
              }`}
              initial={slideshowActive ? variants.initial : false}
              animate={slideshowActive ? variants.animate : undefined}
              exit={slideshowActive ? variants.exit : undefined}
              transition={
                slideshowActive
                  ? { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
                  : undefined
              }
            >
              {isVideo && !isNLEOpen ? (
                <VideoPlayer
                  photo={photo}
                  onClose={slideshowActive ? undefined : onClose}
                  autoPlay={slideshowActive ? slideshowPlaying : true}
                  onEnded={handleVideoEnded}
                  hideControls={slideshowActive}
                />
              ) : (
                <ImageDisplay
                  photo={photo}
                  zoomScale={zoomScale}
                  offset={offset}
                  isDragging={isDragging}
                  highResStatus={highRes.highResStatus}
                  currentHighResUrl={editedPhotoUrl || highRes.currentHighResUrl}
                  kenBurns={useKenBurns}
                />
              )}

              {/* Face Tagging Overlay */}
              {isFaceTaggingActive && !isVideo && (
                <FaceTaggingOverlay
                  photo={photo}
                  onClose={() => setIsFaceTaggingActive(false)}
                  onTagUpdated={fetchMetadata}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {!chromeHidden && (
            <NavigationArrows
              zoomScale={zoomScale}
              currentIndex={currentIndex}
              totalCount={totalCount}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}

          {slideshowActive && (
            <SlideshowControls
              isPlaying={slideshowPlaying}
              progress={isVideo ? 0 : slideshowProgress}
              intervalMs={slideshowIntervalMs}
              loop={slideshowLoop}
              transition={slideshowTransition}
              musicEnabled={musicEnabled}
              musicVolume={musicVolume}
              musicName={musicName}
              currentIndex={currentIndex}
              totalCount={totalCount}
              onTogglePlay={toggleSlideshowPlay}
              onStop={handleStopSlideshow}
              onSetIntervalMs={setSlideshowIntervalMs}
              onSetLoop={setSlideshowLoop}
              onSetTransition={setSlideshowTransition}
              onSetMusicEnabled={setMusicEnabled}
              onSetMusicVolume={setMusicVolume}
              onPickMusic={setMusicFile}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Mode Overlay */}
      {isComparisonOpen && (
        <ComparisonView
          currentPhoto={photo}
          photos={photos}
          onClose={() => setIsComparisonOpen(false)}
          onSelectPhoto={(p) => {
            onPhotoSelect?.(p);
            setIsComparisonOpen(false);
          }}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Bottom metadata bar — hidden during slideshow */}
      {!chromeHidden && (
        <div className="shrink-0 px-6 py-3 bg-[#0D0F14] border-t border-white/5 z-20">
          <PhotoMetadataDisplay photo={photo} metadata={metadata} />
        </div>
      )}

      {/* Filmstrip — hidden during slideshow */}
      {!chromeHidden && photos && photos.length > 1 ? (
        <Filmstrip
          photos={photos}
          currentPhotoId={photo.id}
          onSelect={onPhotoSelect || (() => {})}
        />
      ) : null}

      {/* NLE Video Editor overlay */}
      {isNLEOpen && (
        <VideoEditorMode
          photo={photo}
          onClose={() => setIsNLEOpen(false)}
        />
      )}

      {/* Editing overlay */}
      {isEditing && (
        <EditingMode
          src={editingSrc}
          photoId={photo.id}
          onClose={() => {
            setIsEditing(false);
            unloadInpaintModels();
          }}
          onSave={async (blob, isSaveAs) => {
            const formData = new FormData();
            formData.append('file', blob, photo.filename || 'edited.jpg');
            formData.append('original_path', photo.path || '');
            formData.append('is_save_as', isSaveAs ? 'true' : 'false');

            if (isSaveAs) {
              try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const saveAsPath = await save({
                  defaultPath: photo.filename || 'edited.jpg',
                  filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
                });

                if (!saveAsPath) {
                  return;
                }
                formData.append('save_as_path', saveAsPath);
              } catch (e) {
                console.error("Tauri dialog error:", e);
              }
            }

            try {
              const res = await fetch(`${API_BASE}/api/v1/photos/upload-blob`, {
                method: 'POST',
                body: formData,
              });

              if (res.ok) {
                setEditedPhotoUrl(URL.createObjectURL(blob));
                setIsEditing(false);
                unloadInpaintModels();
              } else {
                console.error("Failed to save photo", await res.text());
              }
            } catch (e) {
              console.error("Error saving photo", e);
            }
          }}
        />
      )}
    </motion.div>
  );
};
